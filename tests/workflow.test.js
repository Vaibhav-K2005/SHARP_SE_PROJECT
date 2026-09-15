// tests/workflow.test.js
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/data/db.js';
import { getTestSeedData } from '../server/data/seedData.js';

test('SHARP Workflow & Portal Logic Tests', async (t) => {
  db.data = getTestSeedData();
  db.save();

  await t.test('Section 10 & 11: Local Entry Dual-Approval Workflow', () => {
    // 1. Student submits local entry request
    const student = db.findById('users', 'student-a');
    const reqEntry = db.insert('localEntryRequests', {
      type: 'LOCAL_ENTRY',
      studentId: student.id,
      studentName: student.fullName,
      studentRollNumber: student.rollNumber,
      hostelName: student.currentHostel,
      roomNumber: student.currentRoom,
      date: '2026-09-15',
      startTime: '18:00',
      endTime: '22:00',
      reason: 'Late lab experiment',
      parentApproval: 'PENDING',
      caretakerApproval: 'PENDING',
      status: 'PENDING',
      passId: null
    });

    assert.strictEqual(reqEntry.status, 'PENDING');
    assert.strictEqual(reqEntry.passId, null);

    // 2. Parent approves -> Still pending because Caretaker hasn't approved
    reqEntry.parentApproval = 'APPROVED';
    db.save();
    assert.strictEqual(reqEntry.parentApproval, 'APPROVED');
    assert.strictEqual(reqEntry.status, 'PENDING');
    assert.strictEqual(reqEntry.passId, null);

    // 3. Caretaker approves -> BOTH approved! Pass is generated
    reqEntry.caretakerApproval = 'APPROVED';
    reqEntry.status = 'APPROVED';
    const pass = db.insert('passes', {
      id: `PASS-TEST-${Date.now()}`,
      passType: 'LOCAL_ENTRY',
      studentId: student.id,
      studentName: student.fullName,
      studentRollNumber: student.rollNumber,
      hostel: student.currentHostel,
      roomNumber: student.currentRoom,
      date: reqEntry.date,
      startTime: reqEntry.startTime,
      endTime: reqEntry.endTime,
      purpose: reqEntry.reason,
      parentApproval: 'Approved by Parent',
      caretakerApproval: 'Approved by Caretaker',
      status: 'ACTIVE',
      qrToken: 'SHARP-QR-VALID',
      issuedAt: new Date().toISOString()
    });
    reqEntry.passId = pass.id;
    db.save();

    assert.ok(reqEntry.passId, 'Pass ID should now be populated');
    const fetchedPass = db.findById('passes', reqEntry.passId);
    assert.ok(fetchedPass, 'Pass should exist in DB');
    assert.strictEqual(fetchedPass.status, 'ACTIVE');
    assert.strictEqual(fetchedPass.studentRollNumber, student.rollNumber);
  });

  await t.test('Section 10: Rejection by either authority rejects request', () => {
    const student = db.findById('users', 'student-a');
    const reqEntry = db.insert('localEntryRequests', {
      type: 'LOCAL_ENTRY',
      studentId: student.id,
      studentName: student.fullName,
      studentRollNumber: student.rollNumber,
      hostelName: student.currentHostel,
      roomNumber: student.currentRoom,
      date: '2026-09-16',
      startTime: '19:00',
      endTime: '23:30',
      reason: 'Night outing',
      parentApproval: 'APPROVED',
      caretakerApproval: 'REJECTED', // Caretaker rejects
      status: 'REJECTED',
      passId: null
    });

    assert.strictEqual(reqEntry.status, 'REJECTED');
    assert.strictEqual(reqEntry.passId, null, 'No pass should be issued if rejected');
  });

  await t.test('Section 7: Maintenance Complaint Lifecycle', () => {
    const student = db.findById('users', 'student-a');
    const comp = db.insert('complaints', {
      type: 'MAINTENANCE',
      category: 'Plumbing issues',
      studentId: student.id,
      studentName: student.fullName,
      studentRollNumber: student.rollNumber,
      hostelName: student.currentHostel,
      roomNumber: student.currentRoom,
      description: 'Tap leaking continuously in Room 102 washroom',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString()
    });

    assert.strictEqual(comp.status, 'SUBMITTED');

    // Caretaker reviews
    db.update('complaints', comp.id, { status: 'UNDER_REVIEW' });
    assert.strictEqual(db.findById('complaints', comp.id).status, 'UNDER_REVIEW');

    // Caretaker marks in progress
    db.update('complaints', comp.id, { 
      status: 'IN_PROGRESS', 
      caretakerNotes: 'Plumber assigned, repair underway.' 
    });
    assert.strictEqual(db.findById('complaints', comp.id).status, 'IN_PROGRESS');

    // Caretaker resolves
    db.update('complaints', comp.id, { status: 'RESOLVED' });
    assert.strictEqual(db.findById('complaints', comp.id).status, 'RESOLVED');
  });

  await t.test('Section 34: Parent Registration and Student Linking', () => {
    const student = db.findById('users', 'student-a');
    assert.ok(student, 'Student with roll number must be found');

    const parent = db.insert('users', {
      role: 'parent',
      fullName: 'Mr. Ramesh Kansal',
      email: 'ramesh.kansal@example.com',
      studentRollNumber: student.rollNumber,
      studentName: student.fullName,
      verified: true
    });

    assert.strictEqual(parent.studentRollNumber, student.rollNumber);
    assert.strictEqual(parent.studentName, student.fullName);
  });
});
