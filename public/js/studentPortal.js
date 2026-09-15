// public/js/studentPortal.js
import { HostelMap } from './hostelMap.js';
import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';

export class StudentPortal {
  constructor(app, user) {
    this.app = app;
    this.user = user;
    this.activeTab = 'dashboard';
    this.clusterData = null;
    this.hostelMapInstance = null;
    this.selectedPreferences = [];
    this.clusterInvitations = [];
  }

  async init() {
    await this.fetchStudentData();
    this.render();
    this.attachEvents();
  }

  async fetchStudentData() {
    try {
      // Refresh current user info
      const usersRes = await fetch('/api/admin/users');
      const { users } = await usersRes.json();
      const freshUser = users.find(u => u.id === this.user.id);
      if (freshUser) this.user = freshUser;

      // Fetch allocation status & existing submitted preferences
      const statusRes = await fetch('/api/allocation/status');
      if (statusRes.ok) {
        this.allocationStatusData = await statusRes.json();
        const prefs = this.allocationStatusData.studentPreferences || [];
        const cleanRoll = this.user.rollNumber?.toUpperCase();
        this.submittedPref = prefs.find(p => p.rollNumber?.toUpperCase() === cleanRoll) || null;
      }

      const invitationRes = await fetch(`/api/allocation/cluster-invitations/${this.user.id}`);
      if (invitationRes.ok) {
        const invitationData = await invitationRes.json();
        this.clusterInvitations = invitationData.invitations || [];
      }

      // Fetch cluster data if clustered
      if (this.user.clusterId) {
        const cRes = await fetch(`/api/allocation/cluster/${this.user.clusterId}`);
        if (cRes.ok) {
          this.clusterData = await cRes.json();
        } else {
          this.clusterData = null;
        }
      } else {
        this.clusterData = null;
      }
    } catch (err) {
      console.error('Failed to fetch student data:', err);
    }
  }

  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    const navItems = [
      { id: 'dashboard', icon: 'fa-gauge', label: 'Dashboard' },
      { id: 'profile', icon: 'fa-user', label: 'Profile' },
      { id: 'allocation', icon: 'fa-sitemap', label: 'Room Allocation', badge: this.getPhaseBadge() },
      { id: 'hostel-info', icon: 'fa-hotel', label: 'Room & Hostel Info' }
    ];

    if (!navItems.some(item => item.id === this.activeTab)) {
      this.activeTab = 'dashboard';
    }

    const contentHtml = `
      <!-- Content Panes -->
      <div class="portal-pane ${this.activeTab === 'dashboard' ? 'active' : ''}" id="pane-dashboard">
        ${this.renderDashboard()}
      </div>

      <div class="portal-pane ${this.activeTab === 'profile' ? 'active' : ''}" id="pane-profile">
        ${this.renderProfile()}
      </div>

      <div class="portal-pane ${this.activeTab === 'allocation' ? 'active' : ''}" id="pane-allocation">
        ${this.renderAllocationSection()}
      </div>

      <div class="portal-pane ${this.activeTab === 'hostel-info' ? 'active' : ''}" id="pane-hostel-info">
        ${this.renderHostelInfoSection()}
      </div>
    `;

    mount.innerHTML = renderPortalShell({
      roleTitle: 'Student Portal',
      roleIcon: 'fa-graduation-cap',
      userName: this.user.fullName,
      userSubtitle: `${this.user.rollNumber || 'Student'} \u2022 ${this.user.currentHostel || 'Hostel'}`,
      navItems,
      activeTab: this.activeTab,
      rightActionsHtml: `<span class="badge badge-info" style="font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-graduation-cap"></i> ${this.user.academicYear ? 'Year ' + this.user.academicYear : 'B.Tech'}</span>`,
      contentHtml
    });

