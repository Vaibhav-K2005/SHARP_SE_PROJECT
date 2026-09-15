// public/js/caretakerPortal.js
import { HostelMap } from './hostelMap.js';
import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';

export class CaretakerPortal {
  constructor(app, user) {
    this.app = app;
    this.user = user;
    this.activeTab = 'dashboard';
    this.stats = null;
    this.allocationData = null;
    this.hostelMap = null;
  }

  async init() {
    await this.fetchData();
    this.render();
    this.attachEvents();
    if (this.activeTab === 'hostel-map') this.initHostelMap();
    if (this.activeTab === 'complaints') this.loadComplaints();
    if (this.activeTab === 'local-entry') this.loadLocalEntries();
  }

  async fetchData() {
    try {
      const res = await fetch('/api/allocation/status');
      this.allocationData = await res.json();
    } catch (err) {
      console.error('Failed to fetch allocation status:', err);
    }
  }

  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    const hostelName = this.user.hostelName || 'Hostel M';

    const navItems = [
      { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
      { id: 'allocation-center', icon: 'fa-arrows-split-up-and-left', label: 'Room Allocation Engine' },
      { id: 'hostel-map', icon: 'fa-hotel', label: 'Hostel Floor Plan Map' }
    ];

    if (!navItems.some(item => item.id === this.activeTab)) {
      this.activeTab = 'dashboard';
    }

    const contentHtml = `
      <!-- Content Panes -->
      <div class="portal-pane ${this.activeTab === 'dashboard' ? 'active' : ''}" id="ct-pane-dashboard">
        ${this.renderDashboard(hostelName)}
      </div>

      <div class="portal-pane ${this.activeTab === 'allocation-center' ? 'active' : ''}" id="ct-pane-allocation">
        ${this.renderAllocationCenter()}
      </div>

      <div class="portal-pane ${this.activeTab === 'hostel-map' ? 'active' : ''}" id="ct-pane-map">
        ${this.renderHostelMapSection(hostelName)}
      </div>
    `;

    mount.innerHTML = renderPortalShell({
      roleTitle: 'Caretaker Portal',
      roleIcon: 'fa-building-user',
      userName: this.user.fullName,
      userSubtitle: hostelName,
      navItems,
      activeTab: this.activeTab,
      rightActionsHtml: `<span class="badge badge-warning" style="font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-hotel"></i> ${hostelName}</span>`,
      contentHtml
    });

    if (this.activeTab === 'hostel-map') {
      this.initHostelMap();
    }
  }

  // Section 39: Caretaker Dashboard
  renderDashboard(hostelName) {
    const stats = this.allocationData?.stats || {};
    const sem = this.allocationData?.semester || {};

    return `
      <div class="demo-page-heading">
        <div>
          <h2>Caretaker Demo Console</h2>
          <p>Assigned facility: <strong>${hostelName}</strong>. This demo keeps only the daily operational flows visible.</p>
        </div>
        <span class="status-pill primary"><i class="fa-solid fa-building-user"></i> ${this.user.fullName}</span>
      </div>

      <div class="grid-3" style="margin-bottom: 28px;">
        <div class="stat-widget">
          <div class="stat-icon info"><i class="fa-solid fa-hotel"></i></div>
          <div class="stat-content">
            <span class="stat-label">Hostel</span>
            <span class="stat-value" style="font-size: 1.2rem;">${hostelName}</span>
          </div>
        </div>
        <div class="stat-widget">
          <div class="stat-icon warning"><i class="fa-solid fa-clipboard-check"></i></div>
          <div class="stat-content">
            <span class="stat-label">Entry Flow</span>
            <span class="stat-value" style="font-size: 1rem;">Approvals</span>
          </div>
        </div>
        <div class="stat-widget">
          <div class="stat-icon danger"><i class="fa-solid fa-screwdriver-wrench"></i></div>
          <div class="stat-content">
            <span class="stat-label">Maintenance</span>
            <span class="stat-value" style="font-size: 1rem;">Complaints</span>
          </div>
        </div>
      </div>

      <div class="card demo-focus-card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-list-check"></i> Daily Actions</h3>
            <p class="card-subtitle">Use the room allocation engine and floor-map tools for this demo. Complaints and entry approvals are hidden.</p>
          </div>
        </div>
        <div class="demo-action-grid two-up">
          <button class="btn btn-secondary btn-large-action" id="btn-ct-dashboard-allocation">
            <i class="fa-solid fa-arrows-split-up-and-left" style="color: var(--primary);"></i>
            <span>Open Allocation Engine</span>
          </button>
          <button class="btn btn-secondary btn-large-action" id="btn-ct-dashboard-map">
            <i class="fa-solid fa-hotel" style="color: var(--info);"></i>
            <span>Open Floor Plan Map</span>
          </button>
        </div>
      </div>
    `;
  }

