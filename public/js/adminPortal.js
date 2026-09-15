// public/js/adminPortal.js
import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';
export class AdminPortal {
  constructor(app, user) {
    this.app = app;
    this.user = user;
    this.activeTab = 'rules';
    this.users = [];
    this.hostels = [];
    this.roomPairs = [];
    this.rules = [];
    this.semesters = [];
    this.config = {};
  }

  async init() {
    await this.fetchAllData();
    this.render();
    this.attachEvents();
  }

  async fetchAllData() {
    try {
      const [uRes, hRes, rpRes, rRes, sRes, cRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/hostels'),
        fetch('/api/admin/room-pairs'),
        fetch('/api/admin/eligibility-rules'),
        fetch('/api/admin/semesters'),
        fetch('/api/admin/config')
      ]);

      const uData = await uRes.json();
      const hData = await hRes.json();
      const rpData = await rpRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      const cData = await cRes.json();

      this.users = uData.users || [];
      this.hostels = hData.hostels || [];
      this.roomPairs = rpData.roomPairs || [];
      this.rules = rData.rules || [];
      this.semesters = sData.semesters || [];
      this.config = cData.config || {};
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  }

  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    const navItems = [
      { id: 'rules', icon: 'fa-scale-balanced', label: 'Eligibility Rules' },
      { id: 'config', icon: 'fa-sliders', label: 'Allocation Config' },
      { id: 'semesters', icon: 'fa-calendar-days', label: 'Semester Management' },
      { id: 'hostels', icon: 'fa-building', label: 'Hostels & Room Suites' },
      { id: 'users', icon: 'fa-users-gear', label: 'User Directory & CGPA' }
    ];

    const contentHtml = `
      <!-- Panes -->
      <div class="portal-pane ${this.activeTab === 'rules' ? 'active' : ''}" id="adm-pane-rules">
        ${this.renderRulesSection()}
      </div>

      <div class="portal-pane ${this.activeTab === 'config' ? 'active' : ''}" id="adm-pane-config">
        ${this.renderConfigSection()}
      </div>

      <div class="portal-pane ${this.activeTab === 'semesters' ? 'active' : ''}" id="adm-pane-semesters">
        ${this.renderSemestersSection()}
      </div>

      <div class="portal-pane ${this.activeTab === 'hostels' ? 'active' : ''}" id="adm-pane-hostels">
        ${this.renderHostelsSection()}
      </div>

      <div class="portal-pane ${this.activeTab === 'users' ? 'active' : ''}" id="adm-pane-users">
        ${this.renderUsersSection()}
      </div>
    `;

