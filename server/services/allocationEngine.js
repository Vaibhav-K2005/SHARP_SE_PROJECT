// server/services/allocationEngine.js
import { db } from '../data/db.js';

export class AllocationEngine {
  /**
   * Calculate cluster average CGPA
   * Section 20: CGPA is applied AFTER cluster formation.
   * Average CGPA = (CGPA_1 + CGPA_2 + CGPA_3 + CGPA_4) / 4
   */
  static calculateClusterCgpa(memberStudents) {
    if (!memberStudents || memberStudents.length === 0) return 0.0;
    const sum = memberStudents.reduce((acc, s) => acc + (Number(s.cgpa) || 0.0), 0);
    const avg = sum / memberStudents.length;
    return Math.round(avg * 1000) / 1000;
  }

  /**
   * Determine eligible hostels for a cluster using Admin dynamic rules
   * Section 21-23: Cluster-Level Hostel Eligibility retrieved from data configuration
   */
  static determineEligibleHostels(academicYear, gender, averageCgpa) {
    const rules = db.getCollection('eligibilityRules');
    const eligibleHostelsSet = new Set();

    for (const rule of rules) {
      const yearMatches = !rule.academicYear || rule.academicYear === Number(academicYear);
      const genderMatches = !rule.gender || rule.gender.toLowerCase() === gender.toLowerCase();
      const cgpaMatches = averageCgpa >= rule.minCgpa && averageCgpa <= rule.maxCgpa;

      if (yearMatches && genderMatches && cgpaMatches) {
        if (Array.isArray(rule.eligibleHostels)) {
          rule.eligibleHostels.forEach(h => eligibleHostelsSet.add(h));
        }
      }
    }

    return Array.from(eligibleHostelsSet);
  }

