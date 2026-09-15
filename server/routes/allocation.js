// server/routes/allocation.js
import express from 'express';
import { db } from '../data/db.js';
import { AllocationEngine } from '../services/allocationEngine.js';

const router = express.Router();

// 1. Get Allocation Status & Overview
router.get('/status', (req, res) => {
  const activeSemester = db.getActiveSemester();
  const config = db.getConfig();
  const clusters = db.getCollection('clusters');
  const roomPairs = db.getCollection('roomPairs');
  const hostels = db.getCollection('hostels');
  const studentPreferences = db.getCollection('studentPreferences');

  res.json({
    semester: activeSemester,
    config,
    stats: {
      totalClusters: clusters.length,
      formedClusters: clusters.filter(c => c.status === 'FORMED').length,
      prefsSubmitted: clusters.filter(c => c.status === 'PREFERENCES_SUBMITTED').length,
      allocatedClusters: clusters.filter(c => c.status === 'ALLOCATED').length,
      unallocatedClusters: clusters.filter(c => c.status === 'UNALLOCATED').length,
      confirmedClusters: clusters.filter(c => c.status === 'CONFIRMED').length,
      totalRoomPairs: roomPairs.length,
      availableRoomPairs: roomPairs.filter(rp => rp.status === 'AVAILABLE').length,
      totalPreferencesSubmitted: studentPreferences.length
    },
    clusters,
    hostels,
    studentPreferences
  });
});

