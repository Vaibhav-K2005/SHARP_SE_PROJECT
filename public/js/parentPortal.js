// public/js/parentPortal.js
import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';
export class ParentPortal {
  constructor(app, user) {
    this.app = app;
    this.user = user;
    this.linkedStudent = null;
    this.activeTab = 'child-overview';
  }

  async init() {
    await this.fetchParentData();
    this.render();
    this.attachEvents();
    this.loadApprovals();
  }

  async fetchParentData() {
    try {
      if (this.user.studentRollNumber) {
        const usersRes = await fetch('/api/admin/users');
        const { users } = await usersRes.json();
        this.linkedStudent = users.find(u => u.rollNumber === this.user.studentRollNumber);
      }
    } catch (err) {
      console.error('Failed to fetch parent data:', err);
    }
  }

  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    if (!this.linkedStudent) {
      mount.innerHTML = this.renderLinkingForm();
      this.attachLinkingEvents();
      return;
    }

    const navItems = [
      { id: 'child-overview', icon: 'fa-child', label: 'Child Overview' },
      { id: 'report-caretaker', icon: 'fa-paper-plane', label: 'Report to Caretaker' }
    ];

    if (!navItems.some(item => item.id === this.activeTab)) {
      this.activeTab = 'child-overview';
    }

    const contentHtml = `
      <!-- Content Panes -->
      <div class="portal-pane ${this.activeTab === 'child-overview' ? 'active' : ''}" id="parent-pane-overview">
        ${this.renderChildOverview()}
      </div>

      <div class="portal-pane ${this.activeTab === 'report-caretaker' ? 'active' : ''}" id="parent-pane-report">
        ${this.renderReportCaretakerSection()}
      </div>
    `;

