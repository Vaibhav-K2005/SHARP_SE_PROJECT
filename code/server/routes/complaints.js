// server/routes/complaints.js
import express from 'express';
import { db } from '../data/db.js';
import { notifyRecipient, notifyStudents } from '../utils/notifications.js';

const router = express.Router();
const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function normalizeHostel(name = '') {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCaretakerForHostel(hostelName) {
  const caretakers = db.find('users', user => user.role === 'caretaker');
  const normalizedHostel = normalizeHostel(hostelName);
  return caretakers.find(user => normalizeHostel(user.hostelName) === normalizedHostel)
    || (caretakers.length === 1 ? caretakers[0] : null);
}

function getComplaintCaretaker(complaint) {
  if (complaint.caretakerId) return db.findById('users', complaint.caretakerId);
  return findCaretakerForHostel(complaint.hostelName);
}

function notifyCaretakerForComplaint(complaint, message, title) {
  const caretaker = getComplaintCaretaker(complaint);
  if (!caretaker) return null;
  complaint.caretakerId = caretaker.id;
  return notifyRecipient('caretaker', caretaker.id, message, title);
}

// 1. Submit Maintenance Complaint (Student)
router.post('/maintenance', (req, res) => {
  const { studentId, category, description } = req.body;
  const student = db.findById('users', studentId);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });
  if (!description?.trim()) return res.status(400).json({ error: 'Please describe the maintenance issue' });

  const caretaker = findCaretakerForHostel(student.currentHostel);
  const complaint = db.insert('complaints', {
    type: 'MAINTENANCE',
    category: category || 'General Room Issue',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    caretakerId: caretaker?.id || null,
    description: description.trim(),
    status: 'SUBMITTED', // SUBMITTED -> UNDER_REVIEW -> IN_PROGRESS -> AWAITING_STUDENT_CONFIRMATION -> CLOSED
    createdAt: new Date().toISOString(),
    caretakerNotes: ''
  });
  if (caretaker) {
    notifyRecipient('caretaker', caretaker.id, `New maintenance complaint ${complaint.id} from ${student.fullName} requires review.`, 'New maintenance complaint');
  }

  res.json({ success: true, complaint });
});

// 2. Submit Laundry Complaint (Student)
router.post('/laundry', (req, res) => {
  const { studentId, category, description } = req.body;
  const student = db.findById('users', studentId);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });
  if (!description?.trim()) return res.status(400).json({ error: 'Please describe the laundry issue' });

  const caretaker = findCaretakerForHostel(student.currentHostel);
  const complaint = db.insert('complaints', {
    type: 'LAUNDRY',
    category: category || 'Missing Clothing Item',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    caretakerId: caretaker?.id || null,
    description: description.trim(),
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    caretakerNotes: ''
  });
  if (caretaker) {
    notifyRecipient('caretaker', caretaker.id, `New laundry complaint ${complaint.id} from ${student.fullName} requires review.`, 'New laundry complaint');
  }

  res.json({ success: true, complaint });
});

// 3. Submit Parent Concern ("Report to Caretaker")
router.post('/parent-report', (req, res) => {
  const { parentId, studentRollNumber, category, description } = req.body;
  const parent = db.findById('users', parentId);
  const student = db.findOne('users', u => u.rollNumber === studentRollNumber);
  if (!student) return res.status(404).json({ error: 'Linked student not found' });

  const complaint = db.insert('complaints', {
    type: 'PARENT_CONCERN',
    category: category || 'Hostel conditions',
    parentId: parent ? parent.id : null,
    parentName: parent ? parent.fullName : 'Parent',
    studentRollNumber: student.rollNumber,
    studentName: student.fullName,
    hostelName: student.currentHostel,
    description,
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    caretakerNotes: ''
  });

  res.json({ success: true, complaint });
});

// 4. Caretaker Update Complaint Status & Notes
router.post('/update-status', (req, res) => {
  const { complaintId, status, caretakerNotes } = req.body;
  const complaint = db.findById('complaints', complaintId);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const nextStatus = status === 'RESOLVED' ? 'AWAITING_STUDENT_CONFIRMATION' : status;
  const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'REOPENED', 'AWAITING_STUDENT_CONFIRMATION'];
  if (!validStatuses.includes(nextStatus)) {
    return res.status(400).json({ error: 'Caretakers may update progress, but only the reporting student can confirm resolution.' });
  }
  if (complaint.status === 'CLOSED') {
    return res.status(409).json({ error: 'This complaint has already been confirmed resolved by the student.' });
  }

  const statusChanged = complaint.status !== nextStatus;
  complaint.status = nextStatus;
  if (caretakerNotes !== undefined) {
    complaint.caretakerNotes = caretakerNotes;
  }
  complaint.updatedAt = new Date().toISOString();

  db.save();
  if (statusChanged && complaint.studentId) {
    const message = nextStatus === 'AWAITING_STUDENT_CONFIRMATION'
      ? `The caretaker reports that your ${complaint.category.toLowerCase()} complaint is fixed. Please confirm or reopen it in your portal.`
      : `Your ${complaint.category.toLowerCase()} complaint status is now ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`;
    notifyStudents(message, 'Complaint status updated', [complaint.studentId]);
  }
  res.json({ success: true, complaint });
});

