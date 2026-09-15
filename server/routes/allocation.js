// server/routes/allocation.js
import express from 'express';
import { db } from '../data/db.js';
import { AllocationEngine } from '../services/allocationEngine.js';

const router = express.Router();

function buildPendingMembers(members, leaderId) {
  return members.map(member => ({
    studentId: member.id,
    rollNumber: member.rollNumber,
    fullName: member.fullName,
    status: member.id === leaderId ? 'APPROVED' : 'PENDING',
    respondedAt: member.id === leaderId ? new Date().toISOString() : null
  }));
}

function finalizeClusterIfApproved(cluster) {
  const allApproved = cluster.pendingMembers?.every(m => m.status === 'APPROVED');
  if (!allApproved) return false;

  cluster.status = 'FORMED';
  cluster.memberIds = cluster.pendingMembers.map(m => m.studentId);
  cluster.memberRolls = cluster.pendingMembers.map(m => m.rollNumber);

  const users = db.getCollection('users');
  cluster.memberIds.forEach(memberId => {
    const user = users.find(u => u.id === memberId);
    if (user) {
      user.clusterId = cluster.id;
      user.allocationStatus = 'CLUSTER_FORMED';
    }
  });

  const members = cluster.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean);
  cluster.averageCgpa = AllocationEngine.calculateClusterCgpa(members);
  cluster.eligibleHostels = AllocationEngine.determineEligibleHostels(cluster.academicYear, cluster.gender, cluster.averageCgpa);
  return true;
}

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

    const usersColl = db.getCollection('users');
    const members = [];
    for (const r of normalizedRolls) {
      const member = usersColl.find(u => u.role === 'student' && u.rollNumber && u.rollNumber.toUpperCase() === r);
      if (!member) {
        return res.status(404).json({ error: `Student with roll number ${r} is not registered yet. Ask them to register before inviting them to a cluster.` });
      }
      if (member.clusterId) {
        return res.status(400).json({ error: `Student with roll number ${r} is already assigned to another cluster.` });
      }
      const pendingElsewhere = db.findOne('clusters', c =>
        c.status === 'PENDING_APPROVAL' &&
        c.pendingMembers?.some(pm => pm.rollNumber === r && pm.status === 'PENDING')
      );
      if (pendingElsewhere) {
        return res.status(400).json({ error: `Student with roll number ${r} already has a pending cluster invitation.` });
      }
      members.push(member);
    }

    const clustersColl = db.getCollection('clusters');
    const nextClusterNumber = Math.max(0, ...clustersColl.map(c => c.clusterNumber || 0)) + 1;
    const clusterId = `cluster-${nextClusterNumber}`;
    const pendingMembers = buildPendingMembers(members, student.id);

    createdCluster = {
      id: clusterId,
      clusterNumber: nextClusterNumber,
      leaderId: student.id,
      memberIds: [student.id],
      memberRolls: [student.rollNumber],
      pendingMembers,
      gender: student.gender,
      academicYear: student.academicYear,
      averageCgpa: 0,
      eligibleHostels: [],
      preferences: [],
      status: 'PENDING_APPROVAL',
      assignedRoomPairId: null,
      paymentStatus: 'PENDING'
    };

    clustersColl.push(createdCluster);
    members.forEach(member => {
      member.clusterId = clusterId;
      member.allocationStatus = member.id === student.id ? 'AWAITING_CLUSTER_APPROVALS' : 'CLUSTER_INVITED';
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
    status: createdCluster ? 'PENDING_APPROVALS' : 'PENDING_FORMATION',
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
    message: createdCluster ? 'Cluster invitation sent. Room selection unlocks after all invited students approve Cluster #' + createdCluster.clusterNumber : 'Preference saved successfully! Waiting for Caretaker cluster formation.' 
  });
});

// 3. Student: pending cluster invitations and responses
router.get('/cluster-invitations/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const clusters = db.getCollection('clusters');
  const invitations = clusters.filter(c =>
    c.status === 'PENDING_APPROVAL' &&
    c.pendingMembers?.some(pm => pm.studentId === studentId && pm.status === 'PENDING')
  );
  res.json({ invitations });
});

