// server/data/seedData.js
// Scale-ready clean real database data with 8 floors, 50 rooms per floor (25 paired suites per floor)
// Real Hostels: A (Agira Hall), M (Anantam Hall), Hostel O, Hostel B, Hostel J, Hostel H, Hostel Q, Hostel N, Hostel E, Hostel F, Hostel G

function generateHostelRoomPairs(hostelId, hostelShortCode, hostelName, totalFloors = 8, pairsPerFloor = 25, isClean = true) {
  const roomPairs = [];
  for (let floor = 1; floor <= totalFloors; floor++) {
    for (let pairIndex = 1; pairIndex <= pairsPerFloor; pairIndex++) {
      const roomNum1 = floor * 100 + (pairIndex * 2 - 1);
      const roomNum2 = floor * 100 + (pairIndex * 2);
      const pairNumber = `${hostelShortCode}-${roomNum1}/${roomNum2}`;
      const id = `rp-${hostelId}-f${floor}-p${pairIndex}`;

      let status = 'AVAILABLE';
      let allocatedClusterId = null;

      if (!isClean && floor === 1 && pairIndex <= 3) {
        status = 'ALLOCATED';
      }

      roomPairs.push({
        id,
        pairNumber,
        hostelId,
        hostelName,
        floor,
        room1: roomNum1.toString(),
        room2: roomNum2.toString(),
        sharedWashroom: `Washroom W-${roomNum1}/${roomNum2}`,
        wing: pairIndex <= 12 ? 'West Wing' : 'East Wing',
        capacity: 4,
        status,
        allocatedClusterId,
        occupants: []
      });
    }
  }
  return roomPairs;
}

