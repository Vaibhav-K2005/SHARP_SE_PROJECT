import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import complaintRoutes from '../server/routes/complaints.js';
import { db } from '../server/data/db.js';

test('student mess feedback remains anonymous to mess managers', async t => {
  await db.ready;
  const originalData = db.data;
  const originalSave = db.save;
  db.data = {
    users: [
      { id: 'student-1', role: 'student', fullName: 'Test Student', currentHostel: 'Hostel O' },
      { id: 'mess-manager-o', role: 'mess_manager', messName: 'Hostel O Mess' },
      { id: 'mess-manager-m', role: 'mess_manager', messName: 'Hostel M Mess' }
    ],
    messFeedback: [],
    notifications: []
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
  const submitResponse = await fetch(`${baseUrl}/mess-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'student-1',
      mealType: 'Lunch',
      category: 'Food Quality',
      rating: 2,
      comments: 'The food was cold.'
    })
  });
  const submitted = await submitResponse.json();

  assert.equal(submitResponse.status, 200);
  assert.equal(submitted.feedback.reporterId, undefined);
  assert.equal(db.data.messFeedback[0].reporterId, 'student-1');
  assert.equal(db.data.notifications[0].recipientId, 'mess-manager-o');

  const managerResponse = await fetch(`${baseUrl}/mess-feedback/manager/mess-manager-o`);
  const managerData = await managerResponse.json();
  assert.equal(managerData.feedback.length, 1);
  assert.equal(managerData.feedback[0].comments, 'The food was cold.');
  assert.equal(managerData.feedback[0].reporterId, undefined);

  const otherManagerResponse = await fetch(`${baseUrl}/mess-feedback/manager/mess-manager-m`);
  const otherManagerData = await otherManagerResponse.json();
  assert.equal(otherManagerData.feedback.length, 0);
});
