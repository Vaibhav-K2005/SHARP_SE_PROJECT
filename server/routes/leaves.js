// server/routes/leaves.js
import express from 'express';
import { db } from '../data/db.js';

const router = express.Router();

// 1. Submit Home Leave Request
router.post('/home-leave', (req, res) => {
  const { studentId, fromDate, toDate, reason } = req.body;
  const student = db.findById('users', studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const newRequest = db.insert('leaveRequests', {
    type: 'HOME_LEAVE',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    fromDate,
    toDate,
    reason,
    parentApproval: 'PENDING',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    passId: null
  });

  // Notify parent
  const parent = db.findOne('users', u => u.role === 'parent' && u.studentRollNumber === student.rollNumber);
  if (parent) {
    db.insert('notifications', {
      recipientRole: 'parent',
      recipientId: parent.id,
      title: 'New Home Leave Request',
      message: `${student.fullName} (${student.rollNumber}) submitted a Home Leave request for ${fromDate} to ${toDate}. Reason: ${reason}`,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  res.json({ success: true, request: newRequest });
});

// 2. Submit Local Entry / Late Return Request
router.post('/local-entry', (req, res) => {
  const { studentId, date, startTime, endTime, reason } = req.body;
  const student = db.findById('users', studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const newRequest = db.insert('localEntryRequests', {
    type: 'LOCAL_ENTRY',
    studentId: student.id,
    studentName: student.fullName,
    studentRollNumber: student.rollNumber,
    hostelName: student.currentHostel,
    roomNumber: student.currentRoom,
    date,
    startTime,
    endTime,
    reason,
    parentApproval: 'PENDING',
    caretakerApproval: 'PENDING',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    passId: null
  });

  // Notify parent
  const parent = db.findOne('users', u => u.role === 'parent' && u.studentRollNumber === student.rollNumber);
  if (parent) {
    db.insert('notifications', {
      recipientRole: 'parent',
      recipientId: parent.id,
      title: 'Local Entry / Late Return Approval Required',
      message: `${student.fullName} has requested to return at ${endTime} on ${date}. Please review.`,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  res.json({ success: true, request: newRequest });
});

// 3. Parent Review Home Leave Request
router.post('/home-leave/parent-action', (req, res) => {
  const { requestId, action, parentName } = req.body; // action: 'APPROVE' | 'REJECT'
  const request = db.findById('leaveRequests', requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (action === 'APPROVE') {
    request.parentApproval = 'APPROVED';
    request.status = 'APPROVED';

    // Generate Digital Pass for home leave
    const passId = `PASS-HOME-${Date.now().toString().slice(-4)}`;
    const pass = db.insert('passes', {
      id: passId,
      passType: 'HOME_LEAVE',
      studentId: request.studentId,
      studentName: request.studentName,
      studentRollNumber: request.studentRollNumber,
      hostel: request.hostelName,
      roomNumber: request.roomNumber,
      date: `${request.fromDate} to ${request.toDate}`,
      startTime: 'Departure',
      endTime: 'Return',
      purpose: `Home Leave: ${request.reason}`,
      parentApproval: `Approved by Parent (${parentName || 'Verified Guardian'})`,
      caretakerApproval: 'Verified by Hostel Caretaker',
      status: 'ACTIVE',
      qrToken: `SHARP-TOKEN-${passId}`,
      issuedAt: new Date().toISOString()
    });

    request.passId = pass.id;
  } else {
    request.parentApproval = 'REJECTED';
    request.status = 'REJECTED';
  }

  db.save();
  res.json({ success: true, request });
});

// 4. Parent Review Local Entry Request (First part of dual approval)
router.post('/local-entry/parent-action', (req, res) => {
  const { requestId, action, parentName } = req.body; // action: 'APPROVE' | 'REJECT'
  const request = db.findById('localEntryRequests', requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (action === 'APPROVE') {
    request.parentApproval = 'APPROVED';
    // If caretaker already approved, generate pass!
    if (request.caretakerApproval === 'APPROVED') {
      request.status = 'APPROVED';
      const pass = generateLocalEntryPass(request, parentName, request.caretakerApprover);
      request.passId = pass.id;
    }
  } else {
    request.parentApproval = 'REJECTED';
    request.status = 'REJECTED'; // Either rejects = rejected (Section 10)
  }

  db.save();
  res.json({ success: true, request });
});

// 5. Caretaker Review Local Entry Request (Second part of dual approval)
router.post('/local-entry/caretaker-action', (req, res) => {
  const { requestId, action, caretakerName } = req.body; // action: 'APPROVE' | 'REJECT'
  const request = db.findById('localEntryRequests', requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (action === 'APPROVE') {
    request.caretakerApproval = 'APPROVED';
    request.caretakerApprover = caretakerName || 'Hostel Caretaker';
    // If parent already approved, generate pass!
    if (request.parentApproval === 'APPROVED') {
      request.status = 'APPROVED';
      const pass = generateLocalEntryPass(request, 'Linked Guardian', request.caretakerApprover);
      request.passId = pass.id;
    }
  } else {
    request.caretakerApproval = 'REJECTED';
    request.status = 'REJECTED'; // Either rejects = rejected (Section 10)
  }

  db.save();
  res.json({ success: true, request });
});

// Helper: Generate local entry digital pass
function generateLocalEntryPass(request, parentName, caretakerName) {
  const passId = `PASS-LOCAL-${Date.now().toString().slice(-4)}`;
  return db.insert('passes', {
    id: passId,
    passType: 'LOCAL_ENTRY',
    studentId: request.studentId,
    studentName: request.studentName,
    studentRollNumber: request.studentRollNumber,
    hostel: request.hostelName,
    roomNumber: request.roomNumber,
    date: request.date,
    startTime: request.startTime,
    endTime: request.endTime,
    purpose: request.reason,
    parentApproval: `Approved by Parent (${parentName || 'Parent'})`,
    caretakerApproval: `Approved by Caretaker (${caretakerName || 'Hostel Caretaker'})`,
    status: 'ACTIVE',
    qrToken: `SHARP-TOKEN-${passId}`,
    issuedAt: new Date().toISOString()
  });
}

// 6. Get Requests for Student
router.get('/student/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const leaves = db.find('leaveRequests', l => l.studentId === studentId);
  const entries = db.find('localEntryRequests', e => e.studentId === studentId);
  const passes = db.find('passes', p => p.studentId === studentId);

  res.json({
    homeLeaves: leaves,
    localEntries: entries,
    passes
  });
});

// 7. Get Requests for Parent (by student roll number)
router.get('/parent/:rollNumber', (req, res) => {
  const rollNumber = req.params.rollNumber;
  const leaves = db.find('leaveRequests', l => l.studentRollNumber === rollNumber);
  const entries = db.find('localEntryRequests', e => e.studentRollNumber === rollNumber);
  const passes = db.find('passes', p => p.studentRollNumber === rollNumber);

  res.json({
    homeLeaves: leaves,
    localEntries: entries,
    passes
  });
});

// 8. Get Requests for Caretaker (by hostel)
router.get('/caretaker/:hostelName', (req, res) => {
  const hostelName = req.params.hostelName;
  const entries = db.find('localEntryRequests', e => e.hostelName.toLowerCase() === hostelName.toLowerCase());
  res.json({ localEntries: entries });
});

export default router;