function getHostelsList(isClean = true) {
  return [
    {
      id: "hostel-a",
      shortCode: "A",
      name: "Hostel A (Agira Hall)",
      alias: "Agira Hall",
      gender: "Male",
      eligibleYears: [3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 620,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-m",
      shortCode: "M",
      name: "Hostel M (Anantam Hall)",
      alias: "Anantam Hall",
      gender: "Male",
      eligibleYears: [3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 580,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-o",
      shortCode: "O",
      name: "Hostel O",
      alias: "Hostel O",
      gender: "Male",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 690,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-b",
      shortCode: "B",
      name: "Hostel B",
      alias: "Hostel B",
      gender: "Male",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 510,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-j",
      shortCode: "J",
      name: "Hostel J",
      alias: "Hostel J",
      gender: "Male",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 540,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-h",
      shortCode: "H",
      name: "Hostel H",
      alias: "Hostel H",
      gender: "Male",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 490,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-q",
      shortCode: "Q",
      name: "Hostel Q",
      alias: "Hostel Q",
      gender: "Female",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 590,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-n",
      shortCode: "N",
      name: "Hostel N",
      alias: "Hostel N",
      gender: "Female",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 600,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-e",
      shortCode: "E",
      name: "Hostel E",
      alias: "Hostel E",
      gender: "Female",
      eligibleYears: [2, 3, 4],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 560,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-f",
      shortCode: "F",
      name: "Hostel F (First Year Boys)",
      alias: "Hostel F",
      gender: "Male",
      eligibleYears: [1],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 800,
      status: "ACTIVE",
      caretakerId: null
    },
    {
      id: "hostel-g",
      shortCode: "G",
      name: "Hostel G (First Year Girls)",
      alias: "Hostel G",
      gender: "Female",
      eligibleYears: [1],
      totalFloors: 8,
      roomsPerFloor: 50,
      capacity: 800,
      occupied: isClean ? 0 : 800,
      status: "ACTIVE",
      caretakerId: null
    }
  ];
}

const sharedConfig = {
  semesters: [
    {
      id: "sem-2026-s1",
      name: "2026–27 Semester 1",
      status: "ACTIVE",
      allotmentStatus: "NOT_STARTED",
      currentPhase: "Phase 1: Pre-Allocation",
      phaseNumber: 1,
      activePhase: 1,
      allocationStartDate: "2026-09-01",
      allocationEndDate: "2026-09-30",
      academicYear: 2026
    }
  ],
  allocationConfig: {
    participatingYears: [2, 3, 4],
    autoAssignFirstYears: true,
    studentsPerCluster: 4,
    preferencesRequired: 3,
    tieBreakingMethod: "lottery",
    secondaryTieBreaker: "random_number",
    roomPairStructure: "2 rooms = 4 students = 1 shared washroom"
  },
  eligibilityRules: [
    {
      id: "rule-3-m-high",
      academicYear: 3,
      gender: "Male",
      minCgpa: 8.50,
      maxCgpa: 10.0,
      eligibleHostels: ["Hostel A (Agira Hall)", "Hostel M (Anantam Hall)", "Hostel O", "Hostel B", "Hostel J", "Hostel H"],
      description: "Third Year Boys CGPA >= 8.50 (Hostels A, M, O, B, J, H)"
    },
    {
      id: "rule-3-m-mid",
      academicYear: 3,
      gender: "Male",
      minCgpa: 7.00,
      maxCgpa: 8.49,
      eligibleHostels: ["Hostel M (Anantam Hall)", "Hostel O", "Hostel B", "Hostel J", "Hostel H"],
      description: "Third Year Boys CGPA 7.00–8.49 (Hostels M, O, B, J, H)"
    },
    {
      id: "rule-3-m-low",
      academicYear: 3,
      gender: "Male",
      minCgpa: 0.00,
      maxCgpa: 6.99,
      eligibleHostels: ["Hostel O", "Hostel H"],
      description: "Third Year Boys CGPA < 7.00 (Hostels O, H)"
    },
    {
      id: "rule-3-f-all",
      academicYear: 3,
      gender: "Female",
      minCgpa: 0.00,
      maxCgpa: 10.0,
      eligibleHostels: ["Hostel Q", "Hostel N", "Hostel E"],
      description: "Third Year Girls (Hostels Q, N, E)"
    },
    {
      id: "rule-2-m-all",
      academicYear: 2,
      gender: "Male",
      minCgpa: 0.00,
      maxCgpa: 10.0,
      eligibleHostels: ["Hostel O", "Hostel B", "Hostel J"],
      description: "Second Year Boys (Hostels O, B, J)"
    }
  ]
};

// 1. CLEAN PRODUCTION DATA (0 test students, 0 test parents, official Administrator & Caretaker)
export function getInitialData() {
  const hostels = getHostelsList(true);
  const allRoomPairs = [];
  for (const h of hostels) {
    allRoomPairs.push(...generateHostelRoomPairs(h.id, h.shortCode, h.name, 8, 25, true));
  }

  return {
    semesters: [
      {
        ...sharedConfig.semesters[0],
        allotmentStatus: "NOT_STARTED",
        activePhase: 1
      }
    ],
    allocationConfig: sharedConfig.allocationConfig,
    eligibilityRules: sharedConfig.eligibilityRules,
    hostels,
    roomPairs: allRoomPairs,

    // Real clean users: official Administrator & Caretaker
    users: [
      {
        id: "admin-1",
        role: "admin",
        fullName: "Dean Hostel Board",
        email: "admin@thapar.edu",
        verified: true,
        department: "Hostel Management Board"
      },
      {
        id: "caretaker-m",
        role: "caretaker",
        fullName: "Mr. Rakesh Sharma",
        email: "caretaker.m@thapar.edu",
        verified: true,
        hostelId: "hostel-m",
        hostelName: "Hostel M (Anantam Hall)",
        phone: "+91 98765 43210"
      }
    ],

    clusters: [],
    studentPreferences: [],
    complaints: [],
    leaveRequests: [],
    localEntryRequests: [],
    passes: [],
    messFeedback: [],
    notifications: []
  };
}

// 2. TEST FIXTURE DATA (Only used by automated test runner)
export function getTestSeedData() {
  const hostels = getHostelsList(false);
  const allRoomPairs = [];
  for (const h of hostels) {
    allRoomPairs.push(...generateHostelRoomPairs(h.id, h.shortCode, h.name, 8, 25, false));
  }

  return {
    semesters: [
      {
        ...sharedConfig.semesters[0],
        allotmentStatus: "ACTIVE",
        activePhase: 5
      }
    ],
    allocationConfig: sharedConfig.allocationConfig,
    eligibilityRules: sharedConfig.eligibilityRules,
    hostels,
    roomPairs: allRoomPairs,

    users: [
      {
        id: "admin-1",
        role: "admin",
        fullName: "Dean Hostel Board",
        email: "admin@thapar.edu",
        verified: true,
        department: "Hostel Management Board"
      },
      {
        id: "caretaker-m",
        role: "caretaker",
        fullName: "Mr. Rakesh Sharma",
        email: "caretaker.m@thapar.edu",
        verified: true,
        hostelId: "hostel-m",
        hostelName: "Hostel M (Anantam Hall)",
        phone: "+91 98765 43210"
      },
      {
        id: "student-a",
        role: "student",
        fullName: "Vaibhav Kansal",
        rollNumber: "1024160097",
        email: "vaibhav@thapar.edu",
        academicYear: 3,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 9.20,
        cgpaVerified: true,
        currentHostel: "Hostel O",
        currentRoom: "102",
        currentRoommates: ["Ayush Kamboj"],
        parentEmail: "parent.vaibhav@example.com",
        phone: "+91 98111 22334",
        address: "House 45, Model Town, Patiala",
        verified: true,
        clusterId: "cluster-21",
        allocationStatus: "PRE_ALLOCATION"
      },
      {
        id: "student-b",
        role: "student",
        fullName: "Ayush Kamboj",
        rollNumber: "1024160118",
        email: "ayush@thapar.edu",
        academicYear: 3,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 8.40,
        cgpaVerified: true,
        currentHostel: "Hostel O",
        currentRoom: "102",
        currentRoommates: ["Vaibhav Kansal"],
        parentEmail: "parent.ayush@example.com",
        phone: "+91 98222 33445",
        address: "78 Civil Lines, Yamunanagar",
        verified: true,
        clusterId: "cluster-21",
        allocationStatus: "PRE_ALLOCATION"
      },
      {
        id: "student-c",
        role: "student",
        fullName: "Ali Ekram",
        rollNumber: "1024160138",
        email: "ali@thapar.edu",
        academicYear: 3,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 8.00,
        cgpaVerified: true,
        currentHostel: "Hostel O",
        currentRoom: "104",
        currentRoommates: ["Rohan Gupta"],
        parentEmail: "parent.ali@example.com",
        phone: "+91 98333 44556",
        address: "12 Sector 14, Chandigarh",
        verified: true,
        clusterId: "cluster-21",
        allocationStatus: "PRE_ALLOCATION"
      },
      {
        id: "student-d",
        role: "student",
        fullName: "Rohan Gupta",
        rollNumber: "1024160099",
        email: "rohan@thapar.edu",
        academicYear: 3,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 7.60,
        cgpaVerified: true,
        currentHostel: "Hostel O",
        currentRoom: "104",
        currentRoommates: ["Ali Ekram"],
        parentEmail: "parent.rohan@example.com",
        phone: "+91 98444 55667",
        address: "56 Urban Estate, Phase 2, Patiala",
        verified: true,
        clusterId: "cluster-21",
        allocationStatus: "PRE_ALLOCATION"
      },
      {
        id: "student-e",
        role: "student",
        fullName: "Karan Johar",
        rollNumber: "1024160035",
        email: "karan@thapar.edu",
        academicYear: 3,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 9.00,
        cgpaVerified: true,
        currentHostel: "Hostel O",
        currentRoom: "201",
        currentRoommates: ["Aman Deep"],
        parentEmail: "parent.karan@example.com",
        phone: "+91 98555 66778",
        address: "88 Sector 22, Chandigarh",
        verified: true,
        clusterId: "cluster-35",
        allocationStatus: "PRE_ALLOCATION"
      },
      {
        id: "student-firstyear",
        role: "student",
        fullName: "Kabir Singh",
        rollNumber: "1026160001",
        email: "kabir@thapar.edu",
        academicYear: 1,
        course: "B.Tech Computer Engineering",
        gender: "Male",
        cgpa: 0.0,
        cgpaVerified: false,
        currentHostel: "Hostel F (First Year Boys)",
        currentRoom: "101",
        currentRoommates: ["Harsh Patel"],
        parentEmail: "parent.kabir@example.com",
        phone: "+91 99999 11223",
        address: "Sector 17, Chandigarh",
        verified: true,
        clusterId: null,
        allocationStatus: "FIRST_YEAR_ASSIGNED"
      }
    ],

    clusters: [
      {
        id: "cluster-21",
        clusterNumber: 21,
        leaderId: "student-b",
        memberIds: ["student-a", "student-b", "student-c", "student-d"],
        memberRolls: ["1024160097", "1024160118", "1024160138", "1024160099"],
        gender: "Male",
        academicYear: 3,
        averageCgpa: 8.30,
        eligibleHostels: ["Hostel M (Anantam Hall)", "Hostel O", "Hostel B", "Hostel J", "Hostel H"],
        preferences: [
          { rank: 1, roomPairId: "rp-hostel-m-f2-p2", roomPairNumber: "M-203/204", hostelName: "Hostel M (Anantam Hall)" },
          { rank: 2, roomPairId: "rp-hostel-m-f2-p6", roomPairNumber: "M-211/212", hostelName: "Hostel M (Anantam Hall)" },
          { rank: 3, roomPairId: "rp-hostel-o-f1-p3", roomPairNumber: "O-105/106", hostelName: "Hostel O" }
        ],
        status: "FORMED",
        assignedRoomPairId: null,
        paymentStatus: "PENDING"
      },
      {
        id: "cluster-35",
        clusterNumber: 35,
        leaderId: "student-e",
        memberIds: ["student-e"],
        memberRolls: ["1024160035"],
        gender: "Male",
        academicYear: 3,
        averageCgpa: 8.70,
        eligibleHostels: ["Hostel A (Agira Hall)", "Hostel M (Anantam Hall)", "Hostel O", "Hostel B", "Hostel J", "Hostel H"],
        preferences: [
          { rank: 1, roomPairId: "rp-hostel-m-f2-p2", roomPairNumber: "M-203/204", hostelName: "Hostel M (Anantam Hall)" },
          { rank: 2, roomPairId: "rp-hostel-a-f1-p1", roomPairNumber: "A-101/102", hostelName: "Hostel A (Agira Hall)" },
          { rank: 3, roomPairId: "rp-hostel-o-f1-p3", roomPairNumber: "O-105/106", hostelName: "Hostel O" }
        ],
        status: "FORMED",
        assignedRoomPairId: null,
        paymentStatus: "PENDING"
      }
    ],

    studentPreferences: [],
    complaints: [
      {
        id: "comp-101",
        type: "MAINTENANCE",
        category: "Electrical problems",
        studentId: "student-a",
        studentName: "Vaibhav Kansal",
        studentRollNumber: "1024160097",
        hostelName: "Hostel O",
        roomNumber: "102",
        description: "Ceiling fan regulator sparking and not turning off.",
        status: "UNDER_REVIEW",
        createdAt: "2026-09-11T10:30:00",
        caretakerNotes: "Electrician scheduled for afternoon inspection."
      }
    ],
    leaveRequests: [],
    localEntryRequests: [],
    passes: [],
    messFeedback: [],
    notifications: []
  };
}