// Student confirms the repair or reopens the complaint if it is still unresolved.
router.post('/student-resolution', (req, res) => {
  const { complaintId, studentId, resolved } = req.body;
  const student = db.findById('users', studentId);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });

  const complaint = db.findById('complaints', complaintId);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  if (complaint.studentId !== student.id) return res.status(403).json({ error: 'Only the reporting student can respond to this complaint' });
  if (typeof resolved !== 'boolean') return res.status(400).json({ error: 'Choose whether the issue is resolved' });
  if (!['AWAITING_STUDENT_CONFIRMATION', 'RESOLVED'].includes(complaint.status)) {
    return res.status(409).json({ error: 'This complaint is not awaiting student confirmation' });
  }

  const timestamp = new Date().toISOString();
  complaint.status = resolved ? 'CLOSED' : 'REOPENED';
  complaint.updatedAt = timestamp;
  if (resolved) complaint.studentResolvedAt = timestamp;
  else complaint.reopenedAt = timestamp;
  db.save();

  const caretakerMessage = resolved
    ? `The student confirmed complaint ${complaint.id} is resolved.`
    : `The student reports complaint ${complaint.id} is still unresolved. Please follow up.`;
  notifyCaretakerForComplaint(complaint, caretakerMessage, resolved ? 'Complaint confirmed resolved' : 'Complaint reopened');
  res.json({ success: true, complaint });
});

// The student may remind the assigned caretaker after three days without progress.
router.post('/remind-caretaker', (req, res) => {
  const { complaintId, studentId } = req.body;
  const student = db.findById('users', studentId);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });

  const complaint = db.findById('complaints', complaintId);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  if (complaint.studentId !== student.id) return res.status(403).json({ error: 'Only the reporting student can remind the caretaker' });
  if (['CLOSED', 'RESOLVED', 'AWAITING_STUDENT_CONFIRMATION'].includes(complaint.status)) {
    return res.status(409).json({ error: 'This complaint is not waiting for caretaker progress' });
  }

  const now = Date.now();
  const lastActivity = Date.parse(complaint.updatedAt || complaint.createdAt);
  if (!Number.isFinite(lastActivity) || now - lastActivity < REMINDER_AFTER_MS) {
    return res.status(400).json({ error: 'You can remind the caretaker after three days without an update' });
  }
  if (complaint.lastReminderAt && now - Date.parse(complaint.lastReminderAt) < REMINDER_COOLDOWN_MS) {
    return res.status(429).json({ error: 'A reminder was already sent recently. You can send another after 24 hours.' });
  }

  const caretaker = getComplaintCaretaker(complaint);
  if (!caretaker) return res.status(503).json({ error: 'No caretaker is assigned to this complaint yet' });

  complaint.caretakerId = caretaker.id;
  complaint.lastReminderAt = new Date(now).toISOString();
  complaint.reminderCount = (complaint.reminderCount || 0) + 1;
  db.save();
  notifyRecipient('caretaker', caretaker.id, `The student has sent a reminder for ${complaint.category.toLowerCase()} complaint ${complaint.id} in Room ${complaint.roomNumber || 'N/A'}.`, 'Complaint reminder');
  res.json({ success: true, complaint, message: 'A reminder was sent to the caretaker.' });
});

// 5. Get Complaints for Student
router.get('/student/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const complaints = db.find('complaints', c => c.studentId === studentId);
  res.json({ complaints });
});

// 6. Get Complaints for Hostel Caretaker
router.get('/hostel/:hostelName', (req, res) => {
  const hostelName = normalizeHostel(req.params.hostelName);
  const caretakerId = req.query.caretakerId;
  const complaints = db.find('complaints', complaint =>
    normalizeHostel(complaint.hostelName) === hostelName ||
    (caretakerId && complaint.caretakerId === caretakerId)
  );
  res.json({ complaints });
});

// 7. Mess Feedback Routes
router.post('/mess-feedback', (req, res) => {
  const { studentId, mealType, category, rating, comments } = req.body;
  const student = db.findById('users', studentId);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ error: 'Student not found' });
  }

  const numericRating = Number(rating);
  if (!mealType || !category || !comments?.trim() || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: 'Meal, category, a comment, and a rating from 1 to 5 are required' });
  }

  const messName = student.currentHostel ? `${student.currentHostel} Mess` : 'Main Mess';
  const feedback = db.insert('messFeedback', {
    mealType,
    category,
    rating: numericRating,
    comments: comments.trim(),
    anonymous: true,
    reporterId: student.id,
    hostelName: messName,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  });

  const managers = db.find('users', manager =>
    manager.role === 'mess_manager' &&
    normalizeHostel(manager.messName || `${manager.hostelName || ''} Mess`) === normalizeHostel(messName)
  );
  managers.forEach(manager => {
    notifyRecipient('mess_manager', manager.id, `New anonymous feedback has been submitted for ${mealType}.`, 'New mess feedback');
  });

  const { reporterId, ...anonymousFeedback } = feedback;
  res.json({ success: true, feedback: anonymousFeedback });
});

router.get('/mess-feedback/manager/:managerId', (req, res) => {
  const manager = db.findById('users', req.params.managerId);
  if (!manager || manager.role !== 'mess_manager') {
    return res.status(404).json({ error: 'Mess manager not found' });
  }

  const messName = manager.messName || (manager.hostelName ? `${manager.hostelName} Mess` : null);
  if (!messName) return res.status(400).json({ error: 'Assign a mess to this manager first' });

  const feedback = db.find('messFeedback', item => normalizeHostel(item.hostelName) === normalizeHostel(messName))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ reporterId, ...anonymousItem }) => anonymousItem);
  res.json({ messName, feedback });
});

router.get('/mess-feedback', (req, res) => {
  const messName = req.query.hostelName ? normalizeHostel(req.query.hostelName) : null;
  const feedback = db.find('messFeedback', item => !messName || normalizeHostel(item.hostelName) === messName)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ reporterId, ...anonymousItem }) => anonymousItem);
  res.json({ feedback });
});

export default router;