    mount.innerHTML = renderPortalShell({
      roleTitle: 'Admin Board Portal',
      roleIcon: 'fa-user-shield',
      userName: this.user.fullName,
      userSubtitle: this.user.department || 'Hostel Management Board',
      navItems,
      activeTab: this.activeTab,
      rightActionsHtml: `<span class="badge badge-warning" style="font-size:0.75rem; font-weight:700;"><i class="fa-solid fa-lock"></i> Central Admin</span>`,
      contentHtml
    });
  }

  // Section 23, 46, 49: Dynamic Eligibility Rules (Stored as Data, Not Hard-coded)
  renderRulesSection() {
    return `
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-plus-circle"></i> Create Dynamic Eligibility Rule</h3>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
            Section 23 & 49 Invariant: University rules are stored in the database as configuration, not hard-coded into Java/code logic.
          </p>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Academic Year</label>
              <select id="rule-year" class="form-select">
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="2">2nd Year</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select id="rule-gender" class="form-select">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Min CGPA</label>
              <input type="number" step="0.01" id="rule-min-cgpa" class="form-input" value="8.50">
            </div>
            <div class="form-group">
              <label class="form-label">Max CGPA</label>
              <input type="number" step="0.01" id="rule-max-cgpa" class="form-input" value="10.00">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Eligible Hostels (Hold Ctrl to select multiple)</label>
            <select id="rule-hostels" class="form-select" multiple style="height: 100px;">
              ${this.hostels.map(h => `<option value="${h.name}">${h.name} (${h.gender})</option>`).join('')}
            </select>
          </div>

          <button class="btn btn-primary" id="btn-create-rule" style="width: 100%;">
            Add Dynamic Rule
          </button>
        </div>

        <!-- Current Rules Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-list-ol"></i> Active Rules</h3>
            <span class="status-pill success">${this.rules.length} Rules Active</span>
          </div>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>CGPA Range</th>
                  <th>Eligible Hostels</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${this.rules.map(r => `
                  <tr>
                    <td><strong>Year ${r.academicYear} ${r.gender}</strong></td>
                    <td>${r.minCgpa.toFixed(2)} - ${r.maxCgpa.toFixed(2)}</td>
                    <td>
                      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${r.eligibleHostels.map(h => `<span class="status-pill info" style="font-size: 0.65rem;">${h}</span>`).join('')}
                      </div>
                    </td>
                    <td>
                      <button class="btn btn-danger btn-sm btn-delete-rule" data-id="${r.id}" style="padding: 2px 6px;">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Section 48: Allocation Configuration
  renderConfigSection() {
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-sliders"></i> University Allocation Engine Configuration</h3>
          <span class="status-pill info">Section 48</span>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Students per Cluster (Default: 4)</label>
            <input type="number" id="cfg-students-cluster" class="form-input" value="${this.config.studentsPerCluster || 4}">
          </div>
          <div class="form-group">
            <label class="form-label">Room Preferences Required (Default: 3)</label>
            <input type="number" id="cfg-prefs-required" class="form-input" value="${this.config.preferencesRequired || 3}">
          </div>
          <div class="form-group">
            <label class="form-label">CGPA Conflict Tie-Breaking Method (Section 29)</label>
            <select id="cfg-tie-breaker" class="form-select">
              <option value="lottery" ${this.config.tieBreakingMethod === 'lottery' ? 'selected' : ''}>Randomized Lottery</option>
              <option value="random_number" ${this.config.tieBreakingMethod === 'random_number' ? 'selected' : ''}>System-Generated Random Number</option>
              <option value="previous_priority" ${this.config.tieBreakingMethod === 'previous_priority' ? 'selected' : ''}>Previous Allocation Priority</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Auto-Assign First-Year Students (Section 13)</label>
            <select id="cfg-auto-first-years" class="form-select">
              <option value="true" ${this.config.autoAssignFirstYears ? 'selected' : ''}>Enabled (Assigned by College)</option>
              <option value="false" ${!this.config.autoAssignFirstYears ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Room Suite Architecture Model</label>
          <input type="text" class="form-input" value="1 Cluster = 4 Students = 2 Rooms = 1 Shared Washroom" disabled>
        </div>

        <button class="btn btn-primary" id="btn-save-config">Save Allocation Parameters</button>
      </div>
    `;
  }

  // Section 47: Semester Management
  renderSemestersSection() {
    const sem = this.semesters[0] || {};
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-calendar-check"></i> Academic Semester Timeline & Deadlines</h3>
          <span class="status-pill success">${sem.status}</span>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Academic Term Name</label>
            <input type="text" id="sem-name" class="form-input" value="${sem.name || '2026–27 Semester 1'}">
          </div>
          <div class="form-group">
            <label class="form-label">Active Allocation Phase (1-8)</label>
            <select id="sem-phase" class="form-select">
              <option value="1" ${sem.activePhase === 1 ? 'selected' : ''}>Phase 1 — Pre-Allocation</option>
              <option value="2" ${sem.activePhase === 2 ? 'selected' : ''}>Phase 2 — Cluster Formation</option>
              <option value="3" ${sem.activePhase === 3 ? 'selected' : ''}>Phase 3 — Cluster Eligibility</option>
              <option value="4" ${sem.activePhase === 4 ? 'selected' : ''}>Phase 4 — Actual Room Allocation</option>
              <option value="5" ${sem.activePhase === 5 ? 'selected' : ''}>Phase 5 — Conflict Resolution</option>
              <option value="6" ${sem.activePhase === 6 ? 'selected' : ''}>Phase 6 — Final Allocation</option>
              <option value="7" ${sem.activePhase === 7 ? 'selected' : ''}>Phase 7 — Fee Payment</option>
              <option value="8" ${sem.activePhase === 8 ? 'selected' : ''}>Phase 8 — Final Confirmation</option>
            </select>
          </div>
        </div>

        <div class="grid-3">
          <div class="form-group">
            <label class="form-label">Pre-Allocation Deadline</label>
            <input type="date" id="sem-pre-deadline" class="form-input" value="${sem.preAllocationDeadline?.split('T')[0] || '2026-09-20'}">
          </div>
          <div class="form-group">
            <label class="form-label">Room-Selection Deadline</label>
            <input type="date" id="sem-sel-deadline" class="form-input" value="${sem.roomSelectionDeadline?.split('T')[0] || '2026-09-25'}">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Deadline</label>
            <input type="date" id="sem-pay-deadline" class="form-input" value="${sem.paymentDeadline?.split('T')[0] || '2026-09-30'}">
          </div>
        </div>

        <button class="btn btn-primary" id="btn-save-semester">Update Semester Settings</button>
      </div>
    `;
  }

  // Section 45: Hostels & Rooms
  renderHostelsSection() {
    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-hotel"></i> Campus Hostels</h3>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Hostel Name</th>
                  <th>Gender</th>
                  <th>Eligible Years</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                ${this.hostels.map(h => `
                  <tr>
                    <td><strong>${h.name}</strong></td>
                    <td>${h.gender}</td>
                    <td>Years ${h.eligibleYears?.join(', ')}</td>
                    <td>${h.capacity} beds</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fa-solid fa-door-open"></i> Configured Room Pairs</h3>
            <span class="status-pill info">${this.roomPairs.length} Suites</span>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Pair Number</th>
                  <th>Hostel</th>
                  <th>Washroom</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.roomPairs.map(rp => `
                  <tr>
                    <td><strong>${rp.pairNumber}</strong></td>
                    <td>${rp.hostelName} (Fl ${rp.floor})</td>
                    <td style="font-size: 0.75rem;">${rp.sharedWashroom}</td>
                    <td><span class="status-pill ${rp.status === 'AVAILABLE' ? 'success' : 'danger'}">${rp.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Section 45 & 5: User Management & CGPA Maintenance
  renderUsersSection() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fa-solid fa-users"></i> User Directory & Academic Verification</h3>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
          Section 5 Invariant: "The student's academic information, such as CGPA, should ideally be maintained/verified by the Admin rather than allowing students to modify it themselves."
        </p>

        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Full Name</th>
                <th>Roll / Email</th>
                <th>CGPA (Verified)</th>
                <th>Hostel / Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.users.map(u => `
                <tr>
                  <td><span class="status-pill primary">${u.role}</span></td>
                  <td><strong>${u.fullName}</strong></td>
                  <td style="font-size: 0.8rem;">${u.rollNumber || u.email}</td>
                  <td>
                    ${u.role === 'student' ? `
                      <div style="display: flex; gap: 6px; align-items: center;">
                        <input type="number" step="0.01" class="form-input adm-user-cgpa" data-uid="${u.id}" value="${u.cgpa?.toFixed(2) || '0.00'}" style="width: 75px; padding: 4px 6px; font-size: 0.8rem;">
                        <button class="btn btn-secondary btn-sm btn-save-user-cgpa" data-uid="${u.id}" style="padding: 4px 6px;">Save</button>
                      </div>
                    ` : '—'}
                  </td>
                  <td style="font-size: 0.8rem;">${u.currentHostel || u.hostelName || 'General'}</td>
                  <td>
                    <span class="status-pill ${u.verified ? 'success' : 'warning'}">${u.verified ? 'Verified' : 'Unverified'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
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
      });
    });

    // Add Dynamic Rule
    const btnCreateRule = document.getElementById('btn-create-rule');
    if (btnCreateRule) {
      btnCreateRule.addEventListener('click', async () => {
        const academicYear = document.getElementById('rule-year').value;
        const gender = document.getElementById('rule-gender').value;
        const minCgpa = document.getElementById('rule-min-cgpa').value;
        const maxCgpa = document.getElementById('rule-max-cgpa').value;
        const selectedHostels = Array.from(document.getElementById('rule-hostels').selectedOptions).map(o => o.value);

        if (selectedHostels.length === 0) {
          this.app.toast('Please select at least one eligible hostel', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/admin/eligibility-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              academicYear,
              gender,
              minCgpa,
              maxCgpa,
              eligibleHostels: selectedHostels
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Dynamic eligibility rule created!', 'success');
          await this.fetchAllData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Delete Rule
    document.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await fetch(`/api/admin/eligibility-rules/${id}`, { method: 'DELETE' });
          this.app.toast('Rule removed', 'success');
          await this.fetchAllData();
          this.render();
          this.attachEvents();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });

    // Save Config
    const btnSaveConfig = document.getElementById('btn-save-config');
    if (btnSaveConfig) {
      btnSaveConfig.addEventListener('click', async () => {
        const studentsPerCluster = Number(document.getElementById('cfg-students-cluster').value);
        const preferencesRequired = Number(document.getElementById('cfg-prefs-required').value);
        const tieBreakingMethod = document.getElementById('cfg-tie-breaker').value;
        const autoAssignFirstYears = document.getElementById('cfg-auto-first-years').value === 'true';

        try {
          const res = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentsPerCluster,
              preferencesRequired,
              tieBreakingMethod,
              autoAssignFirstYears
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('Allocation parameters updated!', 'success');
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Save Semester & Phase
    const btnSaveSem = document.getElementById('btn-save-semester');
    if (btnSaveSem) {
      btnSaveSem.addEventListener('click', async () => {
        const sem = this.semesters[0];
        const phase = Number(document.getElementById('sem-phase').value);
        const name = document.getElementById('sem-name').value;

        try {
          const res = await fetch('/api/admin/semesters/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: sem.id,
              updates: {
                name,
                activePhase: phase
              }
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast(`Semester updated to Phase ${phase}!`, 'success');
          this.app.refreshHeaderBadge();
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    }

    // Save User CGPA
    document.querySelectorAll('.btn-save-user-cgpa').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-uid');
        const cgpaInput = document.querySelector(`.adm-user-cgpa[data-uid="${uid}"]`);
        const cgpa = Number(cgpaInput?.value);

        try {
          const res = await fetch('/api/admin/users/update-cgpa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, cgpa })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          this.app.toast('CGPA verified and updated in database!', 'success');
        } catch (err) {
          this.app.toast(err.message, 'danger');
        }
      });
    });
  }
}
