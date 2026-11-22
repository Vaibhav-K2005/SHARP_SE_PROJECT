import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import leaveRoutes from '../server/routes/leaves.js';
import complaintRoutes from '../server/routes/complaints.js';
import { db } from '../server/data/db.js';

test('home leave approvals, QR codes, and laundry staff workflow', async t => {
  await db.ready;
  const originalData = db.data;
  const originalSave = db.save;
  db.data = {
    users: [
      { id: 'student-1', role: 'student', fullName: 'Test Student', rollNumber: '1001', currentHostel: 'Hostel O', currentRoom: '101' },
      { id: 'parent-1', role: 'parent', fullName: 'Test Parent', studentRollNumber: '1001' },
      { id: 'admin-1', role: 'admin', fullName: 'Test Admin' },
      { id: 'laundry-1', role: 'laundry_staff', fullName: 'Laundry Staff', hostelName: 'Hostel O' }
    ],
    leaveRequests: [], localEntryRequests: [], passes: [], complaints: [], notifications: [], messFeedback: []
  };
  db.save = () => {};

  const app = express();
  app.use(express.json());
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/complaints', complaintRoutes);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.data = originalData;
    db.save = originalSave;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const submittedLeave = await fetch(`${baseUrl}/api/leaves/home-leave`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'student-1', fromDate: '2026-10-01', toDate: '2026-10-03', reason: 'Family visit' })
  });
  const leave = (await submittedLeave.json()).request;
  assert.equal(leave.parentApproval, 'PENDING');
  assert.equal(leave.adminApproval, 'PENDING');
  assert.equal(leave.passId, null);

  const parentAction = await fetch(`${baseUrl}/api/leaves/home-leave/parent-action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: leave.id, action: 'APPROVE', parentName: 'Test Parent' })
  });
  assert.equal(parentAction.status, 200);
  assert.equal((await parentAction.json()).request.status, 'PENDING_ADMIN');
  assert.equal(db.data.passes.length, 0);

  const adminQueue = await fetch(`${baseUrl}/api/leaves/admin/home-leaves`);
  assert.equal((await adminQueue.json()).requests.length, 1);
  const adminAction = await fetch(`${baseUrl}/api/leaves/home-leave/admin-action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: leave.id, action: 'APPROVE', adminName: 'Test Admin' })
  });
  const approved = await adminAction.json();
  assert.equal(adminAction.status, 200);
  assert.equal(approved.request.status, 'APPROVED');
  assert.ok(approved.pass.qrToken);
  assert.notEqual(approved.pass.qrToken, `SHARP-TOKEN-${approved.pass.id}`);

  const qrResponse = await fetch(`${baseUrl}/api/leaves/passes/${approved.pass.id}/qr`);
  const qrSvg = await qrResponse.text();
  assert.equal(qrResponse.status, 200);
  assert.match(qrResponse.headers.get('content-type'), /image\/svg\+xml/);
  assert.ok(qrSvg.startsWith('<svg'));

  const submittedLaundry = await fetch(`${baseUrl}/api/complaints/laundry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'student-1', category: 'Missing clothing item', description: 'Blue jacket was not returned' })
  });
  const laundry = (await submittedLaundry.json()).complaint;
  assert.equal(laundry.laundryStaffId, 'laundry-1');
  const staffQueue = await fetch(`${baseUrl}/api/complaints/laundry/staff/laundry-1`);
  assert.equal((await staffQueue.json()).complaints.length, 1);

  const staffUpdate = await fetch(`${baseUrl}/api/complaints/laundry/update-status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: laundry.id, staffId: 'laundry-1', status: 'RESOLVED', notes: 'Found at the desk' })
  });
  assert.equal((await staffUpdate.json()).complaint.status, 'AWAITING_STUDENT_CONFIRMATION');
  const confirm = await fetch(`${baseUrl}/api/complaints/student-resolution`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaintId: laundry.id, studentId: 'student-1', resolved: true })
  });
  assert.equal((await confirm.json()).complaint.status, 'CLOSED');
});