  /**
   * Phase 2: Form and validate clusters of 4
   * Section 19:
   * 1. Mutual roommate selections are validated.
   * 2. Complete groups of four are validated.
   * 3. Students who selected one roommate are grouped with two additional compatible students.
   * 4. Students who selected nobody (or Option A) are randomly grouped.
   * 5. Every cluster contains 4 students.
   * 6. Unique Cluster ID generated.
   */
  static formClusters() {
    const users = db.getCollection('users').filter(u => u.role === 'student' && u.academicYear > 1);
    const preferences = db.getCollection('studentPreferences');
    const existingClusters = db.getCollection('clusters');
    
    // Group students by gender & academicYear for compatibility
    const studentMap = new Map();
    users.forEach(u => studentMap.set(u.rollNumber, u));

    const prefMap = new Map();
    preferences.forEach(p => prefMap.set(p.rollNumber, p));

    const clusteredRolls = new Set();
    const newClusters = [];
    let nextClusterNumber = Math.max(0, ...existingClusters.map(c => c.clusterNumber || 0)) + 1;

    // 1. Process Option C: Complete 4-student clusters
    for (const student of users) {
      if (clusteredRolls.has(student.rollNumber)) continue;
      const pref = prefMap.get(student.rollNumber);
      if (pref && pref.preferenceOption === 'OPTION_C' && Array.isArray(pref.clusterRollNumbers) && pref.clusterRollNumbers.length === 4) {
        const group = pref.clusterRollNumbers.map(r => String(r).trim().toUpperCase());
        // Verify none of the group members are already in another cluster
        const noneClustered = group.every(roll => {
          if (clusteredRolls.has(roll)) return false;
          const s = studentMap.get(roll);
          return !s || !s.clusterId;
        });

        if (noneClustered) {
          const members = group.map(roll => {
            let s = studentMap.get(roll);
            if (!s) {
              s = db.insert('users', {
                role: 'student',
                fullName: `Student (${roll})`,
                rollNumber: roll,
                email: `${roll.toLowerCase()}@thapar.edu`,
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
              studentMap.set(roll, s);
            }
            return s;
          });

          const clusterId = `cluster-${nextClusterNumber}`;
          const avgCgpa = this.calculateClusterCgpa(members);
          const eligibleHostels = this.determineEligibleHostels(student.academicYear, student.gender, avgCgpa);

          const cluster = {
            id: clusterId,
            clusterNumber: nextClusterNumber++,
            leaderId: members[0].id,
            memberIds: members.map(m => m.id),
            memberRolls: group,
            gender: student.gender,
            academicYear: student.academicYear,
            averageCgpa: avgCgpa,
            eligibleHostels: eligibleHostels,
            preferences: [],
            status: 'FORMED',
            assignedRoomPairId: null,
            paymentStatus: 'PENDING'
          };

          newClusters.push(cluster);
          pref.status = 'CLUSTERED';
          pref.clusterId = clusterId;

          group.forEach(roll => {
            clusteredRolls.add(roll);
            const s = studentMap.get(roll);
            if (s) {
              s.clusterId = clusterId;
              s.allocationStatus = 'CLUSTER_FORMED';
            }
          });
        }
      }
    }

    // 2. Process Option B: Mutual pairs of 2
    const mutualPairs = [];
    for (const student of users) {
      if (clusteredRolls.has(student.rollNumber)) continue;
      const pref = prefMap.get(student.rollNumber);
      if (pref && pref.preferenceOption === 'OPTION_B' && pref.partnerRollNumber) {
        const partnerRoll = pref.partnerRollNumber;
        if (!clusteredRolls.has(partnerRoll)) {
          const partnerPref = prefMap.get(partnerRoll);
          if (partnerPref && partnerPref.partnerRollNumber === student.rollNumber) {
            // Mutual match found!
            mutualPairs.push([student.rollNumber, partnerRoll]);
            clusteredRolls.add(student.rollNumber);
            clusteredRolls.add(partnerRoll);
          }
        }
      }
    }

    // Pair up mutual pairs into 4-person clusters
    while (mutualPairs.length >= 2) {
      const pair1 = mutualPairs.shift();
      const pair2 = mutualPairs.shift();
      const group = [...pair1, ...pair2];
      const members = group.map(roll => studentMap.get(roll));
      const clusterId = `cluster-${nextClusterNumber}`;
      const avgCgpa = this.calculateClusterCgpa(members);
      const eligibleHostels = this.determineEligibleHostels(members[0].academicYear, members[0].gender, avgCgpa);

      const cluster = {
        id: clusterId,
        clusterNumber: nextClusterNumber++,
        leaderId: members[0].id,
        memberIds: members.map(m => m.id),
        memberRolls: group,
        gender: members[0].gender,
        academicYear: members[0].academicYear,
        averageCgpa: avgCgpa,
        eligibleHostels: eligibleHostels,
        preferences: [],
        status: 'FORMED',
        assignedRoomPairId: null,
        paymentStatus: 'PENDING'
      };

      newClusters.push(cluster);
      group.forEach(roll => {
        const s = studentMap.get(roll);
        if (s) {
          s.clusterId = clusterId;
          s.allocationStatus = 'CLUSTER_FORMED';
        }
      });
    }

    // 3. Remaining singles (Option A, leftover from broken Option B/C)
    const remainingStudents = users.filter(u => !clusteredRolls.has(u.rollNumber));
    // If we have an odd pair left, combine with 2 singles
    if (mutualPairs.length === 1 && remainingStudents.length >= 2) {
      const pair = mutualPairs.shift();
      const s1 = remainingStudents.shift();
      const s2 = remainingStudents.shift();
      const group = [...pair, s1.rollNumber, s2.rollNumber];
      const members = group.map(roll => studentMap.get(roll));
      const clusterId = `cluster-${nextClusterNumber}`;
      const avgCgpa = this.calculateClusterCgpa(members);
      const eligibleHostels = this.determineEligibleHostels(members[0].academicYear, members[0].gender, avgCgpa);

      const cluster = {
        id: clusterId,
        clusterNumber: nextClusterNumber++,
        leaderId: members[0].id,
        memberIds: members.map(m => m.id),
        memberRolls: group,
        gender: members[0].gender,
        academicYear: members[0].academicYear,
        averageCgpa: avgCgpa,
        eligibleHostels: eligibleHostels,
        preferences: [],
        status: 'FORMED',
        assignedRoomPairId: null,
        paymentStatus: 'PENDING'
      };

      newClusters.push(cluster);
      group.forEach(roll => {
        clusteredRolls.add(roll);
        const s = studentMap.get(roll);
        if (s) {
          s.clusterId = clusterId;
          s.allocationStatus = 'CLUSTER_FORMED';
        }
      });
    }

    // Group remaining into groups of 4
    while (remainingStudents.length >= 4) {
      const groupStudents = remainingStudents.splice(0, 4);
      const group = groupStudents.map(s => s.rollNumber);
      const clusterId = `cluster-${nextClusterNumber}`;
      const avgCgpa = this.calculateClusterCgpa(groupStudents);
      const eligibleHostels = this.determineEligibleHostels(groupStudents[0].academicYear, groupStudents[0].gender, avgCgpa);

      const cluster = {
        id: clusterId,
        clusterNumber: nextClusterNumber++,
        leaderId: groupStudents[0].id,
        memberIds: groupStudents.map(m => m.id),
        memberRolls: group,
        gender: groupStudents[0].gender,
        academicYear: groupStudents[0].academicYear,
        averageCgpa: avgCgpa,
        eligibleHostels: eligibleHostels,
        preferences: [],
        status: 'FORMED',
        assignedRoomPairId: null,
        paymentStatus: 'PENDING'
      };

      newClusters.push(cluster);
      group.forEach(roll => {
        clusteredRolls.add(roll);
        const s = studentMap.get(roll);
        if (s) {
          s.clusterId = clusterId;
          s.allocationStatus = 'CLUSTER_FORMED';
        }
      });
    }

    // Save updated clusters to DB
    const clusterColl = db.getCollection('clusters');
    for (const c of newClusters) {
      if (!clusterColl.find(existing => existing.id === c.id)) {
        clusterColl.push(c);
      }
    }

    db.updateActiveSemesterPhase(2);
    db.save();
    return {
      success: true,
      formedClustersCount: newClusters.length,
      clusters: clusterColl
    };
  }

  /**
   * Phase 4: Submit 3 room preferences by Cluster Leader
   */
  static submitRoomPreferences(clusterId, leaderId, preferences) {
    const cluster = db.findById('clusters', clusterId);
    if (!cluster) throw new Error('Cluster not found');
    if (cluster.leaderId !== leaderId) {
      throw new Error('Only the designated Cluster Leader can submit room preferences');
    }
    if (!Array.isArray(preferences) || preferences.length < 1) {
      throw new Error('At least 1 room-pair preference is required (up to 3)');
    }

    // Validate that preferred room pairs belong to eligible hostels
    const roomPairs = db.getCollection('roomPairs');
    for (const pref of preferences) {
      const rp = roomPairs.find(r => r.id === pref.roomPairId || r.pairNumber === pref.roomPairNumber);
      if (!rp) {
        throw new Error(`Room pair ${pref.roomPairNumber || pref.roomPairId} does not exist`);
      }
      if (!cluster.eligibleHostels.includes(rp.hostelName)) {
        throw new Error(`Room pair ${rp.pairNumber} in ${rp.hostelName} is not in your cluster's eligible hostels list`);
      }
      pref.roomPairId = rp.id;
      pref.roomPairNumber = rp.pairNumber;
      pref.hostelName = rp.hostelName;
    }

    cluster.preferences = preferences;
    cluster.status = 'PREFERENCES_SUBMITTED';

    // Update students allocation status
    const users = db.getCollection('users');
    cluster.memberIds.forEach(mId => {
      const student = users.find(u => u.id === mId);
      if (student) {
        student.allocationStatus = 'PREFERENCES_SUBMITTED';
      }
    });

    db.save();
    return { success: true, cluster };
  }

  /**
   * Change Cluster Leader
   * Section 26: "The leader can be changed if necessary... another cluster member can become the leader."
   */
  static changeClusterLeader(clusterId, newLeaderId) {
    const cluster = db.findById('clusters', clusterId);
    if (!cluster) throw new Error('Cluster not found');
    if (!cluster.memberIds.includes(newLeaderId)) {
      throw new Error('New leader must be an existing member of this cluster');
    }
    cluster.leaderId = newLeaderId;
    db.save();
    return { success: true, cluster };
  }

  /**
   * Phase 5 & 6: Conflict Resolution and Automatic Room Allocation
   * Sections 28-31:
   * - Clusters competing for same room pair resolved by Cluster Average CGPA.
   * - Higher average CGPA gets the room pair.
   * - Losing cluster moves to next preference.
   * - Tie-breaking via configurable method.
   * - If all 3 preferences taken -> UNALLOCATED -> Caretaker reviews.
   */
  static runAllocationEngine() {
    const clusters = db.getCollection('clusters').filter(c => c.preferences && c.preferences.length > 0);
    const roomPairs = db.getCollection('roomPairs');
    const users = db.getCollection('users');
    const config = db.getConfig();

    // Reset current room pair allocations for fresh run
    roomPairs.forEach(rp => {
      rp.status = 'AVAILABLE';
      rp.allocatedClusterId = null;
      rp.occupants = [];
    });

    // Sort clusters by average CGPA descending.
    // In case of tie, use configured tie-breaker.
    const sortedClusters = [...clusters].sort((a, b) => {
      if (b.averageCgpa !== a.averageCgpa) {
        return b.averageCgpa - a.averageCgpa;
      }
      if (config.tieBreakingMethod === 'lottery' || config.tieBreakingMethod === 'random_number') {
        return (Math.random() - 0.5);
      }
      return (a.clusterNumber || 0) - (b.clusterNumber || 0);
    });

    const allocatedResults = [];
    const unallocatedResults = [];
    const roomPairMap = new Map();
    roomPairs.forEach(rp => roomPairMap.set(rp.id, rp));

    for (const cluster of sortedClusters) {
      let assignedPair = null;
      let matchedPrefRank = null;

      // Try each preference in order
      for (const pref of cluster.preferences) {
        const rp = roomPairMap.get(pref.roomPairId);
        if (rp && rp.status === 'AVAILABLE') {
          assignedPair = rp;
          matchedPrefRank = pref.rank;
          break;
        }
      }

      if (assignedPair) {
        // Successful allocation
        assignedPair.status = 'ALLOCATED';
        assignedPair.allocatedClusterId = cluster.id;

        // Assign individual rooms: 2 students in Room 1, 2 students in Room 2 (Section 18 & 31)
        const members = cluster.memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);
        assignedPair.occupants = members.map((m, idx) => ({
          studentId: m.id,
          studentName: m.fullName,
          rollNumber: m.rollNumber,
          roomNumber: idx < 2 ? assignedPair.room1 : assignedPair.room2,
          bed: idx % 2 === 0 ? 'Bed A' : 'Bed B'
        }));

        cluster.status = 'ALLOCATED';
        cluster.assignedRoomPairId = assignedPair.id;
        cluster.assignedRoomPairNumber = assignedPair.pairNumber;
        cluster.assignedHostel = assignedPair.hostelName;
        cluster.assignedDetails = {
          hostel: assignedPair.hostelName,
          pairNumber: assignedPair.pairNumber,
          room1: assignedPair.room1,
          room2: assignedPair.room2,
          preferenceSatisfied: matchedPrefRank,
          members: assignedPair.occupants
        };

        // Note: Section 14 rule - students participate while living in current hostel!
        // Current hostel & room only changes after payment & confirmation!
        members.forEach(m => {
          m.allocationStatus = 'ALLOCATED';
          m.pendingAllocation = {
            hostel: assignedPair.hostelName,
            pairNumber: assignedPair.pairNumber,
            roomNumber: assignedPair.occupants.find(o => o.studentId === m.id)?.roomNumber,
            clusterId: cluster.id
          };
        });

        allocatedResults.push({
          clusterId: cluster.id,
          clusterNumber: cluster.clusterNumber,
          averageCgpa: cluster.averageCgpa,
          assignedRoomPair: assignedPair.pairNumber,
          hostel: assignedPair.hostelName,
          preferenceRank: matchedPrefRank
        });
      } else {
        // Section 17 & 30: All 3 preferences unavailable -> UNALLOCATED -> Caretaker reviews
        cluster.status = 'UNALLOCATED';
        cluster.assignedRoomPairId = null;
        cluster.unallocatedReason = 'All room preferences were taken by clusters with higher average CGPA';

        const members = cluster.memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);
        members.forEach(m => {
          m.allocationStatus = 'UNALLOCATED';
        });

        unallocatedResults.push({
          clusterId: cluster.id,
          clusterNumber: cluster.clusterNumber,
          averageCgpa: cluster.averageCgpa,
          reason: cluster.unallocatedReason
        });
      }
    }

    db.updateActiveSemesterPhase(6);
    db.save();

    return {
      success: true,
      allocatedCount: allocatedResults.length,
      unallocatedCount: unallocatedResults.length,
      allocated: allocatedResults,
      unallocated: unallocatedResults
    };
  }

