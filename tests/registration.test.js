// tests/registration.test.js
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/data/db.js';

test('Real Thapar Email Verification & Student/Parent Registration Flow', async (t) => {
  try {
    await fetch('http://localhost:3000/api/admin/reset-data', { method: 'POST' });
  } catch (e) {}
  db.reset();

  const timestamp = Date.now();
  const thaparEmail = `vaibhav.test${timestamp}@thapar.edu`;
  const invalidEmail = 'vaibhav.student@gmail.com';
  const studentRoll = '1024160999';
  const parentEmail = `rajiv.test${timestamp}@gmail.com`;

  await t.test('Domain Validation: Non-thapar email rejected for students', async () => {
    const res = await fetch('http://localhost:3000/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invalidEmail, role: 'student' })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('@thapar.edu'), 'Should enforce @thapar.edu domain');
  });

  let verificationCode = null;
  await t.test('Send OTP: Valid @thapar.edu generates 6-digit verification code', async () => {
    const res = await fetch('http://localhost:3000/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: thaparEmail, role: 'student' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.verificationCode);
    assert.strictEqual(data.verificationCode.length, 6);
    verificationCode = data.verificationCode;
  });

  await t.test('Verify Code: Valid OTP verifies official email', async () => {
    const res = await fetch('http://localhost:3000/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: thaparEmail, code: verificationCode })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  await t.test('Complete Student Profile with Parent Details', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'student',
        email: thaparEmail,
        fullName: 'Vaibhav Kansal Real',
        rollNumber: studentRoll,
        academicYear: 3,
        course: 'B.Tech Computer Science',
        gender: 'Male',
        currentHostel: 'Hostel M',
        currentRoom: '203',
        cgpa: 9.15,
        parentName: 'Rajiv Kansal',
        parentEmail: parentEmail,
        parentPhone: '+91 94140 12345',
        phone: '+91 98765 00000',
        address: 'Patiala, Punjab'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.rollNumber, studentRoll);
    assert.strictEqual(data.user.parentName, 'Rajiv Kansal');
    assert.strictEqual(data.user.parentEmail, parentEmail);
  });

  await t.test('Parent Lookup: Parent enters student roll number and verifies relationship', async () => {
    const res = await fetch(`http://localhost:3000/api/auth/lookup-student/${studentRoll}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.found, true);
    assert.strictEqual(data.student.fullName, 'Vaibhav Kansal Real');
    assert.strictEqual(data.student.currentHostel, 'Hostel M');
    assert.strictEqual(data.student.parentEmail, parentEmail);
  });

  await t.test('Parent Registration: Register parent using student roll number and email ID', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'parent',
        studentRollNumber: studentRoll,
        fullName: 'Rajiv Kansal',
        email: parentEmail,
        phone: '+91 94140 12345'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.role, 'parent');
    assert.strictEqual(data.user.studentRollNumber, studentRoll);
    assert.strictEqual(data.linkedStudent.fullName, 'Vaibhav Kansal Real');
  });

  await t.test('Login Verification: Both newly created student and parent can login', async () => {
    // Student Login
    const stuLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student', email: thaparEmail })
    });
    assert.strictEqual(stuLogin.status, 200);
    const stuData = await stuLogin.json();
    assert.strictEqual(stuData.user.rollNumber, studentRoll);

    // Parent Login
    const parLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'parent', email: parentEmail })
    });
    assert.strictEqual(parLogin.status, 200);
    const parData = await parLogin.json();
    assert.strictEqual(parData.user.studentRollNumber, studentRoll);
    assert.strictEqual(parData.linkedStudent.fullName, 'Vaibhav Kansal Real');
  });

  // Clean up test data after test suite finishes
  try {
    await fetch('http://localhost:3000/api/admin/reset-data', { method: 'POST' });
  } catch (e) {}
  db.reset();
});