    // Load active hostel map if on allocation tab
    if (this.activeTab === 'allocation') {
      this.initHostelMap();
    }
  }

  getPhaseBadge() {
    if (this.user.academicYear === 1) return 'Year 1';
    const allotmentStatus = this.allocationStatusData?.semester?.allotmentStatus || 'NOT_STARTED';
    if (allotmentStatus === 'NOT_STARTED') return 'Closed';
    if (allotmentStatus === 'ENDED') return 'Ended';
    if (!this.clusterData) return 'P1: Pre-Alloc';
    if (this.clusterData.cluster.status === 'CONFIRMED') return 'P8: Confirmed';
    if (this.clusterData.cluster.status === 'ALLOCATED') return 'P7: Payment';
    if (this.clusterData.cluster.status === 'PREFERENCES_SUBMITTED') return 'P5: Pending';
    return 'P4: Select';
  }

  // 1. Dashboard View
  renderDashboard() {
    return `
      <div class="grid-3" style="margin-bottom: 28px;">
        <div class="stat-widget">
          <div class="stat-icon info"><i class="fa-solid fa-hotel"></i></div>
          <div class="stat-content">
            <span class="stat-label">Current Room</span>
            <span class="stat-value" style="font-size: 1.2rem;">${this.user.currentHostel} - ${this.user.currentRoom}</span>
          </div>
        </div>

        <div class="stat-widget">
          <div class="stat-icon primary"><i class="fa-solid fa-user-check"></i></div>
          <div class="stat-content">
            <span class="stat-label">Resident</span>
            <span class="stat-value" style="font-size: 1.15rem;">${this.user.rollNumber || 'Verified'}</span>
          </div>
        </div>

        <div class="stat-widget">
          <div class="stat-icon success"><i class="fa-solid fa-layer-group"></i></div>
          <div class="stat-content">
            <span class="stat-label">Allocation Status</span>
            <span class="stat-value" style="font-size: 1rem;">${this.getPhaseBadge()}</span>
          </div>
        </div>
      </div>

      <div class="card demo-focus-card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-bed"></i> Room Demo Actions</h3>
            <p class="card-subtitle">Use these room-focused flows for the demo. Passes, entry requests, complaints, and mess feedback are hidden.</p>
          </div>
        </div>
        <div class="demo-action-grid two-up">
          <button class="btn btn-secondary btn-large-action" id="btn-goto-alloc">
            <i class="fa-solid fa-sitemap" style="color: var(--primary);"></i>
            <span>Open Room Allocation</span>
          </button>
          <button class="btn btn-secondary btn-large-action" id="btn-goto-hostel-info">
            <i class="fa-solid fa-hotel" style="color: var(--info);"></i>
            <span>View Room & Hostel Info</span>
          </button>
        </div>
      </div>
    `;
  }

  // 2. Profile View (Section 5)
  renderProfile() {
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-address-card"></i> Student Resident Profile</h3>
          <span class="status-pill success"><i class="fa-solid fa-badge-check"></i> Verified Resident</span>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" value="${this.user.fullName}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Roll Number</label>
            <input type="text" class="form-input" value="${this.user.rollNumber}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Official Student Email</label>
            <input type="email" class="form-input" value="${this.user.email}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Academic Year & Program</label>
            <input type="text" class="form-input" value="Year ${this.user.academicYear} \u2014 ${this.user.course}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <input type="text" class="form-input" value="${this.user.gender}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Academic CGPA (Verified by Admin)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="form-input" value="${this.user.cgpa?.toFixed(2)}" disabled>
              <span class="status-pill success" style="align-self: center;">Verified</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Current Living Hostel</label>
            <input type="text" class="form-input" value="${this.user.currentHostel} (Room ${this.user.currentRoom})" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Linked Parent Email</label>
            <input type="email" class="form-input" value="${this.user.parentEmail}" disabled>
          </div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
        <h4 style="margin-bottom: 14px; font-size: 0.95rem;"><i class="fa-solid fa-pen-to-square"></i> Contact & Address Details</h4>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="text" id="prof-phone" class="form-input" value="${this.user.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Home Address</label>
            <input type="text" id="prof-address" class="form-input" value="${this.user.address || ''}">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-profile">Save Contact Changes</button>
      </div>
    `;
  }

  // 3. Room Allocation Workflow View (Section 14-32)
  renderAllocationSection() {
    // Check Rule 13: First-Year Students
    if (this.user.academicYear === 1) {
      return `
        <div class="card" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 3rem; color: var(--warning); margin-bottom: 16px;">
            <i class="fa-solid fa-building-user"></i>
          </div>
          <h2 style="margin-bottom: 10px;">First-Year Hostel Allocation Notice</h2>
          <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 20px;">
            Per university regulation <strong>(Section 13)</strong>, first-year students do not participate in the student-driven cluster allocation system.
            First-year students are assigned their hostel automatically by the college administration.
          </p>
          <div class="status-pill info" style="font-size: 0.9rem; padding: 8px 16px;">
            Current Assigned Accommodation: ${this.user.currentHostel} - Room ${this.user.currentRoom}
          </div>
        </div>
      `;
    }

    const cluster = this.clusterData?.cluster;
    const isLeader = cluster && cluster.leaderId === this.user.id;
    const pendingInvitation = this.clusterInvitations?.[0];
    const sem = this.allocationStatusData?.semester || {};
    const allotmentStatus = sem.allotmentStatus || 'NOT_STARTED';

    // Check if allotment window has not started yet
    if (allotmentStatus === 'NOT_STARTED') {
      return `
        <div class="card" style="text-align: center; padding: 48px 24px; max-width: 680px; margin: 30px auto;">
          <div style="font-size: 3.5rem; color: var(--warning); margin-bottom: 16px;">
            <i class="fa-solid fa-hourglass-start"></i>
          </div>
          <h2 style="margin-bottom: 10px;">Room Allotment Phase Not Started</h2>
          <p style="color: var(--text-secondary); max-width: 520px; margin: 0 auto 20px; line-height: 1.6; font-size: 0.95rem;">
            The hostel caretaker / administration has <strong>not yet opened</strong> the room allotment window for ${sem.name || 'this semester'}.
            Cluster formation, roommate pairing, and room preference submissions will be unlocked as soon as the caretaker begins the allotment phase.
          </p>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--warning-bg); border: 1px solid var(--warning-border); color: var(--warning); padding: 8px 18px; border-radius: 999px; font-size: 0.85rem;">
            <i class="fa-solid fa-circle-pause"></i> Window Status: Closed (Awaiting Caretaker Initiation)
          </div>
        </div>
      `;
    }

    // Check if allotment window is ended
    if (allotmentStatus === 'ENDED') {
      return `
        <div class="card" style="text-align: center; padding: 48px 24px; max-width: 680px; margin: 30px auto;">
          <div style="font-size: 3.5rem; color: var(--danger); margin-bottom: 16px;">
            <i class="fa-solid fa-lock"></i>
          </div>
          <h2 style="margin-bottom: 10px;">Room Allotment Concluded</h2>
          <p style="color: var(--text-secondary); max-width: 520px; margin: 0 auto 20px; line-height: 1.6; font-size: 0.95rem;">
            The room allotment window for ${sem.name || 'this semester'} has officially closed.
            All finalized allocations are locked. If you require emergency room changes, please contact your hostel caretaker directly.
          </p>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); padding: 8px 18px; border-radius: 999px; font-size: 0.85rem;">
            <i class="fa-solid fa-lock"></i> Window Status: Ended / Locked
          </div>
        </div>
      `;
    }

    return `
      <!-- 8-Phase Stepper Tracker -->
      <div class="allocation-stepper">
        <div class="stepper-header">
          <h3>Semester Room Allocation Lifecycle</h3>
          <span class="status-pill primary">Semester 1</span>
        </div>
        <div class="stepper-track">
          <div class="step-item ${cluster ? 'completed' : 'active'}">
            <div class="step-circle"><i class="fa-solid ${cluster ? 'fa-check' : 'fa-1'}"></i></div>
            <span class="step-title">1. Pre-Alloc</span>
          </div>
          <div class="step-item ${cluster ? 'completed' : ''}">
            <div class="step-circle"><i class="fa-solid ${cluster ? 'fa-check' : 'fa-2'}"></i></div>
            <span class="step-title">2. Cluster Formed</span>
          </div>
          <div class="step-item ${cluster ? 'completed' : ''}">
            <div class="step-circle"><i class="fa-solid ${cluster ? 'fa-check' : 'fa-3'}"></i></div>
            <span class="step-title">3. Eligibility</span>
          </div>
          <div class="step-item ${cluster?.preferences?.length ? 'completed' : (cluster ? 'active' : '')}">
            <div class="step-circle"><i class="fa-solid ${cluster?.preferences?.length ? 'fa-check' : 'fa-4'}"></i></div>
            <span class="step-title">4. Preferences</span>
          </div>
          <div class="step-item ${cluster?.status === 'ALLOCATED' || cluster?.status === 'CONFIRMED' ? 'completed' : ''}">
            <div class="step-circle"><i class="fa-solid ${cluster?.status === 'ALLOCATED' || cluster?.status === 'CONFIRMED' ? 'fa-check' : 'fa-5'}"></i></div>
            <span class="step-title">5. Resolution</span>
          </div>
          <div class="step-item ${cluster?.status === 'ALLOCATED' || cluster?.status === 'CONFIRMED' ? 'completed' : ''}">
            <div class="step-circle"><i class="fa-solid ${cluster?.status === 'ALLOCATED' || cluster?.status === 'CONFIRMED' ? 'fa-check' : 'fa-6'}"></i></div>
            <span class="step-title">6. Allotted</span>
          </div>
          <div class="step-item ${cluster?.paymentStatus === 'PAID' ? 'completed' : (cluster?.status === 'ALLOCATED' ? 'active' : '')}">
            <div class="step-circle"><i class="fa-solid ${cluster?.paymentStatus === 'PAID' ? 'fa-check' : 'fa-7'}"></i></div>
            <span class="step-title">7. Payment</span>
          </div>
          <div class="step-item ${cluster?.status === 'CONFIRMED' ? 'completed' : ''}">
            <div class="step-circle"><i class="fa-solid ${cluster?.status === 'CONFIRMED' ? 'fa-check' : 'fa-8'}"></i></div>
            <span class="step-title">8. Confirmed</span>
          </div>
        </div>
      </div>

      ${pendingInvitation ? this.renderClusterInvitationPrompt(pendingInvitation) : ''}
      ${cluster ? 
        this.renderFormedClusterWorkflow(cluster, isLeader) : 
        (this.submittedPref ? 
          this.renderSubmittedPreferenceCard(this.submittedPref) : 
          this.renderPreAllocationPreferenceForm())}
    `;
  }

  // Pre-Allocation Preference Form (Option A, B, C - Section 17)
  renderPreAllocationPreferenceForm() {
    return `
      <div class="card" style="max-width: 760px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-users-viewfinder"></i> Phase 1: Pre-Allocation Preference</h3>
          <span class="status-pill warning">Selection Open</span>
        </div>

        <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 0.88rem;">
          Choose how you wish to be grouped for room allocation. The system will build valid 4-student clusters sharing 2 rooms and 1 shared washroom.
        </p>

        <div class="form-group">
          <label class="form-label">Select Grouping Method (Section 17)</label>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <label style="display: flex; align-items: flex-start; gap: 12px; background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); cursor: pointer;">
              <input type="radio" name="alloc-option" value="OPTION_C" checked style="margin-top: 4px;">
              <div>
                <strong>Option C \u2014 Complete Cluster (4 Students)</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Specify all 4 student roll numbers. Submitting sends approval prompts to invited members; the cluster locks only after everyone approves.
                </div>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 12px; background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); cursor: pointer;">
              <input type="radio" name="alloc-option" value="OPTION_B" style="margin-top: 4px;">
              <div>
                <strong>Option B \u2014 Select One Roommate (Mutual Match)</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Select 1 roommate. If both select each other, you stay together, and SHARP pairs you with another compatible pair.
                </div>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 12px; background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); cursor: pointer;">
              <input type="radio" name="alloc-option" value="OPTION_A" style="margin-top: 4px;">
              <div>
                <strong>Option A \u2014 Random Allocation</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  No preferred roommate. The system groups you automatically with other compatible students.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div id="option-c-fields">
          <div class="form-group">
            <label class="form-label">Cluster Members' Roll Numbers (Including Yours)</label>
            <div class="grid-2">
              <input type="text" id="roll-1" class="form-input" value="${this.user.rollNumber}" disabled>
              <input type="text" id="roll-2" class="form-input" placeholder="Roll 2 (e.g. 1024260002)">
              <input type="text" id="roll-3" class="form-input" placeholder="Roll 3 (e.g. 1024260003)">
              <input type="text" id="roll-4" class="form-input" placeholder="Roll 4 (e.g. 1024260004)">
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: block;">
              Entering 4 distinct registered roll numbers will send approval requests to the invited students.
            </span>
          </div>
        </div>

        <div id="option-b-fields" style="display: none;">
          <div class="form-group">
            <label class="form-label">Preferred Roommate's Roll Number</label>
            <input type="text" id="partner-roll" class="form-input" placeholder="e.g. 1024260002">
          </div>
        </div>

        <button class="btn btn-primary" id="btn-submit-alloc-pref" style="width: 100%;">
          Submit Pre-Allocation Preference
        </button>
      </div>
    `;
  }

  // Submitted Preference Card (for Option B or Option A waiting for matching)
  renderSubmittedPreferenceCard(pref) {
    const isOptionB = pref.preferenceOption === 'OPTION_B';
    const isOptionA = pref.preferenceOption === 'OPTION_A';

    return `
      <div class="card" style="max-width: 720px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Pre-Allocation Preference Registered</h3>
          <span class="status-pill info">Awaiting Cluster Formation</span>
        </div>

        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Registered Grouping Method:</span>
            <strong style="color: var(--primary); font-size: 0.95rem;">
              ${isOptionB ? 'Option B \u2014 Select One Roommate (Mutual Match)' : (isOptionA ? 'Option A \u2014 Random Allocation' : 'Option C \u2014 4-Student Cluster')}
            </strong>
          </div>

          ${isOptionB ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.85rem; color: var(--text-secondary);">Preferred Partner Roll Number:</span>
              <strong style="color: var(--text-primary); font-size: 1rem; letter-spacing: 0.5px;">${pref.partnerRollNumber || 'N/A'}</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 8px 0 0 0;">
              Once your preferred partner also confirms or Caretaker runs cluster formation in Phase 2, you will be paired with another compatible pair into a complete 4-student cluster.
            </p>
          ` : `
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">
              You have chosen random allocation. The Caretaker and hostel allocation system will automatically group you with 3 compatible students sharing your year and gender during Phase 2.
            </p>
          `}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-color);">
          <span style="font-size: 0.8rem; color: var(--text-secondary);">
            Submitted at: ${new Date(pref.submittedAt || Date.now()).toLocaleString()}
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-change-preference">
            <i class="fa-solid fa-pen-to-square"></i> Change / Re-submit Preference
          </button>
        </div>
      </div>
    `;
  }

  renderClusterInvitationPrompt(cluster) {
    const leaderName = cluster.pendingMembers?.find(m => m.studentId === cluster.leaderId)?.fullName || 'Cluster leader';
    return `
      <div class="card" style="margin-bottom: 24px; border-left: 4px solid var(--warning);">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-user-check"></i> Cluster Invitation Pending</h3>
            <p class="card-subtitle">${leaderName} invited you to Cluster #${cluster.clusterNumber}. Approve to join or deny so the leader can invite another student.</p>
          </div>
          <span class="status-pill warning">Action Required</span>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-success btn-cluster-invite-response" data-cluster-id="${cluster.id}" data-decision="APPROVED">
            <i class="fa-solid fa-check"></i> Approve Invitation
          </button>
          <button class="btn btn-danger btn-cluster-invite-response" data-cluster-id="${cluster.id}" data-decision="DENIED">
            <i class="fa-solid fa-xmark"></i> Deny Invitation
          </button>
        </div>
      </div>
    `;
  }

  renderClusterApprovalStatus(cluster, isLeader) {
    const pendingMembers = cluster.pendingMembers || [];
    if (pendingMembers.length === 0) return '';
    return `
      <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md); margin-bottom: 16px;">
        <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
          Cluster Approval Status
        </span>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          ${pendingMembers.map(member => `
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;">
              <div>
                <strong>${member.fullName}</strong>
                <span style="color: var(--text-muted); font-size: 0.78rem;">${member.rollNumber}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-pill ${member.status === 'APPROVED' ? 'success' : (member.status === 'DENIED' ? 'danger' : 'warning')}">${member.status}</span>
                ${isLeader && member.studentId !== cluster.leaderId && member.status !== 'APPROVED' ? `
                  <input type="text" class="form-input cluster-replacement-roll" data-old-roll="${member.rollNumber}" placeholder="Replacement roll" style="width: 150px; padding: 6px 8px; font-family: var(--font-mono);">
                  <button class="btn btn-secondary btn-sm btn-replace-cluster-member" data-old-roll="${member.rollNumber}">Replace</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Formed Cluster Workflow (Phases 2 through 8)
  renderFormedClusterWorkflow(cluster, isLeader) {
    const leader = this.clusterData?.leader;
    const members = this.clusterData?.members || [];

    return `
      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Cluster Card -->
        <div class="card">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 class="card-title" style="margin: 0;">
                <i class="fa-solid fa-users"></i> Cluster #${cluster.clusterNumber}
              </h3>
              <span class="status-pill success">${cluster.status}</span>
            </div>
            ${isLeader && !['ALLOCATED', 'CONFIRMED'].includes(cluster.status) ? `
              <button class="btn btn-secondary btn-sm" id="btn-dissolve-cluster" style="padding: 4px 10px; font-size: 0.75rem; color: var(--danger); border-color: var(--danger-border);" title="Dissolve this cluster and re-form if needed">
                <i class="fa-solid fa-user-xmark"></i> Dissolve Cluster
              </button>
            ` : ''}
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.85rem; color: var(--text-secondary);">Cluster Average CGPA (Section 20):</span>
              <strong style="font-size: 1.2rem; color: var(--primary);">${cluster.averageCgpa.toFixed(3)}</strong>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Calculated as average of all 4 members. CGPA is never used to separate cluster members!
            </div>
          </div>

          ${this.renderClusterApprovalStatus(cluster, isLeader)}

          <!-- Eligible Hostels (Section 21-22) -->
          ${cluster.status === 'FORMED' || cluster.eligibleHostels?.length ? `
          <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md); margin-bottom: 16px;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
              Cluster-Level Eligible Hostels:
            </span>
            <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
              ${cluster.eligibleHostels.map(h => `<span class="status-pill info">${h}</span>`).join('')}
            </div>
          </div>
          ` : `
            <div style="background: var(--warning-bg); border: 1px solid var(--warning-border); color: var(--warning); padding: 12px; border-radius: var(--radius-md); margin-bottom: 16px; font-size: 0.86rem;">
              <i class="fa-solid fa-hourglass-half"></i> Eligible hostels unlock after every invited student approves the cluster.
            </div>
          `}

          <!-- Cluster Members Table -->
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>CGPA</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                ${members.map(m => `
                  <tr>
                    <td><strong>${m.rollNumber}</strong></td>
                    <td>${m.fullName}</td>
                    <td>${m.cgpa.toFixed(2)}</td>
                    <td>
                      ${m.id === cluster.leaderId ? 
                        `<span class="status-pill warning"><i class="fa-solid fa-crown"></i> Leader</span>` : 
                        `<span style="color: var(--text-muted); font-size: 0.75rem;">Member</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Leader Hand-off / Change (Section 26) -->
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.78rem; color: var(--text-secondary);">
              Current Leader: <strong>${leader?.fullName || 'Assigned'}</strong>
            </span>
            <button class="btn btn-secondary btn-sm" id="btn-change-leader-modal">
              <i class="fa-solid fa-arrows-rotate"></i> Change Leader
            </button>
          </div>
        </div>

        <!-- Allocation Outcome & Payment Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-door-open"></i> Allocation Outcome & Status</h3>
            <span class="status-pill ${cluster.status === 'CONFIRMED' ? 'success' : (cluster.status === 'ALLOCATED' ? 'warning' : 'info')}">
              ${cluster.status}
            </span>
          </div>

          ${cluster.status === 'CONFIRMED' ? `
            <div style="background: var(--success-bg); border: 1px solid var(--success-border); padding: 18px; border-radius: var(--radius-md); margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 10px; color: var(--success); font-weight: 700; margin-bottom: 6px;">
                <i class="fa-solid fa-circle-check fa-lg"></i> Allocation Confirmed!
              </div>
              <p style="font-size: 0.85rem; color: var(--text-primary); margin: 0 0 10px;">
                Your cluster has finalized room pair <strong>${cluster.assignedRoomPairNumber}</strong> in <strong>${cluster.assignedHostel}</strong>.
              </p>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">
                Receipt No: <code>${cluster.paymentReceipt?.receiptNumber}</code> (Paid via ${cluster.paymentReceipt?.method})
              </div>
            </div>
          ` : cluster.status === 'ALLOCATED' ? `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning-border); padding: 18px; border-radius: var(--radius-md); margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 10px; color: var(--warning); font-weight: 700; margin-bottom: 6px;">
                <i class="fa-solid fa-hourglass-half fa-lg"></i> Room Pair Allocated \u2014 Pending Fee Payment
              </div>
              <p style="font-size: 0.85rem; color: var(--text-primary); margin: 0 0 10px;">
                Your cluster has been allotted Room Pair <strong>${cluster.assignedRoomPairNumber}</strong> in <strong>${cluster.assignedHostel}</strong>!
                To confirm this allotment into your permanent residency record, complete the semester hostel & mess fee payment.
              </p>
              <button class="btn btn-success" id="btn-pay-fees-modal">
                <i class="fa-solid fa-credit-card"></i> Pay Hostel & Mess Fees (\u20b980,000)
              </button>
            </div>
          ` : `
            <div style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 16px;">
              ${cluster.preferences?.length > 0 ? 
                `<p>Preferences submitted! Awaiting caretaker to trigger conflict resolution and allocation.</p>` : 
                `<p>Your cluster leader must select 3 room-pair preferences on the visual hostel map below.</p>`}
            </div>
          `}

          <!-- Submitted Preferences List -->
          <div style="margin-top: 14px;">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">Submitted Room Preferences:</h4>
            ${cluster.preferences?.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${cluster.preferences.map(p => `
                  <div style="display: flex; justify-content: space-between; background: var(--bg-card-hover); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <span><strong>Pref #${p.rank}:</strong> ${p.roomPairNumber} (${p.hostelName})</span>
                    ${cluster.assignedRoomPairNumber === p.roomPairNumber ? 
                      `<span class="status-pill success">Allotted</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `<div style="font-size: 0.8rem; color: var(--text-muted);">No preferences submitted yet.</div>`}
          </div>
        </div>
      </div>

      ${cluster.status === 'FORMED' || cluster.status === 'ALLOCATED' || cluster.status === 'CONFIRMED' || cluster.preferences?.length ? `
      <!-- Phase 4: Visual Hostel Map & Room Selection -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-map-location-dot"></i> Phase 4: Interactive Visual Hostel Map</h3>
          <div style="display: flex; gap: 12px; align-items: center;">
            <label class="form-label" style="margin: 0;">Select Eligible Hostel:</label>
            <select id="map-hostel-select" class="form-select" style="width: auto;">
              ${cluster.eligibleHostels.map(h => `<option value="${h}">${h}</option>`).join('')}
            </select>
          </div>
        </div>

        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
          ${isLeader ? 
            `<strong>You are the Cluster Leader.</strong> Click on room-pair blocks to pick your cluster's 1st, 2nd, and 3rd preferences, then submit.` : 
            `<strong>You are viewing the hostel map.</strong> Only Cluster Leader <em>(${leader?.fullName})</em> can submit preferences.`}
        </p>

        <!-- Container where HostelMap mounts -->
        <div id="student-hostel-map-mount"></div>

        ${isLeader ? `
          <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-submit-room-prefs">
              <i class="fa-solid fa-paper-plane"></i> Save & Submit 3 Room Preferences
            </button>
          </div>
        ` : ''}
      </div>
      ` : `
        <div class="card" style="text-align: center; padding: 28px;">
          <div style="font-size: 2rem; color: var(--warning); margin-bottom: 10px;"><i class="fa-solid fa-user-clock"></i></div>
          <h3 style="margin-bottom: 8px;">Waiting for Cluster Approvals</h3>
          <p style="color: var(--text-secondary); max-width: 560px; margin: 0 auto; font-size: 0.9rem;">
            Room selection is locked until every invited student approves the cluster. The group leader can replace denied or pending invitees above.
          </p>
        </div>
      `}
    `;
  }

  initHostelMap() {
    const mount = document.getElementById('student-hostel-map-mount');
    const select = document.getElementById('map-hostel-select');
    if (!mount || !select || !this.clusterData) return;

    const cluster = this.clusterData.cluster;
    const isLeader = cluster.leaderId === this.user.id;

    this.selectedPreferences = cluster.preferences ? [...cluster.preferences] : [];

    this.hostelMapInstance = new HostelMap(mount, {
      interactive: isLeader && cluster.status === 'FORMED',
      maxPreferences: 3,
      selectedPreferences: this.selectedPreferences,
      onPreferencesChange: (prefs) => {
        this.selectedPreferences = prefs;
      }
    });

    const initialHostel = select.value || cluster.eligibleHostels[0];
    this.hostelMapInstance.loadHostel(initialHostel);

    select.addEventListener('change', () => {
      this.hostelMapInstance.loadHostel(select.value);
    });
  }

  // 4. Digital Passes View (Section 11)
  renderPassesSection() {
    return `
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-ticket"></i> Active Digital Passes</h3>
          <button class="btn btn-secondary btn-sm" id="btn-request-pass-quick">
            <i class="fa-solid fa-plus"></i> Request New Pass
          </button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
          Approved leaves and late returns automatically generate tamper-evident digital passes with QR verification and approval stamps.
        </p>

        <div id="passes-grid" class="grid-2">
          <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>
    `;
  }

  async loadPasses() {
    const grid = document.getElementById('passes-grid');
    if (!grid) return;
    try {
      const res = await fetch(`/api/leaves/student/${this.user.id}`);
      const data = await res.json();
      const passes = data.passes || [];

      if (passes.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">No active passes generated yet. Request a leave or local entry to get started.</div>`;
        return;
      }

      grid.innerHTML = passes.map(p => `
        <div class="digital-pass-card">
          <div class="pass-header">
            <div>
              <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary);">
                ${p.passType === 'LOCAL_ENTRY' ? 'LOCAL ENTRY / LATE RETURN PASS' : 'HOME LEAVE PASS'}
              </div>
              <h3 style="font-size: 1.2rem; margin-top: 2px;">${p.id}</h3>
            </div>
            <span class="pass-badge"><i class="fa-solid fa-shield-check"></i> ${p.status}</span>
          </div>

          <div class="pass-body">
            <div>
              <div class="pass-field">
                <span class="pass-field-label">Student Name & Roll No</span>
                <div class="pass-field-value">${p.studentName} (${p.studentRollNumber})</div>
              </div>
              <div class="pass-field">
                <span class="pass-field-label">Hostel & Room</span>
                <div class="pass-field-value">${p.hostel} - Room ${p.roomNumber}</div>
              </div>
              <div class="pass-field">
                <span class="pass-field-label">Valid Timings / Dates</span>
                <div class="pass-field-value">${p.date} (${p.startTime} \u2014 ${p.endTime})</div>
              </div>
              <div class="pass-field">
                <span class="pass-field-label">Purpose</span>
                <div class="pass-field-value" style="font-size: 0.85rem; font-weight: 500;">${p.purpose}</div>
              </div>
            </div>

            <div class="pass-qr-box">
              <div class="qr-code-mock"></div>
              <span class="qr-label">${p.qrToken.slice(-10)}</span>
            </div>
          </div>

          <div class="pass-footer">
            <div class="pass-stamps">
              <span class="approval-stamp"><i class="fa-solid fa-check-double"></i> ${p.parentApproval}</span>
              <span class="approval-stamp"><i class="fa-solid fa-check-double"></i> ${p.caretakerApproval}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.print()" style="font-size: 0.72rem; padding: 3px 8px;">
              <i class="fa-solid fa-print"></i> Print
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      grid.innerHTML = `<div class="error-msg">Failed to load passes: ${err.message}</div>`;
    }
  }

  // 5. Leave & Local Entry Requests View (Section 9 & 10)
  renderRequestsSection() {
    return `
      <div class="grid-2">
        <!-- New Request Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-plus-circle"></i> Create New Request</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Request Type</label>
            <select id="req-type" class="form-select">
              <option value="LOCAL_ENTRY">Local Entry / Late Return (Dual Approval)</option>
              <option value="HOME_LEAVE">Home Leave Request (Parent Approval)</option>
            </select>
          </div>

          <!-- Local Entry Fields -->
          <div id="local-entry-fields">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" id="local-date" class="form-input" value="2026-09-12">
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Out Time</label>
                <input type="time" id="local-start-time" class="form-input" value="18:00">
              </div>
              <div class="form-group">
                <label class="form-label">Return Time (After Hostel Hours)</label>
                <input type="time" id="local-end-time" class="form-input" value="22:30">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reason</label>
              <input type="text" id="local-reason" class="form-input" placeholder="e.g. Group study at central library">
            </div>
          </div>

          <!-- Home Leave Fields -->
          <div id="home-leave-fields" style="display: none;">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Departure Date</label>
                <input type="date" id="home-from-date" class="form-input" value="2026-09-15">
              </div>
              <div class="form-group">
                <label class="form-label">Return Date</label>
                <input type="date" id="home-to-date" class="form-input" value="2026-09-18">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reason for Home Leave</label>
              <input type="text" id="home-reason" class="form-input" placeholder="e.g. Family function">
            </div>
          </div>

          <button class="btn btn-primary" id="btn-submit-request" style="width: 100%;">
            Submit Request
          </button>
        </div>

        <!-- Request Status Tracker (Section 10 Dual-Approval Flow) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-list-check"></i> Request Status & History</h3>
          </div>
          <div id="requests-history-mount">
            <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
          </div>
        </div>
      </div>
    `;
  }

  async loadRequestsHistory() {
    const mount = document.getElementById('requests-history-mount');
    if (!mount) return;

    try {
      const res = await fetch(`/api/leaves/student/${this.user.id}`);
      const data = await res.json();
      const localEntries = data.localEntries || [];
      const homeLeaves = data.homeLeaves || [];

      let html = '';

      if (localEntries.length === 0 && homeLeaves.length === 0) {
        mount.innerHTML = `<div class="empty-state">No requests submitted yet.</div>`;
        return;
      }

      html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;

      localEntries.forEach(e => {
        html += `
          <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong><i class="fa-solid fa-clock"></i> Local Entry (${e.date})</strong>
              <span class="status-pill ${e.status === 'APPROVED' ? 'success' : (e.status === 'REJECTED' ? 'danger' : 'warning')}">${e.status}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px;">
              Return Time: ${e.endTime} | Reason: ${e.reason}
            </div>
            <div style="display: flex; gap: 10px; font-size: 0.75rem;">
              <span>Parent: <strong style="color: ${e.parentApproval === 'APPROVED' ? 'var(--success)' : 'var(--warning)'};">${e.parentApproval}</strong></span>
              <span>Caretaker: <strong style="color: ${e.caretakerApproval === 'APPROVED' ? 'var(--success)' : 'var(--warning)'};">${e.caretakerApproval}</strong></span>
            </div>
          </div>
        `;
      });

      homeLeaves.forEach(h => {
        html += `
          <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong><i class="fa-solid fa-house"></i> Home Leave (${h.fromDate} to ${h.toDate})</strong>
              <span class="status-pill ${h.status === 'APPROVED' ? 'success' : (h.status === 'REJECTED' ? 'danger' : 'warning')}">${h.status}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Reason: ${h.reason} | Parent Approval: <strong>${h.parentApproval}</strong>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      mount.innerHTML = html;
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  // 6. Complaints View (Section 7 & 8)
  renderComplaintsSection() {
    return `
      <div class="grid-2">
        <!-- Maintenance Complaint Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-wrench"></i> Lodge Hostel Complaint</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Complaint Type</label>
            <select id="comp-type" class="form-select">
              <option value="MAINTENANCE">Hostel Maintenance Complaint</option>
              <option value="LAUNDRY">Laundry Service Complaint</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Issue Category</label>
            <select id="comp-category" class="form-select">
              <option value="Electrical problems">Electrical problems (fan, lights, socket)</option>
              <option value="Plumbing issues">Plumbing issues (taps, flush, leakage)</option>
              <option value="Fan/AC problems">Fan/AC cooling issues</option>
              <option value="Furniture damage">Furniture damage (table, bed, cupboard)</option>
              <option value="Bathroom problems">Bathroom problems</option>
              <option value="Room problems">Room problems (doors, windows)</option>
              <option value="Missing clothing item">Missing clothing item (Laundry)</option>
              <option value="Damaged clothes">Damaged/stained clothes (Laundry)</option>
              <option value="Other maintenance issues">Other maintenance issues</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Problem Description</label>
            <textarea id="comp-desc" class="form-textarea" placeholder="Detailed description of the problem..."></textarea>
          </div>

          <button class="btn btn-primary" id="btn-submit-complaint" style="width: 100%;">
            Submit Complaint to Caretaker
          </button>
        </div>

        <!-- Complaint History -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-timeline"></i> Complaint History & Status</h3>
          </div>
          <div id="complaints-list-mount">
            <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
          </div>
        </div>
      </div>
    `;
  }

  async loadComplaints() {
    const mount = document.getElementById('complaints-list-mount');
    if (!mount) return;

    try {
      const res = await fetch(`/api/complaints/student/${this.user.id}`);
      const data = await res.json();
      const complaints = data.complaints || [];

      if (complaints.length === 0) {
        mount.innerHTML = `<div class="empty-state">No complaints registered.</div>`;
        return;
      }

      mount.innerHTML = complaints.map(c => `
        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong>${c.category}</strong>
            <span class="status-pill ${c.status === 'RESOLVED' ? 'success' : (c.status === 'IN_PROGRESS' ? 'info' : 'warning')}">
              ${c.status}
            </span>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;">${c.description}</p>
          ${c.caretakerNotes ? `
            <div style="font-size: 0.75rem; color: var(--primary); background: var(--primary-glow); padding: 6px 10px; border-radius: var(--radius-sm);">
              <i class="fa-solid fa-comment-dots"></i> Caretaker Note: ${c.caretakerNotes}
            </div>
          ` : ''}
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 6px;">
            Lodged: ${new Date(c.createdAt).toLocaleString()}
          </div>
        </div>
      `).join('');
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  // 7. Room & Hostel Information (Section 12)
  renderHostelInfoSection() {
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-hotel"></i> Resident Accommodation Information</h3>
          <span class="status-pill info">Section 12</span>
        </div>

        <div class="grid-2" style="margin-bottom: 24px;">
          <div class="stat-widget">
            <div class="stat-icon primary"><i class="fa-solid fa-door-open"></i></div>
            <div class="stat-content">
              <span class="stat-label">Current Living Hostel</span>
              <span class="stat-value" style="font-size: 1.3rem;">${this.user.currentHostel}</span>
            </div>
          </div>

          <div class="stat-widget">
            <div class="stat-icon success"><i class="fa-solid fa-key"></i></div>
            <div class="stat-content">
              <span class="stat-label">Room Number</span>
              <span class="stat-value" style="font-size: 1.3rem;">Room ${this.user.currentRoom}</span>
            </div>
          </div>
        </div>

        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <h4 style="font-size: 0.9rem; margin-bottom: 8px;">Roommates in Current Room</h4>
          <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text-secondary);">
            ${this.user.currentRoommates?.length ? 
              this.user.currentRoommates.map(r => `<li>${r}</li>`).join('') : 
              `<li>No roommates assigned</li>`}
          </ul>
        </div>

        <div style="background: var(--bg-subtle); border: 1px solid var(--border-glow); border-radius: var(--radius-md); padding: 14px;">
          <div style="font-weight: 700; font-size: 0.82rem; color: var(--primary); margin-bottom: 4px;">
            <i class="fa-solid fa-circle-info"></i> Section 14 Transition Invariant
          </div>
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0;">
            Students participate in semester allocation while continuing to live in their existing hostel. Only after final allocation is complete and payment is confirmed does the student's accommodation update.
          </p>
        </div>
      </div>
    `;
  }

  // 8. Mess Feedback View (Section 6)
  renderMessSection() {
    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-star"></i> Submit Categorized Mess Feedback</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Feedback is anonymous to mess staff to ensure honest reviews, while tracked internally to maintain accountability.
          </p>

          <div class="form-group">
            <label class="form-label">Meal Type</label>
            <select id="mess-meal" class="form-select">
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Snacks">Evening Snacks</option>
              <option value="Dinner" selected>Dinner</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="mess-cat" class="form-select">
              <option value="Food Quality">Food Quality & Freshness</option>
              <option value="Hygiene">Hygiene & Cleanliness</option>
              <option value="Quantity">Portion / Quantity</option>
              <option value="Timing & Service">Timing & Staff Service</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Rating (1 to 5 Stars)</label>
            <select id="mess-rating" class="form-select">
              <option value="5">\u2b50\u2b50\u2b50\u2b50\u2b50 Excellent (5/5)</option>
              <option value="4" selected>\u2b50\u2b50\u2b50\u2b50 Good (4/5)</option>
              <option value="3">\u2b50\u2b50\u2b50 Average (3/5)</option>
              <option value="2">\u2b50\u2b50 Poor (2/5)</option>
              <option value="1">\u2b50 Unsatisfactory (1/5)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Comments</label>
            <textarea id="mess-comments" class="form-textarea" placeholder="Provide specific feedback on food items..."></textarea>
          </div>

          <button class="btn btn-primary" id="btn-submit-mess" style="width: 100%;">
            Submit Anonymous Feedback
          </button>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-utensils"></i> Recent Mess Reviews</h3>
          </div>
          <div id="mess-feedback-list">
            <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
          </div>
        </div>
      </div>
    `;
  }

  async loadMessFeedback() {
    const mount = document.getElementById('mess-feedback-list');
    if (!mount) return;

    try {
      const res = await fetch('/api/complaints/mess-feedback');
      const data = await res.json();
      const feedback = data.feedback || [];

      if (feedback.length === 0) {
        mount.innerHTML = `<div class="empty-state">No feedback logged yet.</div>`;
        return;
      }

      mount.innerHTML = feedback.slice(0, 5).map(f => `
        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong>${f.mealType} \u2014 ${f.category}</strong>
            <span style="color: var(--warning); font-size: 0.85rem;">${'\u2605'.repeat(f.rating)}${'\u2606'.repeat(5 - f.rating)}</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 6px;">"${f.comments}"</p>
          <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span><i class="fa-solid fa-user-secret"></i> Anonymous Student</span>
            <span>${f.date}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  // Attach Event Handlers
  attachEvents() {
    attachPortalShellEvents();

    // Navigation Tabs
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.activeTab = tab;
        this.render();
        this.attachEvents();

        if (tab === 'requests') this.loadRequestsHistory();
        if (tab === 'complaints') this.loadComplaints();
        if (tab === 'mess') this.loadMessFeedback();
      });
    });

    // Quick buttons from dashboard
    const btnGotoAlloc = document.getElementById('btn-goto-alloc');
    if (btnGotoAlloc) {
      btnGotoAlloc.addEventListener('click', () => {
        this.activeTab = 'allocation';
        this.render();
        this.attachEvents();
      });
    }

    const btnGotoHostelInfo = document.getElementById('btn-goto-hostel-info');
    if (btnGotoHostelInfo) {
      btnGotoHostelInfo.addEventListener('click', () => {
        this.activeTab = 'hostel-info';
        this.render();
        this.attachEvents();
      });
    }

    // Toggle Allocation Options Radio
    document.querySelectorAll('input[name="alloc-option"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const opt = e.target.value;
        const optC = document.getElementById('option-c-fields');
        const optB = document.getElementById('option-b-fields');
        if (opt === 'OPTION_C') {
          if (optC) optC.style.display = 'block';
          if (optB) optB.style.display = 'none';
        } else if (opt === 'OPTION_B') {
          if (optC) optC.style.display = 'none';
          if (optB) optB.style.display = 'block';
        } else {
          if (optC) optC.style.display = 'none';
          if (optB) optB.style.display = 'none';
        }
      });
    });

    // Submit Pre-Allocation Preference
    const btnSubmitAllocPref = document.getElementById('btn-submit-alloc-pref');
    if (btnSubmitAllocPref) {
      btnSubmitAllocPref.addEventListener('click', async () => {
        const option = document.querySelector('input[name="alloc-option"]:checked')?.value;
        let partnerRoll = null;
        let clusterRolls = null;

        if (option === 'OPTION_B') {
          partnerRoll = document.getElementById('partner-roll')?.value.trim();
          if (!partnerRoll) {
            this.app.toast('Please enter your partner\'s roll number', 'warning');
            return;
          }
        }

        if (option === 'OPTION_C') {
          const r1 = this.user.rollNumber;
          const r2 = document.getElementById('roll-2')?.value.trim();
          const r3 = document.getElementById('roll-3')?.value.trim();
          const r4 = document.getElementById('roll-4')?.value.trim();
          if (!r2 || !r3 || !r4) {
            this.app.toast('Please enter all 4 cluster roll numbers', 'warning');
            return;
          }
          clusterRolls = [r1, r2, r3, r4];
        }

        try {
          const res = await fetch('/api/allocation/preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: this.user.id,
              rollNumber: this.user.rollNumber,
              preferenceOption: option,
              partnerRollNumber: partnerRoll,
              clusterRollNumbers: clusterRolls
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast(data.message || 'Preference saved successfully!', 'success');
          await this.fetchStudentData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Change / Re-submit Preference
    const btnChangePref = document.getElementById('btn-change-preference');
    if (btnChangePref) {
      btnChangePref.addEventListener('click', () => {
        this.submittedPref = null;
        this.render();
        this.attachEvents();
      });
    }

    document.querySelectorAll('.btn-cluster-invite-response').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/allocation/cluster-invitations/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clusterId: btn.getAttribute('data-cluster-id'),
              studentId: this.user.id,
              decision: btn.getAttribute('data-decision')
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          this.app.toast(data.message, 'success');
          await this.fetchStudentData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    document.querySelectorAll('.btn-replace-cluster-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oldRoll = btn.getAttribute('data-old-roll');
        const input = document.querySelector(`.cluster-replacement-roll[data-old-roll="${oldRoll}"]`);
        const newRoll = input?.value.trim();
        if (!newRoll) {
          this.app.toast('Enter a replacement student roll number', 'warning');
          return;
        }
        try {
          const res = await fetch('/api/allocation/cluster-invitations/replace-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clusterId: this.clusterData.cluster.id,
              leaderId: this.user.id,
              oldRollNumber: oldRoll,
              newRollNumber: newRoll
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          this.app.toast(data.message, 'success');
          await this.fetchStudentData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    // Dissolve Cluster (Leader)
    const btnDissolveCluster = document.getElementById('btn-dissolve-cluster');
    if (btnDissolveCluster) {
      btnDissolveCluster.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to dissolve Cluster #' + (this.clusterData?.cluster?.clusterNumber || '') + '? All 4 members will be released and you can re-form.')) {
          return;
        }
        try {
          const res = await fetch('/api/allocation/dissolve-cluster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clusterId: this.clusterData.cluster.id,
              studentId: this.user.id
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast(data.message || 'Cluster dissolved successfully.', 'success');
          this.clusterData = null;
          this.submittedPref = null;
          await this.fetchStudentData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Submit Room Preferences (Leader)
    const btnSubmitRoomPrefs = document.getElementById('btn-submit-room-prefs');
    if (btnSubmitRoomPrefs) {
      btnSubmitRoomPrefs.addEventListener('click', async () => {
        if (!this.selectedPreferences || this.selectedPreferences.length === 0) {
          this.app.toast('Please select at least 1 room-pair preference on the map', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/allocation/submit-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clusterId: this.clusterData.cluster.id,
              leaderId: this.user.id,
              preferences: this.selectedPreferences
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Room preferences submitted successfully!', 'success');
          await this.fetchStudentData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Change Leader Modal Trigger
    const btnChangeLeader = document.getElementById('btn-change-leader-modal');
    if (btnChangeLeader) {
      btnChangeLeader.addEventListener('click', () => {
        this.openChangeLeaderModal();
      });
    }

    // Pay Fees Modal Trigger
    const btnPayFees = document.getElementById('btn-pay-fees-modal');
    if (btnPayFees) {
      btnPayFees.addEventListener('click', () => {
        this.openPaymentGatewayModal();
      });
    }

    // Toggle Request Type
    const reqTypeSelect = document.getElementById('req-type');
    if (reqTypeSelect) {
      reqTypeSelect.addEventListener('change', (e) => {
        const isLocal = e.target.value === 'LOCAL_ENTRY';
        document.getElementById('local-entry-fields').style.display = isLocal ? 'block' : 'none';
        document.getElementById('home-leave-fields').style.display = isLocal ? 'none' : 'block';
      });
    }

    // Submit Leave/Entry Request
    const btnSubmitReq = document.getElementById('btn-submit-request');
    if (btnSubmitReq) {
      btnSubmitReq.addEventListener('click', async () => {
        const type = document.getElementById('req-type').value;

        if (type === 'LOCAL_ENTRY') {
          const date = document.getElementById('local-date').value;
          const startTime = document.getElementById('local-start-time').value;
          const endTime = document.getElementById('local-end-time').value;
          const reason = document.getElementById('local-reason').value.trim();

          if (!reason) {
            this.app.toast('Please specify a reason for local entry', 'warning');
            return;
          }

          try {
            const res = await fetch('/api/leaves/local-entry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: this.user.id,
                date,
                startTime,
                endTime,
                reason
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.app.toast('Local entry request submitted! Dual approval initiated.', 'success');
            document.getElementById('local-reason').value = '';
            this.loadRequestsHistory();
          } catch (err) {
            this.app.toast(err.message, 'danger');
          }
        } else {
          const fromDate = document.getElementById('home-from-date').value;
          const toDate = document.getElementById('home-to-date').value;
          const reason = document.getElementById('home-reason').value.trim();

          if (!reason) {
            this.app.toast('Please specify reason for home leave', 'warning');
            return;
          }

          try {
            const res = await fetch('/api/leaves/home-leave', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: this.user.id,
                fromDate,
                toDate,
                reason
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.app.toast('Home leave request submitted to Parent Portal.', 'success');
            document.getElementById('home-reason').value = '';
            this.loadRequestsHistory();
          } catch (err) {
            this.app.toast(err.message, 'danger');
          }
        }
      });
    }

    // Submit Complaint
    const btnSubmitComp = document.getElementById('btn-submit-complaint');
    if (btnSubmitComp) {
      btnSubmitComp.addEventListener('click', async () => {
        const type = document.getElementById('comp-type').value;
        const category = document.getElementById('comp-category').value;
        const description = document.getElementById('comp-desc').value.trim();

        if (!description) {
          this.app.toast('Please enter complaint description', 'warning');
          return;
        }

        const endpoint = type === 'LAUNDRY' ? '/api/complaints/laundry' : '/api/complaints/maintenance';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: this.user.id,
              category,
              description
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Complaint submitted to caretaker!', 'success');
          document.getElementById('comp-desc').value = '';
          this.loadComplaints();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Submit Mess Feedback
    const btnSubmitMess = document.getElementById('btn-submit-mess');
    if (btnSubmitMess) {
      btnSubmitMess.addEventListener('click', async () => {
        const mealType = document.getElementById('mess-meal').value;
        const category = document.getElementById('mess-cat').value;
        const rating = document.getElementById('mess-rating').value;
        const comments = document.getElementById('mess-comments').value.trim();

        if (!comments) {
          this.app.toast('Please write a brief comment', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/complaints/mess-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mealType,
              category,
              rating,
              comments,
              hostelName: `${this.user.currentHostel} Mess`,
              anonymous: true
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Mess feedback submitted anonymously!', 'success');
          document.getElementById('mess-comments').value = '';
          this.loadMessFeedback();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }
  }

  // Change Cluster Leader Modal (Section 26)
  openChangeLeaderModal() {
    const members = this.clusterData?.members || [];
    const modalBody = `
      <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 16px;">
        Every cluster has one designated leader responsible for submitting room preferences. Another member can be designated leader if needed (Section 26).
      </p>
      <div class=\"form-group\">
        <label class=\"form-label\">Select New Cluster Leader</label>
        <select id=\"modal-select-new-leader\" class=\"form-select\">
          ${members.map(m => `
            <option value=\"${m.id}\" ${m.id === this.clusterData.cluster.leaderId ? 'selected' : ''}>
              ${m.fullName} (${m.rollNumber}) ${m.id === this.clusterData.cluster.leaderId ? '\u2014 [Current Leader]' : ''}
            </option>
          `).join('')}
        </select>
      </div>
    `;

    this.app.openModal('Change Cluster Leader', modalBody, [
      {
        label: 'Confirm New Leader',
        class: 'btn-primary',
        onClick: async () => {
          const newLeaderId = document.getElementById('modal-select-new-leader').value;
          try {
            const res = await fetch('/api/allocation/change-leader', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clusterId: this.clusterData.cluster.id,
                newLeaderId
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.app.closeModal();
            this.app.toast('Cluster leader updated successfully!', 'success');
            await this.fetchStudentData();
            this.render();
            this.attachEvents();
          } catch (err) {
            this.app.toast(err.message, 'danger');
          }
        }
      }
    ]);
  }

  // Payment Gateway Simulation Modal (Section 32)
  openPaymentGatewayModal() {
    const cluster = this.clusterData.cluster;
    const modalBody = `
      <div style=\"background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success-border); padding: 14px; border-radius: var(--radius-md); margin-bottom: 18px;\">
        <h4 style=\"color: var(--success); margin-bottom: 4px;\">Hostel Allotment Secured</h4>
        <p style=\"font-size: 0.82rem; color: var(--text-secondary); margin: 0;\">
          Room Pair <strong>${cluster.assignedRoomPairNumber}</strong> (${cluster.assignedHostel}).
        </p>
      </div>

      <div style=\"background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px;\">
        <div style=\"display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.88rem;\">
          <span>Semester Hostel Accommodation Fee:</span>
          <strong>\u20b955,000</strong>
        </div>
        <div style=\"display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.88rem;\">
          <span>Semester Mess Advance Fee:</span>
          <strong>\u20b925,000</strong>
        </div>
        <hr style=\"border: none; border-top: 1px solid var(--border-color); margin: 8px 0;\">
        <div style=\"display: flex; justify-content: space-between; font-size: 1.05rem; font-weight: 700;\">
          <span>Total Payable:</span>
          <span style=\"color: var(--primary);\">\u20b980,000</span>
        </div>
      </div>

      <div class=\"form-group\">
        <label class=\"form-label\">Payment Method</label>
        <select id=\"pay-method\" class=\"form-select\">
          <option value=\"UPI / QR (Instant)\">UPI / QR (Instant Confirmation)</option>
          <option value=\"Net Banking (HDFC/SBI/ICICI)\">Net Banking</option>
          <option value=\"Debit/Credit Card\">Debit / Credit Card</option>
        </select>
      </div>
    `;

    this.app.openModal('Hostel & Mess Fee Checkout', modalBody, [
      {
        label: 'Complete Payment (\u20b980,000)',
        class: 'btn-success',
        onClick: async () => {
          const method = document.getElementById('pay-method').value;
          try {
            const res = await fetch('/api/allocation/pay-fees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clusterId: cluster.id,
                studentId: this.user.id,
                amount: 80000,
                method
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.app.closeModal();
            this.app.toast('Payment confirmed! Room allocation officially finalized.', 'success');
            await this.fetchStudentData();
            this.render();
            this.attachEvents();
          } catch (err) {
            this.app.toast(err.message, 'danger');
          }
        }
      }
    ]);
  }
}
