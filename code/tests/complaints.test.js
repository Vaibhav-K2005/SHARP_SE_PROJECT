import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import complaintRoutes from '../server/routes/complaints.js';
import { db } from '../server/data/db.js';

test('complaint lifecycle supports SLA oversight, assignment, and student confirmation', async t => {
  await db.ready;
  const originalData = db.data;
  const originalSave = db.save;
  db.data = {
    users: [
      { id: 'student-1', role: 'student', fullName: 'Test Student', rollNumber: '1001', currentHostel: 'Hostel O', currentRoom: '101' },
      { id: 'caretaker-o', role: 'caretaker', fullName: 'Caretaker O', hostelName: 'Hostel O' },
      { id: 'caretaker-m', role: 'caretaker', fullName: 'Caretaker M', hostelName: 'Hostel M' },
      { id: 'admin-1', role: 'admin', fullName: 'Admin' }
    ],
    complaints: [],
    notifications: [],
    messFeedback: []
  };
  db.save = () => {};

  const app = express();
  app.use(express.json());
  app.use('/api/complaints', complaintRoutes);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.data = originalData;
    db.save = originalSave;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/complaints`;

  const submitRes = await fetch(`${baseUrl}/maintenance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'student-1', category: 'Plumbing', description: 'Leaking tap' })
  });
  assert.equal(submitRes.status, 200);
  const { complaint } = await submitRes.json();
  assert.equal(complaint.caretakerId, 'caretaker-o');
  assert.ok(Date.parse(complaint.slaDeadline) > Date.now());
  assert.equal(complaint.slaEscalatedAt, null);

  const invalidAssign = await fetch(`${baseUrl}/admin/assign`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: complaint.id, caretakerId: 'caretaker-m' })
  });
  assert.equal(invalidAssign.status, 400);

  const assigned = await fetch(`${baseUrl}/admin/assign`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: complaint.id, caretakerId: 'caretaker-o' })
  });
  assert.equal(assigned.status, 200);

  db.findById('complaints', complaint.id).slaDeadline = new Date(Date.now() - 1000).toISOString();
  const queueRes = await fetch(`${baseUrl}/admin/queue`);
  const queue = await queueRes.json();
  assert.equal(queue.complaints[0].slaBreached, true);
  assert.ok(db.findById('complaints', complaint.id).slaEscalatedAt);
  assert.equal(db.data.notifications.filter(n => n.title === 'Complaint SLA breached').length, 1);
  await fetch(`${baseUrl}/admin/queue`);
  assert.equal(db.data.notifications.filter(n => n.title === 'Complaint SLA breached').length, 1);

  const caretakerUpdate = await fetch(`${baseUrl}/update-status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: complaint.id, status: 'RESOLVED', caretakerNotes: 'Tap replaced' })
  });
  assert.equal(caretakerUpdate.status, 200);
  assert.equal((await caretakerUpdate.json()).complaint.status, 'AWAITING_STUDENT_CONFIRMATION');

  const studentConfirm = await fetch(`${baseUrl}/student-resolution`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: complaint.id, studentId: 'student-1', resolved: true })
  });
  assert.equal(studentConfirm.status, 200);
  assert.equal((await studentConfirm.json()).complaint.status, 'CLOSED');
});
