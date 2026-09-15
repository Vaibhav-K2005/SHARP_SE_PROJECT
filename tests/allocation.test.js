// tests/allocation.test.js
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/data/db.js';
import { getTestSeedData } from '../server/data/seedData.js';
import { AllocationEngine } from '../server/services/allocationEngine.js';

test('Room Allocation Engine - 8 Phase Workflow & Invariants', async (t) => {
  db.data = getTestSeedData();
  db.save();

  await t.test('Section 20: Cluster Average CGPA calculation invariant', () => {
    // Student A (9.2), Student B (8.4), Student C (8.0), Student D (7.6)
    const mockStudents = [
      { cgpa: 9.20 },
      { cgpa: 8.40 },
      { cgpa: 8.00 },
      { cgpa: 7.60 }
    ];
    const avg = AllocationEngine.calculateClusterCgpa(mockStudents);
    assert.strictEqual(avg, 8.30, 'Cluster average CGPA must equal 8.30');
  });

  await t.test('Section 21-23: Cluster-Level Dynamic Hostel Eligibility', () => {
    // 3rd Year Boys with 8.30 average CGPA
    const eligibleHostelsCluster21 = AllocationEngine.determineEligibleHostels(3, 'Male', 8.30);
    assert.ok(eligibleHostelsCluster21.some(h => h.includes('Hostel M')), 'Should be eligible for Hostel M');
    assert.ok(eligibleHostelsCluster21.some(h => h.includes('Hostel O')), 'Should be eligible for Hostel O');
    assert.ok(!eligibleHostelsCluster21.some(h => h.includes('Hostel A')), 'Should NOT be eligible for Hostel A (requires 8.5+)');

    // 3rd Year Boys with 8.70 average CGPA (Cluster 35)
    const eligibleHostelsCluster35 = AllocationEngine.determineEligibleHostels(3, 'Male', 8.70);
    assert.ok(eligibleHostelsCluster35.some(h => h.includes('Hostel A')), 'Should be eligible for Hostel A');
    assert.ok(eligibleHostelsCluster35.some(h => h.includes('Hostel M')), 'Should be eligible for Hostel M');
    assert.ok(eligibleHostelsCluster35.some(h => h.includes('Hostel O')), 'Should be eligible for Hostel O');
  });

  await t.test('Section 13: First-Year students do not participate in student-driven allocation', () => {
    const firstYearStudent = db.findOne('users', u => u.academicYear === 1);
    assert.ok(firstYearStudent, 'First year student exists in DB');
    assert.strictEqual(firstYearStudent.allocationStatus, 'FIRST_YEAR_ASSIGNED');
    assert.strictEqual(firstYearStudent.clusterId, null);
  });

  await t.test('Section 27-31: Conflict Resolution between competing clusters', () => {
    // Cluster #21 (avg 8.30) and Cluster #35 (avg 8.70)
    // Both submitted Preference 1 for M-203/204
    const cluster21 = db.findById('clusters', 'cluster-21');
    const cluster35 = db.findById('clusters', 'cluster-35');

    assert.ok(cluster21 && cluster35, 'Both clusters exist');
    assert.strictEqual(cluster21.averageCgpa, 8.30);
    assert.strictEqual(cluster35.averageCgpa, 8.70);

    // Run allocation engine
    const result = AllocationEngine.runAllocationEngine();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.allocatedCount, 2);
    assert.strictEqual(result.unallocatedCount, 0);

    const updatedCluster35 = db.findById('clusters', 'cluster-35');
    const updatedCluster21 = db.findById('clusters', 'cluster-21');

    // Cluster 35 has higher CGPA (8.70 > 8.30), so it wins Preference 1 (M-203/204)
    assert.strictEqual(updatedCluster35.assignedRoomPairNumber, 'M-203/204');
    assert.strictEqual(updatedCluster35.assignedDetails.preferenceSatisfied, 1);

    // Cluster 21 lost Preference 1, so it cascades to Preference 2 (M-211/212)
    assert.strictEqual(updatedCluster21.assignedRoomPairNumber, 'M-211/212');
    assert.strictEqual(updatedCluster21.assignedDetails.preferenceSatisfied, 2);

    // Check that room pair 211/212 has all 4 students allocated together
    assert.strictEqual(updatedCluster21.assignedDetails.members.length, 4);
    assert.ok(['1024160097', '23CS001'].includes(updatedCluster21.assignedDetails.members[0].rollNumber));
    assert.ok(updatedCluster21.assignedDetails.members[1].rollNumber);
    assert.ok(updatedCluster21.assignedDetails.members[2].rollNumber);
    assert.ok(updatedCluster21.assignedDetails.members[3].rollNumber);

    // Section 14 rule: Students still have their current hostel during allocation!
    const studentA = db.findById('users', 'student-a');
    assert.strictEqual(studentA.currentHostel, 'Hostel O'); // Still current accommodation!
    assert.strictEqual(studentA.allocationStatus, 'ALLOCATED');
  });

  await t.test('Section 32: Payment & Final Confirmation commits accommodation', () => {
    const paymentResult = AllocationEngine.processPayment('cluster-21', 'student-a', 80000, 'UPI');
    assert.strictEqual(paymentResult.success, true);

    const updatedCluster21 = db.findById('clusters', 'cluster-21');
    assert.strictEqual(updatedCluster21.status, 'CONFIRMED');
    assert.strictEqual(updatedCluster21.paymentStatus, 'PAID');

    // After confirmation, student records are officially updated to new accommodation!
    const studentA = db.findById('users', 'student-a');
    assert.ok(studentA.currentHostel.includes('Hostel M') || studentA.currentHostel.includes('Anantam'));
    assert.strictEqual(studentA.currentRoom, '211');
    assert.strictEqual(studentA.allocationStatus, 'CONFIRMED');
  });

  await t.test('Allotment Phase Lifecycle: Start, End, and Reset by Caretaker', () => {
    // 1. Reset allotment
    const semReset = db.resetAllotmentPhase();
    assert.strictEqual(semReset.allotmentStatus, 'NOT_STARTED');

    // 2. Start allotment
    const semStarted = db.startAllotmentPhase(1);
    assert.strictEqual(semStarted.allotmentStatus, 'ACTIVE');
    assert.strictEqual(semStarted.activePhase, 1);
    assert.ok(semStarted.allocationStartDate);

    // 3. End allotment
    const semEnded = db.endAllotmentPhase();
    assert.strictEqual(semEnded.allotmentStatus, 'ENDED');
    assert.ok(semEnded.allocationEndDate);
  });
});