router.post('/cluster-invitations/respond', (req, res) => {
  const { clusterId, studentId, decision } = req.body;
  if (!clusterId || !studentId || !['APPROVED', 'DENIED'].includes(decision)) {
    return res.status(400).json({ error: 'clusterId, studentId, and decision APPROVED/DENIED are required' });
  }

  const cluster = db.findById('clusters', clusterId);
  if (!cluster || cluster.status !== 'PENDING_APPROVAL') {
    return res.status(404).json({ error: 'Pending cluster invitation not found' });
  }

  const member = cluster.pendingMembers?.find(pm => pm.studentId === studentId);
  if (!member) return res.status(404).json({ error: 'You are not invited to this cluster' });
  if (member.status !== 'PENDING') return res.status(400).json({ error: 'You have already responded to this invitation' });

  member.status = decision;
  member.respondedAt = new Date().toISOString();

  if (decision === 'DENIED') {
    const deniedUser = db.findById('users', studentId);
    if (deniedUser) {
      deniedUser.clusterId = null;
      deniedUser.allocationStatus = 'PRE_ALLOCATION';
    }
    cluster.status = 'NEEDS_REPLACEMENT';
  } else {
    finalizeClusterIfApproved(cluster);
  }

  db.save();
  res.json({ success: true, cluster, message: decision === 'APPROVED' ? 'Cluster invitation approved.' : 'Cluster invitation denied. The leader can invite a replacement.' });
});

router.post('/cluster-invitations/replace-member', (req, res) => {
  const { clusterId, leaderId, oldRollNumber, newRollNumber } = req.body;
  if (!clusterId || !leaderId || !oldRollNumber || !newRollNumber) {
    return res.status(400).json({ error: 'clusterId, leaderId, oldRollNumber, and newRollNumber are required' });
  }

  const cluster = db.findById('clusters', clusterId);
  if (!cluster || !['PENDING_APPROVAL', 'NEEDS_REPLACEMENT'].includes(cluster.status)) {
    return res.status(404).json({ error: 'Editable pending cluster not found' });
  }
  if (cluster.leaderId !== leaderId) {
    return res.status(403).json({ error: 'Only the cluster leader can replace invited students.' });
  }

  const oldRoll = String(oldRollNumber).trim().toUpperCase();
  const newRoll = String(newRollNumber).trim().toUpperCase();
  if (cluster.pendingMembers.some(pm => pm.rollNumber === newRoll)) {
    return res.status(400).json({ error: 'New roll number is already in this cluster invitation.' });
  }

  const users = db.getCollection('users');
  const newStudent = users.find(u => u.role === 'student' && u.rollNumber?.toUpperCase() === newRoll);
  if (!newStudent) return res.status(404).json({ error: `Student ${newRoll} is not registered yet.` });
  if (newStudent.clusterId) return res.status(400).json({ error: `Student ${newRoll} is already assigned to another cluster.` });

  const replaceIndex = cluster.pendingMembers.findIndex(pm => pm.rollNumber === oldRoll && pm.studentId !== leaderId);
  if (replaceIndex === -1) return res.status(404).json({ error: 'Replaceable invited member not found.' });

  const oldStudent = users.find(u => u.rollNumber?.toUpperCase() === oldRoll);
  if (oldStudent) {
    oldStudent.clusterId = null;
    oldStudent.allocationStatus = 'PRE_ALLOCATION';
  }

  cluster.pendingMembers[replaceIndex] = {
    studentId: newStudent.id,
    rollNumber: newStudent.rollNumber,
    fullName: newStudent.fullName,
    status: 'PENDING',
    respondedAt: null
  };
  newStudent.clusterId = cluster.id;
  newStudent.allocationStatus = 'CLUSTER_INVITED';
  cluster.status = 'PENDING_APPROVAL';
  db.save();

  res.json({ success: true, cluster, message: `Replacement invitation sent to ${newStudent.fullName}.` });
});

// 4. Caretaker / Admin Trigger: Form Clusters (Phase 2)
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

// 6. Caretaker / Admin Trigger: Run Allocation (Phase 5 & 6)
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
  const memberIds = cluster.status === 'PENDING_APPROVAL' || cluster.status === 'NEEDS_REPLACEMENT'
    ? (cluster.pendingMembers || []).map(m => m.studentId)
    : cluster.memberIds;
  const members = memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);
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
  // Unbind all finalized or pending members
  const idsToRelease = new Set([
    ...(cluster.memberIds || []),
    ...(cluster.pendingMembers || []).map(m => m.studentId)
  ]);
  idsToRelease.forEach(mId => {
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