  // Section 41: Room Allocation Controls & Cluster Inspector
  renderAllocationCenter() {
    const clusters = this.allocationData?.clusters || [];
    const studentPreferences = this.allocationData?.studentPreferences || [];
    const sem = this.allocationData?.semester || {};

    return `
      <!-- Phase Status Ribbon -->
      <div class="card" style="margin-bottom: 24px; border-left: 4px solid ${sem.allotmentStatus === 'ACTIVE' ? 'var(--success)' : (sem.allotmentStatus === 'ENDED' ? 'var(--danger)' : 'var(--warning)')};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="margin: 0 0 4px 0;"><i class="fa-solid fa-sliders"></i> Allotment Phase Controls</h4>
            <span style="font-size: 0.82rem; color: var(--text-secondary);">
              Current Status: <strong>${sem.allotmentStatus || 'NOT_STARTED'}</strong> (Phase ${sem.activePhase || 1})
            </span>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${sem.allotmentStatus !== 'ACTIVE' ? `
              <button class="btn btn-success btn-sm btn-ct-start-allotment">
                <i class="fa-solid fa-play"></i> Start Allotment Phase
              </button>
            ` : `
              <button class="btn btn-danger btn-sm btn-ct-end-allotment">
                <i class="fa-solid fa-stop"></i> End Allotment Phase
              </button>
              <button class="btn btn-primary btn-sm" id="btn-ct-form-clusters-2">
                <i class="fa-solid fa-users"></i> Form Clusters
              </button>
              <button class="btn btn-info btn-sm" id="btn-ct-run-engine-2">
                <i class="fa-solid fa-gears"></i> Run Conflict Engine
              </button>
            `}
            <button class="btn btn-secondary btn-sm btn-ct-reset-allotment" title="Reset allotment state to Not Started">
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>
        </div>
      </div>

      <!-- Candidate Clusters Table -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-sitemap"></i> Candidate Clusters & Room Allocations (${clusters.length})</h3>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="btn-refresh-clusters" title="Refresh Clusters">
              <i class="fa-solid fa-rotate"></i> Refresh
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Cluster #</th>
                <th>Members (Rolls)</th>
                <th>Avg CGPA</th>
                <th>Eligible Hostels</th>
                <th>Submitted Preferences</th>
                <th>Allotted Room Pair</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${clusters.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-users-slash" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>
                    No clusters formed yet. Start the allotment phase and students can form 4-student clusters.
                  </td>
                </tr>
              ` : clusters.map(c => `
                <tr>
                  <td><strong>Cluster #${c.clusterNumber}</strong></td>
                  <td style="font-size: 0.78rem;">${c.memberRolls?.join(', ')}</td>
                  <td><strong style="color: var(--primary);">${c.averageCgpa?.toFixed(3)}</strong></td>
                  <td style="font-size: 0.75rem;">${c.eligibleHostels?.join(', ')}</td>
                  <td style="font-size: 0.75rem;">
                    ${c.preferences?.length ? c.preferences.map(p => `P${p.rank}:${p.roomPairNumber}`).join(' | ') : '<em style="color: var(--text-muted)">None</em>'}
                  </td>
                  <td>
                    ${c.assignedRoomPairNumber ?
        `<span class="status-pill success">${c.assignedRoomPairNumber}</span>` :
        (c.status === 'UNALLOCATED' ? `<span class="status-pill danger">Unallocated</span>` : '<span style="color: var(--text-muted)">Pending</span>')}
                  </td>
                  <td>
                    <span class="status-pill ${c.status === 'CONFIRMED' ? 'success' : (c.status === 'ALLOCATED' ? 'info' : (c.status === 'UNALLOCATED' ? 'danger' : 'warning'))}">
                      ${c.status}
                    </span>
                  </td>
                  <td>
                    ${c.status === 'UNALLOCATED' ? `
                      <button class="btn btn-warning btn-sm btn-ct-manual-assign" data-cid="${c.id}" style="padding: 4px 8px; font-size: 0.72rem;">
                        <i class="fa-solid fa-handshake"></i> Manual Assign
                      </button>
                    ` : `
                      <button class="btn btn-secondary btn-sm btn-ct-reassign-leader" data-cid="${c.id}" style="padding: 4px 8px; font-size: 0.72rem;">
                        <i class="fa-solid fa-crown"></i> Leader
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Student Pre-Allocation Preferences & Grouping Requests Table -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fa-solid fa-clipboard-list"></i> Student Preferences & Grouping Requests (${studentPreferences.length})
          </h3>
        </div>

        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Student Roll</th>
                <th>Preference Method</th>
                <th>Target Partner / Cluster Members</th>
                <th>Submitted Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${studentPreferences.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-file-circle-question" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>
                    No student preferences submitted yet.
                  </td>
                </tr>
              ` : studentPreferences.map(p => `
                <tr>
                  <td><strong>${p.rollNumber}</strong></td>
                  <td>
                    <span class="status-pill ${p.preferenceOption === 'OPTION_C' ? 'primary' : (p.preferenceOption === 'OPTION_B' ? 'info' : 'secondary')}">
                      ${p.preferenceOption === 'OPTION_C' ? 'Option C (4 Students)' : (p.preferenceOption === 'OPTION_B' ? 'Option B (Mutual Roommate)' : 'Option A (Random)')}
                    </span>
                  </td>
                  <td style="font-size: 0.8rem;">
                    ${p.preferenceOption === 'OPTION_C' ?
            (p.clusterRollNumbers?.join(', ') || 'N/A') :
            (p.preferenceOption === 'OPTION_B' ? `Partner: <strong>${p.partnerRollNumber || 'N/A'}</strong>` : '<em style="color: var(--text-muted)">Auto-Grouped</em>')}
                  </td>
                  <td style="font-size: 0.78rem; color: var(--text-secondary);">
                    ${p.submittedAt ? new Date(p.submittedAt).toLocaleString() : 'N/A'}
                  </td>
                  <td>
                    <span class="status-pill ${p.status === 'CLUSTERED' ? 'success' : 'warning'}">
                      ${p.status === 'CLUSTERED' ? `Clustered (${p.clusterId || 'Active'})` : 'Pending Match'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Section 40: Hostel Management & Visual Map
  renderHostelMapSection(hostelName) {
    const hostels = this.allocationData?.hostels || [];

    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-map"></i>Hostel Floor Map</h3>
          <div style="display: flex; gap: 10px; align-items: center;">
            <label class="form-label" style="margin: 0;">Switch Hostel:</label>
            <select id="ct-map-hostel-select" class="form-select" style="width: auto;">
              ${hostels.map(h => `<option value="${h.name}" ${h.name === hostelName ? 'selected' : ''}>${h.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
          Interactive view of rooms and 4-student paired suites with shared washrooms.
        </p>

        <div id="ct-hostel-map-mount"></div>
      </div>
    `;
  }

  initHostelMap() {
    const mount = document.getElementById('ct-hostel-map-mount');
    const select = document.getElementById('ct-map-hostel-select');
    if (!mount || !select) return;

    this.hostelMap = new HostelMap(mount, {
      interactive: false // Caretakers inspect live occupancy
    });

    this.hostelMap.loadHostel(select.value);

    select.addEventListener('change', () => {
      this.hostelMap.loadHostel(select.value);
    });
  }

  // Section 42: Caretaker Complaint Management
  renderComplaintsSection(hostelName) {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-wrench"></i> Complaints Queue for ${hostelName}</h3>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-ct-complaints">
            <i class="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>

        <div id="ct-complaints-mount">
          <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>
    `;
  }

  async loadComplaints() {
    const mount = document.getElementById('ct-complaints-mount');
    if (!mount) return;

    try {
      const hostelName = this.user.hostelName || 'Hostel O';
      const res = await fetch(`/api/complaints/hostel/${encodeURIComponent(hostelName)}`);
      const data = await res.json();
      const complaints = data.complaints || [];

      if (complaints.length === 0) {
        mount.innerHTML = `<div class="empty-state">No complaints registered for ${hostelName}.</div>`;
        return;
      }

      mount.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${complaints.map(c => `
            <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                  <span class="status-pill ${c.type === 'PARENT_CONCERN' ? 'warning' : 'primary'}">${c.type}</span>
                  <h4 style="margin: 4px 0 2px; font-size: 1.05rem;">${c.category} (Room ${c.roomNumber || 'General'})</h4>
                  <div style="font-size: 0.78rem; color: var(--text-secondary);">
                    Reported by: <strong>${c.studentName || c.parentName}</strong> | ${new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <select class="form-select ct-comp-status-select" data-id="${c.id}" style="font-size: 0.78rem; padding: 4px 8px; width: auto;">
                    <option value="SUBMITTED" ${c.status === 'SUBMITTED' ? 'selected' : ''}>Submitted</option>
                    <option value="UNDER_REVIEW" ${c.status === 'UNDER_REVIEW' ? 'selected' : ''}>Under Review</option>
                    <option value="IN_PROGRESS" ${c.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                    <option value="RESOLVED" ${c.status === 'RESOLVED' ? 'selected' : ''}>Resolved</option>
                  </select>
                </div>
              </div>

              <p style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 10px;">${c.description}</p>

              <div style="display: flex; gap: 8px;">
                <input type="text" class="form-input ct-comp-notes" data-id="${c.id}" placeholder="Add caretaker action note..." value="${c.caretakerNotes || ''}" style="font-size: 0.8rem;">
                <button class="btn btn-secondary btn-sm btn-save-comp-note" data-id="${c.id}">Save</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      mount.querySelectorAll('.ct-comp-status-select').forEach(sel => {
        sel.addEventListener('change', () => this.updateComplaint(sel.getAttribute('data-id'), sel.value));
      });

      mount.querySelectorAll('.btn-save-comp-note').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const input = mount.querySelector(`.ct-comp-notes[data-id="${id}"]`);
          const sel = mount.querySelector(`.ct-comp-status-select[data-id="${id}"]`);
          this.updateComplaint(id, sel.value, input?.value);
        });
      });
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  async updateComplaint(complaintId, status, notes) {
    try {
      const res = await fetch('/api/complaints/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId,
          status,
          caretakerNotes: notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.app.toast('Complaint status updated!', 'success');
      this.loadComplaints();
    } catch (err) {
      this.app.toast(err.message, 'danger');
    }
  }

  // Section 43: Caretaker Local Entry Approval (Dual-Approval Pass Generation)
  renderLocalEntrySection(hostelName) {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-clock"></i> Local Entry Approval Queue</h3>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-ct-entry">
            <i class="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
          Section 10 Dual-Approval Workflow: Pass is generated only after both Parent and Caretaker approvals.
        </p>

        <div id="ct-local-entry-mount">
          <div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
      </div>
    `;
  }

  async loadLocalEntries() {
    const mount = document.getElementById('ct-local-entry-mount');
    if (!mount) return;

    try {
      const hostelName = this.user.hostelName || 'Hostel O';
      const res = await fetch(`/api/leaves/caretaker/${encodeURIComponent(hostelName)}`);
      const data = await res.json();
      const entries = data.localEntries || [];

      if (entries.length === 0) {
        mount.innerHTML = `<div class="empty-state">No local entry requests submitted for this hostel.</div>`;
        return;
      }

      mount.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${entries.map(e => `
            <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                  <h4 style="margin: 0; font-size: 1.05rem;">${e.studentName} (${e.studentRollNumber}) — Room ${e.roomNumber}</h4>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                    Date: <strong>${e.date}</strong> | Requested Return: <strong>${e.endTime}</strong>
                  </div>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-success btn-sm btn-ct-approve-entry" data-id="${e.id}">
                    <i class="fa-solid fa-check"></i> APPROVE
                  </button>
                  <button class="btn btn-danger btn-sm btn-ct-reject-entry" data-id="${e.id}">
                    <i class="fa-solid fa-xmark"></i> REJECT
                  </button>
                </div>
              </div>

              <div style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 8px;">
                <strong>Reason:</strong> ${e.reason}
              </div>

              <div style="display: flex; gap: 14px; font-size: 0.75rem; background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: var(--radius-sm);">
                <span>Parent Approval Status: <strong style="color: ${e.parentApproval === 'APPROVED' ? 'var(--success)' : 'var(--warning)'}">${e.parentApproval}</strong></span>
                <span>Caretaker Status: <strong style="color: ${e.caretakerApproval === 'APPROVED' ? 'var(--success)' : 'var(--warning)'}">${e.caretakerApproval}</strong></span>
                <span>Pass Issued: <strong>${e.passId ? e.passId : 'No (Pending Approvals)'}</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      mount.querySelectorAll('.btn-ct-approve-entry').forEach(btn => {
        btn.addEventListener('click', () => this.handleLocalEntryAction(btn.getAttribute('data-id'), 'APPROVE'));
      });
      mount.querySelectorAll('.btn-ct-reject-entry').forEach(btn => {
        btn.addEventListener('click', () => this.handleLocalEntryAction(btn.getAttribute('data-id'), 'REJECT'));
      });
    } catch (err) {
      mount.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  }

  async handleLocalEntryAction(requestId, action) {
    try {
      const res = await fetch('/api/leaves/local-entry/caretaker-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          caretakerName: this.user.fullName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.app.toast(`Local entry ${action.toLowerCase()}d!`, 'success');
      this.loadLocalEntries();
    } catch (err) {
      this.app.toast(err.message, 'danger');
    }
  }

  // Section 30: Manual Room Assignment for UNALLOCATED cluster
  openManualAssignModal(clusterId) {
    const roomPairs = this.allocationData?.roomPairs || [];
    const available = roomPairs.filter(rp => rp.status === 'AVAILABLE');

    const modalBody = `
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">
        Section 30 Fallback: This cluster had all preferences taken. Caretakers manually place the cluster into an available room pair to prevent system failure.
      </p>

      <div class="form-group">
        <label class="form-label">Available Room Pairs</label>
        <select id="modal-select-manual-rp" class="form-select">
          ${available.map(rp => `
            <option value="${rp.id}">${rp.pairNumber} (${rp.hostelName}) — Floor ${rp.floor}</option>
          `).join('')}
        </select>
      </div>
    `;

    this.app.openModal('Manual Room Pair Assignment', modalBody, [
      {
        label: 'Assign Room Pair',
        class: 'btn-primary',
        onClick: async () => {
          const roomPairId = document.getElementById('modal-select-manual-rp')?.value;
          try {
            const res = await fetch('/api/allocation/manual-assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clusterId, roomPairId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.app.closeModal();
            this.app.toast('Room pair manually assigned to cluster!', 'success');
            await this.fetchData();
            this.render();
            this.attachEvents();
          } catch (err) {
            this.app.toast(err.message, 'danger');
          }
        }
      }
    ]);
  }

  attachEvents() {
    attachPortalShellEvents();

    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.activeTab = tab;
        this.render();
        this.attachEvents();

        if (tab === 'hostel-map') this.initHostelMap();
        if (tab === 'complaints') this.loadComplaints();
        if (tab === 'local-entry') this.loadLocalEntries();
      });
    });

    const btnDashboardAllocation = document.getElementById('btn-ct-dashboard-allocation');
    if (btnDashboardAllocation) {
      btnDashboardAllocation.addEventListener('click', () => {
        this.activeTab = 'allocation-center';
        this.render();
        this.attachEvents();
      });
    }

    const btnDashboardMap = document.getElementById('btn-ct-dashboard-map');
    if (btnDashboardMap) {
      btnDashboardMap.addEventListener('click', () => {
        this.activeTab = 'hostel-map';
        this.render();
        this.attachEvents();
        this.initHostelMap();
      });
    }

    // Start Allotment Phase
    document.querySelectorAll('.btn-ct-start-allotment').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/allocation/start-phase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phase: 1 })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast(data.message || 'Room allotment phase started! Students can now form clusters.', 'success');
          await this.fetchData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    // End Allotment Phase
    document.querySelectorAll('.btn-ct-end-allotment').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to end the room allotment phase? Students will no longer be able to submit preferences or form clusters.')) {
          return;
        }
        try {
          const res = await fetch('/api/allocation/end-phase', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast(data.message || 'Room allotment phase ended.', 'warning');
          await this.fetchData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    // Reset Allotment Phase
    document.querySelectorAll('.btn-ct-reset-allotment').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Reset allotment state to Not Started?')) return;
        try {
          const res = await fetch('/api/allocation/reset-phase', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Allotment phase reset to Not Started.', 'info');
          await this.fetchData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    // Refresh Clusters button
    const btnRefreshClusters = document.getElementById('btn-refresh-clusters');
    if (btnRefreshClusters) {
      btnRefreshClusters.addEventListener('click', async () => {
        await this.fetchData();
        this.render();
        this.attachEvents();
        this.app.toast('Candidate clusters refreshed', 'info');
      });
    }

    const btnFormClusters = document.getElementById('btn-ct-form-clusters');
    const btnFormClusters2 = document.getElementById('btn-ct-form-clusters-2');
    const triggerForm = async () => {
      try {
        const res = await fetch('/api/allocation/form-clusters', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        this.app.toast(`Phase 2 complete! Formed ${data.formedClustersCount} clusters of 4.`, 'success');
        await this.fetchData();
        this.render();
        this.attachEvents();
      } catch (err) {
        this.app.toast(err.message, 'danger');
      }
    };
    if (btnFormClusters) btnFormClusters.addEventListener('click', triggerForm);
    if (btnFormClusters2) btnFormClusters2.addEventListener('click', triggerForm);

    const btnRunEngine = document.getElementById('btn-ct-run-engine');
    const btnRunEngine2 = document.getElementById('btn-ct-run-engine-2');
    const triggerEngine = async () => {
      try {
        const res = await fetch('/api/allocation/run-engine', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        this.app.toast(`Conflict engine ran: ${data.allocatedCount} allocated, ${data.unallocatedCount} unallocated.`, 'success');
        await this.fetchData();
        this.render();
        this.attachEvents();
      } catch (err) {
        this.app.toast(err.message, 'danger');
      }
    };
    if (btnRunEngine) btnRunEngine.addEventListener('click', triggerEngine);
    if (btnRunEngine2) btnRunEngine2.addEventListener('click', triggerEngine);

    document.querySelectorAll('.btn-ct-manual-assign').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openManualAssignModal(btn.getAttribute('data-cid'));
      });
    });

    const btnRefreshComp = document.getElementById('btn-refresh-ct-complaints');
    if (btnRefreshComp) btnRefreshComp.addEventListener('click', () => this.loadComplaints());

    const btnRefreshEntry = document.getElementById('btn-refresh-ct-entry');
    if (btnRefreshEntry) btnRefreshEntry.addEventListener('click', () => this.loadLocalEntries());
  }
}