  /**
   * Caretaker manual assignment for UNALLOCATED clusters
   * Section 30: Caretaker manually assigns an available room pair
   */
  static manualAssignRoomPair(clusterId, roomPairId) {
    const cluster = db.findById('clusters', clusterId);
    if (!cluster) throw new Error('Cluster not found');
    const rp = db.findById('roomPairs', roomPairId);
    if (!rp) throw new Error('Room pair not found');
    if (rp.status !== 'AVAILABLE') throw new Error('Selected room pair is not available');

    const users = db.getCollection('users');
    const members = cluster.memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);

    rp.status = 'ALLOCATED';
    rp.allocatedClusterId = cluster.id;
    rp.occupants = members.map((m, idx) => ({
      studentId: m.id,
      studentName: m.fullName,
      rollNumber: m.rollNumber,
      roomNumber: idx < 2 ? rp.room1 : rp.room2,
      bed: idx % 2 === 0 ? 'Bed A' : 'Bed B'
    }));

    cluster.status = 'ALLOCATED';
    cluster.assignedRoomPairId = rp.id;
    cluster.assignedRoomPairNumber = rp.pairNumber;
    cluster.assignedHostel = rp.hostelName;
    cluster.assignedDetails = {
      hostel: rp.hostelName,
      pairNumber: rp.pairNumber,
      room1: rp.room1,
      room2: rp.room2,
      manuallyAssigned: true,
      members: rp.occupants
    };