// 2. Student Submits Pre-Allocation Preference (Option A, B, or C)
router.post('/preference', (req, res) => {
  const { studentId, rollNumber, preferenceOption, partnerRollNumber, clusterRollNumbers, preferredHostels } = req.body;

  if (!studentId || !rollNumber || !preferenceOption) {
    return res.status(400).json({ error: 'Missing studentId, rollNumber, or preferenceOption' });
  }

  const activeSemester = db.getActiveSemester();
  if (!activeSemester || activeSemester.allotmentStatus !== 'ACTIVE') {
    return res.status(403).json({ 
      error: 'Room allotment phase is currently not active. The caretaker has not started the allotment window yet.' 
    });
  }

  const student = db.findById('users', studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // Check if student is already in a formed cluster
  if (student.clusterId) {
    return res.status(400).json({ 
      error: 'You are already a member of a formed cluster. Dissolve your current cluster first to form a new one.' 
    });
  }

  // Check Rule 13: First-year students cannot participate
  if (student.academicYear === 1) {
    return res.status(403).json({ 
      error: 'First-year students are assigned hostels by the college and do not participate in student-driven allocation.' 
    });
  }

  // Validate option specifics
  if (preferenceOption === 'OPTION_B') {
    if (!partnerRollNumber) {
      return res.status(400).json({ error: 'Partner roll number is required for Option B' });
    }
    if (partnerRollNumber.trim().toUpperCase() === rollNumber.trim().toUpperCase()) {
      return res.status(400).json({ error: 'You cannot select yourself as a roommate' });
    }
    const cleanPartnerRoll = partnerRollNumber.trim().toUpperCase();
    const existingPartner = db.findOne('users', u => u.rollNumber?.toUpperCase() === cleanPartnerRoll);
    if (existingPartner && existingPartner.clusterId) {
      return res.status(400).json({ error: `Partner student (${cleanPartnerRoll}) is already in a formed cluster.` });
    }
  }

  let createdCluster = null;

  if (preferenceOption === 'OPTION_C') {
    if (!Array.isArray(clusterRollNumbers) || clusterRollNumbers.length !== 4) {
      return res.status(400).json({ error: 'Option C requires exactly 4 student roll numbers' });
    }
    
    // Normalize rolls to uppercase trimmed strings
    const normalizedRolls = clusterRollNumbers.map(r => String(r).trim().toUpperCase());
    const uniqueRolls = new Set(normalizedRolls);
    if (uniqueRolls.size !== 4) {
      return res.status(400).json({ error: 'Option C requires 4 distinct, non-duplicate roll numbers' });
    }

    if (!normalizedRolls.includes(rollNumber.trim().toUpperCase())) {
      return res.status(400).json({ error: 'Your roll number must be included in the 4 cluster members' });
    }

    // Check none of the 4 students are already in an existing cluster
    const usersColl = db.getCollection('users');
    for (const r of normalizedRolls) {
      const existing = usersColl.find(u => u.rollNumber && u.rollNumber.toUpperCase() === r);
      if (existing && existing.clusterId) {
        return res.status(400).json({ error: `Student with roll number ${r} is already assigned to another cluster.` });
      }
    }

    // Resolve or auto-register member accounts
    const members = [];
    for (const r of normalizedRolls) {
      let member = usersColl.find(u => u.rollNumber && u.rollNumber.toUpperCase() === r);
      if (!member) {
        // Auto-provision placeholder student profile so cluster is fully formed
        member = db.insert('users', {
          role: 'student',
          fullName: `Student (${r})`,
          rollNumber: r,
          email: `${r.toLowerCase()}@thapar.edu`,
          academicYear: student.academicYear || 3,
          admissionYear: 2026 - (student.academicYear || 3),
          course: student.course || 'B.Tech',
          gender: student.gender || 'Male',
          cgpa: 8.00,
          cgpaVerified: true,
          currentHostel: student.currentHostel || 'Hostel M',
          currentRoom: 'TBD',
          currentRoommates: [],
          verified: true,
          clusterId: null,
          allocationStatus: 'PRE_ALLOCATION'
        });
      }
      members.push(member);
    }

    // Calculate cluster average CGPA and determine eligible hostels
    const avgCgpa = AllocationEngine.calculateClusterCgpa(members);
    const eligibleHostels = AllocationEngine.determineEligibleHostels(student.academicYear, student.gender, avgCgpa);

    const clustersColl = db.getCollection('clusters');
    const nextClusterNumber = Math.max(0, ...clustersColl.map(c => c.clusterNumber || 0)) + 1;
    const clusterId = `cluster-${nextClusterNumber}`;

    createdCluster = {
      id: clusterId,
      clusterNumber: nextClusterNumber,
      leaderId: student.id,
      memberIds: members.map(m => m.id),
      memberRolls: normalizedRolls,
      gender: student.gender,
      academicYear: student.academicYear,
      averageCgpa: avgCgpa,
      eligibleHostels: eligibleHostels,
      preferences: [],
      status: 'FORMED',
      assignedRoomPairId: null,
      paymentStatus: 'PENDING'
    };

    clustersColl.push(createdCluster);

    // Assign clusterId and allocationStatus to all 4 members
    members.forEach(m => {
      m.clusterId = clusterId;
      m.allocationStatus = 'CLUSTER_FORMED';
    });
  }

  const preferencesColl = db.getCollection('studentPreferences');
  const cleanRoll = rollNumber.trim().toUpperCase();
  const existingIndex = preferencesColl.findIndex(p => p.rollNumber?.toUpperCase() === cleanRoll);

  const prefEntry = {
    id: `pref-${cleanRoll}`,
    studentId,
    rollNumber: cleanRoll,
    preferenceOption,
    partnerRollNumber: partnerRollNumber ? partnerRollNumber.trim().toUpperCase() : null,
    clusterRollNumbers: clusterRollNumbers ? clusterRollNumbers.map(r => String(r).trim().toUpperCase()) : null,
    preferredHostels: preferredHostels || [],
    status: createdCluster ? 'CLUSTERED' : 'PENDING_FORMATION',
    clusterId: createdCluster ? createdCluster.id : null,
    submittedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    preferencesColl[existingIndex] = prefEntry;
  } else {
    preferencesColl.push(prefEntry);
  }

  db.save();
  res.json({ 
    success: true, 
    preference: prefEntry, 
    cluster: createdCluster,
    message: createdCluster ? 'Cluster formed successfully! Your group of 4 is locked into Cluster #' + createdCluster.clusterNumber : 'Preference saved successfully! Waiting for Caretaker cluster formation.' 
  });
});

// 3. Caretaker / Admin Trigger: Form Clusters (Phase 2)
router.post('/form-clusters', (req, res) => {
  try {
    const result = AllocationEngine.formClusters();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Cluster Leader Submits 3 Room Preferences (Phase 4)
router.post('/submit-preferences', (req, res) => {
  const { clusterId, leaderId, preferences } = req.body;
  try {
    const result = AllocationEngine.submitRoomPreferences(clusterId, leaderId, preferences);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Change Cluster Leader (Section 26)
router.post('/change-leader', (req, res) => {
  const { clusterId, newLeaderId } = req.body;
  try {
    const result = AllocationEngine.changeClusterLeader(clusterId, newLeaderId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Caretaker / Admin Trigger: Run Allocation Engine (Phase 5 & 6)
router.post('/run-engine', (req, res) => {
  try {
    const result = AllocationEngine.runAllocationEngine();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Caretaker Manual Assignment for Unallocated Cluster (Section 30)
router.post('/manual-assign', (req, res) => {
  const { clusterId, roomPairId } = req.body;
  try {
    const result = AllocationEngine.manualAssignRoomPair(clusterId, roomPairId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Student / Cluster Fee Payment (Phase 7) & Live Confirmation (Phase 8)
router.post('/pay-fees', (req, res) => {
  const { clusterId, studentId, amount, method } = req.body;
  try {
    const result = AllocationEngine.processPayment(clusterId, studentId, amount, method);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Get Specific Cluster Details
router.get('/cluster/:id', (req, res) => {
  const cluster = db.findById('clusters', req.params.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const users = db.getCollection('users');
  const members = cluster.memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);
  const leader = users.find(u => u.id === cluster.leaderId);

  res.json({
    cluster,
    members,
    leader
  });
});

// 10. Get Hostel Room Pairs for Visual Map
router.get('/hostel-map/:hostelName', (req, res) => {
  const hostelName = req.params.hostelName;
  const roomPairs = db.find('roomPairs', rp => rp.hostelName.toLowerCase() === hostelName.toLowerCase());
  
  // Group by floor
  const floors = {};
  roomPairs.forEach(rp => {
    if (!floors[rp.floor]) floors[rp.floor] = [];
    floors[rp.floor].push(rp);
  });

  res.json({
    hostelName,
    floors,
    totalPairs: roomPairs.length,
    availablePairs: roomPairs.filter(rp => rp.status === 'AVAILABLE').length
  });
});

// 11. Advance/Set Allocation Phase Manually (for Admin/Caretaker Testing)
router.post('/set-phase', (req, res) => {
  const { phase } = req.body;
  const phaseNum = Number(phase);
  if (isNaN(phaseNum) || phaseNum < 1 || phaseNum > 8) {
    return res.status(400).json({ error: 'Phase must be an integer from 1 to 8' });
  }
  const updated = db.updateActiveSemesterPhase(phaseNum);
  res.json({ success: true, activeSemester: updated, currentPhase: phaseNum });
});

// 12. Caretaker / Admin: Start Allotment Phase
router.post('/start-phase', (req, res) => {
  const { phase } = req.body;
  const targetPhase = phase ? Number(phase) : 1;
  const updated = db.startAllotmentPhase(targetPhase);
  res.json({ 
    success: true, 
    message: `Room allotment phase started successfully (Phase ${targetPhase}).`,
    semester: updated 
  });
});

// 13. Caretaker / Admin: End Allotment Phase
router.post('/end-phase', (req, res) => {
  const updated = db.endAllotmentPhase();
  res.json({ 
    success: true, 
    message: 'Room allotment phase has been officially ended/closed.',
    semester: updated 
  });
});

// 14. Caretaker / Admin: Reset Allotment Phase
router.post('/reset-phase', (req, res) => {
  const updated = db.resetAllotmentPhase();
  res.json({ 
    success: true, 
    message: 'Room allotment phase reset to Not Started.',
    semester: updated 
  });
});

// 15. Student Leader: Dissolve Cluster (Phase 1 or Phase 2)
router.post('/dissolve-cluster', (req, res) => {
  const { clusterId, studentId } = req.body;
  if (!clusterId || !studentId) {
    return res.status(400).json({ error: 'Missing clusterId or studentId' });
  }

  const cluster = db.findById('clusters', clusterId);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  if (cluster.leaderId !== studentId) {
    return res.status(403).json({ error: 'Only the designated cluster leader can dissolve this cluster.' });
  }

  if (['ALLOCATED', 'CONFIRMED'].includes(cluster.status)) {
    return res.status(400).json({ 
      error: 'Cannot dissolve cluster because rooms have already been allocated or confirmed.' 
    });
  }

  const users = db.getCollection('users');
  // Unbind all 4 members
  cluster.memberIds.forEach(mId => {
    const u = users.find(user => user.id === mId);
    if (u) {
      u.clusterId = null;
      u.allocationStatus = 'PRE_ALLOCATION';
    }
  });

  // Remove matching student preference
  const prefs = db.getCollection('studentPreferences');
  const prefIndex = prefs.findIndex(p => p.clusterId === clusterId || (cluster.memberRolls && p.clusterRollNumbers?.includes(cluster.memberRolls[0])));
  if (prefIndex >= 0) {
    prefs.splice(prefIndex, 1);
  }

  // Delete cluster from collection
  db.delete('clusters', clusterId);
  db.save();

  res.json({ 
    success: true, 
    message: 'Cluster dissolved successfully. Members can now re-form or submit new preferences.' 
  });
});

export default router;