    mount.innerHTML = renderPortalShell({
      roleTitle: 'Parent Portal',
      roleIcon: 'fa-people-roof',
      userName: this.user.fullName,
      userSubtitle: `Guardian of ${this.linkedStudent?.fullName || 'Student'}`,
      navItems,
      activeTab: this.activeTab,
      rightActionsHtml: `<span class="badge badge-success" style="font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-link"></i> Linked: ${this.linkedStudent?.rollNumber || ''}</span>`,
      contentHtml
    });
  }

  // Section 34: Student Linking
  renderLinkingForm() {
    return `
      <div class="card" style="max-width: 500px; margin: 40px auto; text-align: center;">
        <div style="font-size: 2.5rem; color: var(--primary); margin-bottom: 12px;">
          <i class="fa-solid fa-link"></i>
        </div>
        <h2 style="margin-bottom: 8px;">Link Your Child's Account</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
          To access hostel records, approve leaves, and view room allotments, please verify your child's official Roll Number.
        </p>

        <div class="form-group" style="text-align: left;">
          <label class="form-label">Student Roll Number</label>
          <input type="text" id="link-student-roll" class="form-input" placeholder="e.g. 23CS001" value="23CS001">
        </div>

        <button class="btn btn-primary" id="btn-submit-link" style="width: 100%;">
          Verify & Link Student
        </button>
      </div>
    `;
  }

  attachLinkingEvents() {
    const btn = document.getElementById('btn-submit-link');
    if (btn) {
      btn.addEventListener('click', async () => {
        const roll = document.getElementById('link-student-roll')?.value.trim();
        if (!roll) {
          this.app.toast('Please enter roll number', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'parent',
              fullName: this.user.fullName,
              email: this.user.email,
              studentRollNumber: roll
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Student linked successfully!', 'success');
          this.user = data.user;
          this.linkedStudent = data.linkedStudent;
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }
  }

  // Section 33 & 36: Child Overview
  renderChildOverview() {
    const s = this.linkedStudent;
    return `
      <div class="grid-3" style="margin-bottom: 24px;">
        <div class="stat-widget">
          <div class="stat-icon primary"><i class="fa-solid fa-user-graduate"></i></div>
          <div class="stat-content">
            <span class="stat-label">Linked Student</span>
            <span class="stat-value" style="font-size: 1.25rem;">${s.fullName}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${s.rollNumber} — Year ${s.academicYear}</span>
          </div>
        </div>

        <div class="stat-widget">
          <div class="stat-icon info"><i class="fa-solid fa-hotel"></i></div>
          <div class="stat-content">
            <span class="stat-label">Current Living Hostel</span>
            <span class="stat-value" style="font-size: 1.2rem;">${s.currentHostel}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Room ${s.currentRoom}</span>
          </div>
        </div>

        <div class="stat-widget">
          <div class="stat-icon warning"><i class="fa-solid fa-layer-group"></i></div>
          <div class="stat-content">
            <span class="stat-label">Cluster Status</span>
            <span class="stat-value" style="font-size: 1.1rem;">${s.clusterId ? s.clusterId : 'Not Clustered'}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Status: ${s.allocationStatus}</span>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-id-card"></i> Student Resident Details</h3>
            <span class="status-pill success">Verified Link</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem;">
            <div><strong>Program:</strong> ${s.course}</div>
            <div><strong>Academic CGPA:</strong> ${s.cgpa?.toFixed(2)} (Verified by University)</div>
            <div><strong>Emergency Contact:</strong> ${s.phone || 'N/A'}</div>
            <div><strong>Home Address:</strong> ${s.address || 'N/A'}</div>
            <div><strong>Current Roommates:</strong> ${s.currentRoommates?.join(', ') || 'None'}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-shield-halved"></i> Campus Safety & Support</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Parents have direct communication with hostel caretakers and full transparency over student leave and campus entry permissions.
          </p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary" id="btn-parent-goto-report" style="justify-content: flex-start;">
              <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i> Submit Caretaker Inquiry
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Section 35: Parent Leave Approval
  renderApprovalsSection() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-clipboard-check"></i> Pending Approvals for ${this.linkedStudent.fullName}</h3>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-parent-approvals">
            <i class="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
          Review home departure and local late-return requests submitted by your child.
        </p>

        <div id="parent-approvals-mount">
          <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>
    `;
  }

  async loadApprovals() {
    const mount = document.getElementById('parent-approvals-mount');
    if (!mount) return;

    try {
      const res = await fetch(`/api/leaves/parent/${this.linkedStudent.rollNumber}`);
      const data = await res.json();
      const leaves = data.homeLeaves || [];
      const entries = data.localEntries || [];

      const pendingLeaves = leaves.filter(l => l.parentApproval === 'PENDING');
      const pendingEntries = entries.filter(e => e.parentApproval === 'PENDING');

      if (pendingLeaves.length === 0 && pendingEntries.length === 0) {
        mount.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-circle-check fa-2x" style="color: var(--success); margin-bottom: 10px; display: block;"></i>All caught up! No pending leave or entry requests.</div>`;
        return;
      }

      let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

      // Home Leaves Pending Approval (Section 35)
      pendingLeaves.forEach(l => {
        html += `
          <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div>
                <span class="status-pill warning" style="margin-bottom: 6px;">Home Leave Request</span>
                <h4 style="margin: 0; font-size: 1.05rem;">Dates: ${l.fromDate} to ${l.toDate}</h4>
              </div>
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-success btn-sm btn-parent-approve-leave" data-id="${l.id}">
                  <i class="fa-solid fa-check"></i> APPROVE
                </button>
                <button class="btn btn-danger btn-sm btn-parent-reject-leave" data-id="${l.id}">
                  <i class="fa-solid fa-xmark"></i> REJECT
                </button>
              </div>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              <strong>Reason:</strong> ${l.reason}
            </div>
          </div>
        `;
      });

      // Local Entry Pending Approval (Section 10 Dual-Approval Flow)
      pendingEntries.forEach(e => {
        html += `
          <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div>
                <span class="status-pill info" style="margin-bottom: 6px;">Local Entry / Late Return</span>
                <h4 style="margin: 0; font-size: 1.05rem;">Date: ${e.date} (${e.startTime} - ${e.endTime})</h4>
              </div>
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-success btn-sm btn-parent-approve-entry" data-id="${e.id}">
                  <i class="fa-solid fa-check"></i> APPROVE
                </button>
                <button class="btn btn-danger btn-sm btn-parent-reject-entry" data-id="${e.id}">
                  <i class="fa-solid fa-xmark"></i> REJECT
                </button>
              </div>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
              <strong>Reason:</strong> ${e.reason}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Caretaker Status: <strong>${e.caretakerApproval}</strong> (Pass will be issued only if both approve)
            </div>
          </div>
        `;
      });

      html += `</div>`;
      mount.innerHTML = html;

      // Attach actions
      mount.querySelectorAll('.btn-parent-approve-leave').forEach(btn => {
        btn.addEventListener('click', () => this.handleLeaveAction(btn.getAttribute('data-id'), 'APPROVE'));
      });
      mount.querySelectorAll('.btn-parent-reject-leave').forEach(btn => {
        btn.addEventListener('click', () => this.handleLeaveAction(btn.getAttribute('data-id'), 'REJECT'));
      });

      mount.querySelectorAll('.btn-parent-approve-entry').forEach(btn => {
        btn.addEventListener('click', () => this.handleEntryAction(btn.getAttribute('data-id'), 'APPROVE'));
      });
      mount.querySelectorAll('.btn-parent-reject-entry').forEach(btn => {
        btn.addEventListener('click', () => this.handleEntryAction(btn.getAttribute('data-id'), 'REJECT'));
      });
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  async handleLeaveAction(requestId, action) {
    try {
      const res = await fetch('/api/leaves/home-leave/parent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          parentName: this.user.fullName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.app.toast(`Leave request ${action.toLowerCase()}d successfully!`, 'success');
      this.loadApprovals();
    } catch (err) {
      this.app.toast(err.message, 'danger');
    }
  }

  async handleEntryAction(requestId, action) {
    try {
      const res = await fetch('/api/leaves/local-entry/parent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          parentName: this.user.fullName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.app.toast(`Local entry ${action.toLowerCase()}d successfully!`, 'success');
      this.loadApprovals();
    } catch (err) {
      this.app.toast(err.message, 'danger');
    }
  }

  // Section 33: View Passes
  renderChildPassesSection() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-id-badge"></i> Active Passes for ${this.linkedStudent.fullName}</h3>
        </div>
        <div id="parent-passes-mount">
          <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>
    `;
  }

  async loadChildPasses() {
    const mount = document.getElementById('parent-passes-mount');
    if (!mount) return;

    try {
      const res = await fetch(`/api/leaves/parent/${this.linkedStudent.rollNumber}`);
      const data = await res.json();
      const passes = data.passes || [];

      if (passes.length === 0) {
        mount.innerHTML = `<div class="empty-state">No passes active for this student.</div>`;
        return;
      }

      mount.innerHTML = `
        <div class="grid-2">
          ${passes.map(p => `
            <div class="digital-pass-card">
              <div class="pass-header">
                <div>
                  <div style="font-size: 0.7rem; color: var(--primary); text-transform: uppercase;">${p.passType}</div>
                  <h3 style="font-size: 1.15rem;">${p.id}</h3>
                </div>
                <span class="pass-badge"><i class="fa-solid fa-check"></i> ${p.status}</span>
              </div>
              <div style="font-size: 0.85rem; margin-bottom: 12px;">
                <div><strong>Valid:</strong> ${p.date} (${p.startTime} - ${p.endTime})</div>
                <div><strong>Purpose:</strong> ${p.purpose}</div>
                <div><strong>Hostel:</strong> ${p.hostel} - Room ${p.roomNumber}</div>
              </div>
              <div class="pass-stamps">
                <span class="approval-stamp">${p.parentApproval}</span>
                <span class="approval-stamp">${p.caretakerApproval}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  // Section 37: Parent Complaint System ("Report to Caretaker")
  renderReportCaretakerSection() {
    return `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-envelope-open-text"></i> Report Concern to Caretaker</h3>
          <span class="status-pill info">Section 37</span>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 18px;">
          Concerns submitted here are automatically routed directly to the caretaker in charge of <strong>${this.linkedStudent.currentHostel}</strong>.
        </p>

        <div class="form-group">
          <label class="form-label">Concern Category</label>
          <select id="parent-concern-cat" class="form-select">
            <option value="Hostel conditions">Hostel conditions (cleanliness, environment)</option>
            <option value="Maintenance">Maintenance & facilities</option>
            <option value="Student safety">Student safety & security</option>
            <option value="Facilities">Dining & recreational facilities</option>
            <option value="Other hostel-related issues">Other hostel-related issues</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Description of Concern</label>
          <textarea id="parent-concern-desc" class="form-textarea" placeholder="Please provide specific details regarding your concern..."></textarea>
        </div>

        <button class="btn btn-primary" id="btn-submit-parent-concern" style="width: 100%;">
          Submit Concern to Hostel Caretaker
        </button>
      </div>
    `;
  }

  attachEvents() {
    attachPortalShellEvents();

    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.activeTab = tab;
        this.render();
        this.attachEvents();

        if (tab === 'leave-approvals') this.loadApprovals();
      });
    });

    const btnGotoApprovals = document.getElementById('btn-parent-goto-approvals');
    if (btnGotoApprovals) {
      btnGotoApprovals.addEventListener('click', () => {
        this.activeTab = 'leave-approvals';
        this.render();
        this.attachEvents();
        this.loadApprovals();
      });
    }

    const btnGotoReport = document.getElementById('btn-parent-goto-report');
    if (btnGotoReport) {
      btnGotoReport.addEventListener('click', () => {
        this.activeTab = 'report-caretaker';
        this.render();
        this.attachEvents();
      });
    }

    const btnRefresh = document.getElementById('btn-refresh-parent-approvals');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadApprovals());
    }

    const btnSubmitConcern = document.getElementById('btn-submit-parent-concern');
    if (btnSubmitConcern) {
      btnSubmitConcern.addEventListener('click', async () => {
        const category = document.getElementById('parent-concern-cat').value;
        const description = document.getElementById('parent-concern-desc').value.trim();

        if (!description) {
          this.app.toast('Please enter your concern description', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/complaints/parent-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parentId: this.user.id,
              studentRollNumber: this.linkedStudent.rollNumber,
              category,
              description
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Concern reported to caretaker successfully!', 'success');
          document.getElementById('parent-concern-desc').value = '';
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }
  }
}
