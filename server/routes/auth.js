import express from 'express';
import { db } from '../data/db.js';
import { parseRollNumber } from '../utils/rollParser.js';

const router = express.Router();

// Mock email verification code store
const verificationCodes = new Map();

// Helper to check official Thapar institutional domain
function isOfficialEmail(email) {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].trim().toLowerCase();
  // Valid Thapar official domains
  return domain === 'thapar.edu' || domain.endsWith('.thapar.edu') || domain === 'thapar.ac.in';
}

// 1. Send verification code for registration
router.post('/send-verification', (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Student registration requires official @thapar.edu email
  if (role === 'student' && !isOfficialEmail(cleanEmail)) {
    return res.status(400).json({ 
      error: 'Students must register using an official institutional email address ending with @thapar.edu' 
    });
  }

  // Check if account already exists
  const existing = db.findOne('users', u => u.email.toLowerCase() === cleanEmail && (!role || u.role === role));
  if (existing) {
    return res.status(400).json({ error: `An account with ${cleanEmail} already exists. Please log in instead.` });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes.set(cleanEmail, {
    code,
    role,
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
  });

  // Return code in response for seamless UI display & testing
  res.json({
    success: true,
    message: `Verification code successfully generated for ${cleanEmail}`,
    verificationCode: code
  });
});

// 2. Verify code
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const entry = verificationCodes.get(cleanEmail);

  if (!entry || entry.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  if (Date.now() > entry.expiresAt) {
    verificationCodes.delete(cleanEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  // Code verified! Keep record verified for completion
  entry.verified = true;
  res.json({ 
    success: true, 
    message: 'Official email successfully verified! Proceed to profile completion.' 
  });
});

// 3. Lookup student by Roll Number (for Parent Registration & Live Confirmation)
router.get('/lookup-student/:rollNumber', (req, res) => {
  const rollNumber = req.params.rollNumber?.trim();
  if (!rollNumber) {
    return res.status(400).json({ error: 'Roll number is required' });
  }

  const student = db.findOne('users', u => 
    u.role === 'student' && u.rollNumber?.toLowerCase() === rollNumber.toLowerCase()
  );

  if (!student) {
    return res.json({ 
      found: false, 
      message: `No student registered with Roll Number "${rollNumber}". Ensure the student registers first.` 
    });
  }

  const rollInfo = parseRollNumber(student.rollNumber);

  res.json({
    found: true,
    student: {
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      email: student.email,
      academicYear: student.academicYear,
      admissionYear: rollInfo.admissionYear,
      course: student.course,
      gender: student.gender,
      currentHostel: student.currentHostel,
      currentRoom: student.currentRoom,
      parentEmail: student.parentEmail || '',
      parentName: student.parentName || ''
    }
  });
});

// 4. Register user
router.post('/register', (req, res) => {
  const {
    role,
    email,
    fullName,
    rollNumber,
    academicYear,
    course,
    gender,
    currentHostel,
    currentRoom,
    cgpa,
    parentName,
    parentEmail,
    parentPhone,
    phone,
    address,
    studentRollNumber // for parent
  } = req.body;

  if (!role || !email || !fullName) {
    return res.status(400).json({ error: 'Role, Full Name, and Email are required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  const existingUser = db.findOne('users', u => u.email.toLowerCase() === cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email address already exists' });
  }

  if (role === 'student') {
    if (!isOfficialEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Students must use an official @thapar.edu email address' });
    }

    if (!rollNumber || !gender || !currentHostel) {
      return res.status(400).json({ error: 'Please provide all required profile fields (Roll Number, Gender, Current Hostel)' });
    }

    const cleanRoll = rollNumber.trim().toUpperCase();
    const rollInfo = parseRollNumber(cleanRoll);
    const resolvedAcademicYear = academicYear ? Number(academicYear) : rollInfo.academicYear;

    // Check if roll number already exists
    const existingRoll = db.findOne('users', u => u.role === 'student' && u.rollNumber?.toUpperCase() === cleanRoll);
    if (existingRoll) {
      return res.status(400).json({ error: `A student with roll number ${cleanRoll} is already registered` });
    }

    const parsedCgpa = (cgpa !== undefined && cgpa !== '' && !isNaN(Number(cgpa))) ? Number(cgpa) : 8.0;

    const newUser = db.insert('users', {
      role: 'student',
      fullName: fullName.trim(),
      rollNumber: cleanRoll,
      email: cleanEmail,
      academicYear: resolvedAcademicYear,
      admissionYear: rollInfo.admissionYear,
      course: course?.trim() || 'B.Tech Computer Engineering',
      gender,
      cgpa: Math.round(parsedCgpa * 100) / 100,
      cgpaVerified: true,
      currentHostel,
      currentRoom: currentRoom?.trim() || '101',
      currentRoommates: [],
      parentName: parentName?.trim() || '',
      parentEmail: parentEmail ? parentEmail.trim().toLowerCase() : '',
      parentPhone: parentPhone?.trim() || '',
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      verified: true,
      clusterId: null,
      allocationStatus: resolvedAcademicYear === 1 ? 'FIRST_YEAR_ASSIGNED' : 'PRE_ALLOCATION'
    });

    return res.json({ 
      success: true, 
      user: newUser,
      message: 'Student account created and profile completed successfully!'
    });
  }

  if (role === 'parent') {
    if (!studentRollNumber) {
      return res.status(400).json({ error: 'Student Roll Number is required for parent registration' });
    }

    const cleanStudentRoll = studentRollNumber.trim().toUpperCase();
    const student = db.findOne('users', u => u.role === 'student' && u.rollNumber?.toUpperCase() === cleanStudentRoll);
    if (!student) {
      return res.status(404).json({ 
        error: `Student with roll number "${cleanStudentRoll}" was not found. Please ensure the student creates their account first.` 
      });
    }

    const newParent = db.insert('users', {
      role: 'parent',
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: parentPhone || phone || '',
      studentRollNumber: student.rollNumber,
      studentName: student.fullName,
      verified: true
    });

    // Update parent info in student record if empty
    if (!student.parentEmail) {
      student.parentEmail = cleanEmail;
      student.parentName = fullName.trim();
      db.save();
    }

    return res.json({ 
      success: true, 
      user: newParent, 
      linkedStudent: student,
      message: `Parent registered and linked to ${student.fullName} (${student.rollNumber})!`
    });
  }

  if (role === 'caretaker') {
    const hostelName = req.body.hostelName;
    if (!hostelName) {
      return res.status(400).json({ error: 'Please select an assigned hostel for the caretaker' });
    }

    const hostel = db.findOne('hostels', h => h.name === hostelName || h.id === req.body.hostelId);
    const newCaretaker = db.insert('users', {
      role: 'caretaker',
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      verified: true,
      hostelId: hostel ? hostel.id : (req.body.hostelId || null),
      hostelName: hostel ? hostel.name : hostelName
    });

    if (hostel) {
      hostel.caretakerId = newCaretaker.id;
      db.save();
    }

    return res.json({ 
      success: true, 
      user: newCaretaker,
      message: `Caretaker ${newCaretaker.fullName} registered for ${hostel ? hostel.name : hostelName}!`
    });
  }

  // Admin / other
  const newUser = db.insert('users', {
    role,
    fullName: fullName.trim(),
    email: cleanEmail,
    phone: phone || '',
    verified: true,
    hostelId: req.body.hostelId || null,
    hostelName: req.body.hostelName || null
  });

  res.json({ success: true, user: newUser });
});

// 5. Login
router.post('/login', (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  const user = db.findOne('users', u => 
    u.email.toLowerCase() === cleanEmail && 
    (!role || u.role === role)
  );

  if (!user) {
    return res.status(404).json({ 
      error: `No account found with email "${cleanEmail}"${role ? ' and role ' + role : ''}. Please register first.` 
    });
  }

  // For parent, also fetch linked student info
  let linkedStudent = null;
  if (user.role === 'parent' && user.studentRollNumber) {
    linkedStudent = db.findOne('users', u => u.rollNumber === user.studentRollNumber);
  }

  res.json({
    success: true,
    user,
    linkedStudent
  });
});

// 6. Get all users grouped by role for the Demo Switcher
router.get('/demo-users', (req, res) => {
  const users = db.getCollection('users');
  res.json({
    students: users.filter(u => u.role === 'student'),
    parents: users.filter(u => u.role === 'parent'),
    caretakers: users.filter(u => u.role === 'caretaker'),
    admins: users.filter(u => u.role === 'admin')
  });
});

export default router;
