// server/routes/complaints.js
import express from 'express';
import { db } from '../data/db.js';

const router = express.Router();

// 1. Submit Maintenance Complaint (Student)
router.post('/maintenance', (req, res) => {
  const { studentId, category, description } = req.body;
  const student = db.findById('users', studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const complaint = db.insert('complaints', {
    type: 'MAINTENANCE',
    category: category || 'General Room Issue',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    description,
    status: 'SUBMITTED', // SUBMITTED -> UNDER_REVIEW -> IN_PROGRESS -> RESOLVED
    createdAt: new Date().toISOString(),
    caretakerNotes: ''
  });

  res.json({ success: true, complaint });
});

// 2. Submit Laundry Complaint (Student)
router.post('/laundry', (req, res) => {
  const { studentId, category, description } = req.body;
  const student = db.findById('users', studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const complaint = db.insert('complaints', {
    type: 'LAUNDRY',
    category: category || 'Missing Clothing Item',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    description,
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
    caretakerNotes: ''
  });

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

  const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid complaint status' });
  }

  complaint.status = status;
  if (caretakerNotes !== undefined) {
    complaint.caretakerNotes = caretakerNotes;
  }
  complaint.updatedAt = new Date().toISOString();

  db.save();
  res.json({ success: true, complaint });
});

// 5. Get Complaints for Student
router.get('/student/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const complaints = db.find('complaints', c => c.studentId === studentId);
  res.json({ complaints });
});

// 6. Get Complaints for Hostel Caretaker
router.get('/hostel/:hostelName', (req, res) => {
  const hostelName = req.params.hostelName;
  const complaints = db.find('complaints', c => c.hostelName?.toLowerCase() === hostelName.toLowerCase());
  res.json({ complaints });
});

// 7. Mess Feedback Routes
router.post('/mess-feedback', (req, res) => {
  const { mealType, category, rating, comments, hostelName, anonymous } = req.body;
  const feedback = db.insert('messFeedback', {
    mealType: mealType || 'Dinner',
    category: category || 'Food Quality',
    rating: Number(rating) || 4,
    comments: comments || '',
    anonymous: anonymous !== false,
    hostelName: hostelName || 'Main Mess',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  });
  res.json({ success: true, feedback });
});

router.get('/mess-feedback', (req, res) => {
  const feedback = db.getCollection('messFeedback');
  res.json({ feedback });
});

export default router;
