// server/routes/admin.js
import express from 'express';
import { db } from '../data/db.js';

const router = express.Router();

// 1. User Management
router.get('/users', (req, res) => {
  const users = db.getCollection('users');
  res.json({ users });
});

router.post('/users/verify', (req, res) => {
  const { userId, verified } = req.body;
  const user = db.update('users', userId, { verified: Boolean(verified) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

router.post('/users/update-cgpa', (req, res) => {
  const { userId, cgpa } = req.body;
  const user = db.update('users', userId, { 
    cgpa: Number(cgpa), 
    cgpaVerified: true 
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

// 2. Hostel Management
router.get('/hostels', (req, res) => {
  const hostels = db.getCollection('hostels');
  res.json({ hostels });
});

router.post('/hostels', (req, res) => {
  const { name, gender, eligibleYears, totalFloors, capacity, caretakerId } = req.body;
  const newHostel = db.insert('hostels', {
    name,
    gender,
    eligibleYears: eligibleYears || [2, 3, 4],
    totalFloors: Number(totalFloors) || 3,
    capacity: Number(capacity) || 120,
    occupied: 0,
    status: 'ACTIVE',
    caretakerId: caretakerId || null
  });
  res.json({ success: true, hostel: newHostel });
});

router.put('/hostels/:id', (req, res) => {
  const updated = db.update('hostels', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Hostel not found' });
  res.json({ success: true, hostel: updated });
});

// 3. Room & Room Pair Management
router.get('/room-pairs', (req, res) => {
  const roomPairs = db.getCollection('roomPairs');
  res.json({ roomPairs });
});

router.post('/room-pairs', (req, res) => {
  const { pairNumber, hostelId, hostelName, floor, room1, room2, sharedWashroom } = req.body;
  const newPair = db.insert('roomPairs', {
    pairNumber,
    hostelId,
    hostelName,
    floor: Number(floor) || 1,
    room1,
    room2,
    sharedWashroom: sharedWashroom || `Shared Washroom ${pairNumber}`,
    capacity: 4,
    status: 'AVAILABLE',
    allocatedClusterId: null,
    occupants: []
  });
  res.json({ success: true, roomPair: newPair });
});

// 4. Dynamic Eligibility Rules (Section 23 & 46: Not hard-coded, stored as data)
router.get('/eligibility-rules', (req, res) => {
  const rules = db.getCollection('eligibilityRules');
  res.json({ rules });
});

router.post('/eligibility-rules', (req, res) => {
  const { academicYear, gender, minCgpa, maxCgpa, eligibleHostels, description } = req.body;
  const newRule = db.insert('eligibilityRules', {
    academicYear: Number(academicYear),
    gender,
    minCgpa: Number(minCgpa),
    maxCgpa: Number(maxCgpa),
    eligibleHostels: Array.isArray(eligibleHostels) ? eligibleHostels : [eligibleHostels],
    description: description || `Year ${academicYear} ${gender} (CGPA ${minCgpa} - ${maxCgpa})`
  });
  res.json({ success: true, rule: newRule });
});

router.delete('/eligibility-rules/:id', (req, res) => {
  const success = db.delete('eligibilityRules', req.params.id);
  res.json({ success });
});

// 5. Semester Management & Deadlines (Section 47)
router.get('/semesters', (req, res) => {
  const semesters = db.getCollection('semesters');
  res.json({ semesters });
});

router.post('/semesters/update', (req, res) => {
  const { id, updates } = req.body;
  const updated = db.update('semesters', id, updates);
  res.json({ success: true, semester: updated });
});

// 6. Allocation Engine Configuration (Section 48)
router.get('/config', (req, res) => {
  res.json({ config: db.getConfig() });
});

router.post('/config', (req, res) => {
  const updated = db.updateConfig(req.body);
  res.json({ success: true, config: updated });
});

// 7. Reset System Data (Demo restore)
router.post('/reset-data', (req, res) => {
  const freshData = db.reset();
  res.json({ success: true, message: 'System data reset to initial demo seeds successfully' });
});

export default router;