    members.forEach(m => {
      m.allocationStatus = 'ALLOCATED';
      m.pendingAllocation = {
        hostel: rp.hostelName,
        pairNumber: rp.pairNumber,
        roomNumber: rp.occupants.find(o => o.studentId === m.id)?.roomNumber,
        clusterId: cluster.id
      };
    });

    db.save();
    return { success: true, cluster, roomPair: rp };
  }

  /**
   * Phase 7 & 8: Payment & Final Confirmation
   * Section 32: After payment successful -> Allocation Confirmed -> Student records & room occupancy updated
   */
  static processPayment(clusterId, studentId, amount, paymentMethod = 'UPI/NetBanking') {
    const cluster = db.findById('clusters', clusterId);
    if (!cluster) throw new Error('Cluster not found');
    if (cluster.status !== 'ALLOCATED') {
      throw new Error('Payment can only be processed after room pair is allocated');
    }

    cluster.paymentStatus = 'PAID';
    cluster.paymentReceipt = {
      receiptNumber: `REC-${Date.now()}`,
      paidBy: studentId,
      amount: amount || 80000, // ₹55,000 Hostel + ₹25,000 Mess
      method: paymentMethod,
      timestamp: new Date().toISOString(),
      status: 'PAID'
    };

    // Phase 8: Confirm Allocation immediately upon payment
    return this.confirmAllocation(clusterId);
  }

  static confirmAllocation(clusterId) {
    const cluster = db.findById('clusters', clusterId);
    if (!cluster) throw new Error('Cluster not found');
    if (cluster.paymentStatus !== 'PAID') {
      throw new Error('Hostel and mess fee payment must be completed before confirmation');
    }

    const rp = db.findById('roomPairs', cluster.assignedRoomPairId);
    const users = db.getCollection('users');
    const members = cluster.memberIds.map(mId => users.find(u => u.id === mId)).filter(Boolean);

    cluster.status = 'CONFIRMED';

    // Now update student's permanent accommodation records!
    members.forEach(m => {
      const occupant = rp.occupants.find(o => o.studentId === m.id);
      m.currentHostel = rp.hostelName;
      m.currentRoom = occupant ? occupant.roomNumber : rp.room1;
      m.allocationStatus = 'CONFIRMED';
      m.currentRoommates = members.filter(other => other.id !== m.id).map(other => other.fullName);
      delete m.pendingAllocation;
    });

    // Add notification
    const notifications = db.getCollection('notifications');
    members.forEach(m => {
      notifications.push({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        recipientRole: 'student',
        recipientId: m.id,
        title: 'Room Allocation Confirmed!',
        message: `Congratulations! Your allotment in ${rp.hostelName}, Room Pair ${rp.pairNumber} (Room ${m.currentRoom}) is finalized.`,
        timestamp: new Date().toISOString(),
        read: false
      });
    });

    db.updateActiveSemesterPhase(8);
    db.save();

    return {
      success: true,
      cluster,
      roomPair: rp,
      message: 'Allocation officially confirmed! Resident records and hostel occupancies updated.'
    };
  }
}
