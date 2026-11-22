import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';

export class LaundryPortal {
  constructor(app, user) { this.app = app; this.user = user; this.activeTab = 'issues'; }
  async init() { this.render(); this.attachEvents(); await this.loadIssues(); }
  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;
    mount.innerHTML = renderPortalShell({
      roleTitle: 'Laundry Staff Portal', roleIcon: 'fa-shirt', userName: this.user.fullName,
      userSubtitle: this.user.hostelName || 'Campus Laundry',
      navItems: [{ id: 'issues', icon: 'fa-shirt', label: 'Laundry Issues' }], activeTab: this.activeTab,
      contentHtml: `<div class="portal-pane active"><div class="card"><div class="card-header"><h3 class="card-title">Assigned Laundry Issues</h3><button class="btn btn-secondary btn-sm" id="btn-refresh-laundry">Refresh</button></div><div id="laundry-issues-mount"><div class="loading-spinner"></div></div></div></div>`
    });
  }
  attachEvents() { attachPortalShellEvents(); document.getElementById('btn-refresh-laundry')?.addEventListener('click', () => this.loadIssues()); }
  async loadIssues() {
    const mount = document.getElementById('laundry-issues-mount'); if (!mount) return;
    try {
      const res = await fetch(`/api/complaints/laundry/staff/${this.user.id}`); const data = await res.json(); if (!res.ok) throw new Error(data.error);
      const issues = data.complaints || [];
      mount.innerHTML = issues.length ? issues.map(issue => `<div style="padding:14px;border-bottom:1px solid var(--border-color);"><div style="display:flex;justify-content:space-between;gap:12px;"><div><strong>${issue.category}</strong><div style="font-size:.82rem;color:var(--text-secondary);">${issue.studentName} · Room ${issue.roomNumber || '—'} · ${issue.description}</div>${issue.photoUrl ? `<a href="${issue.photoUrl}" target="_blank" rel="noopener"><img src="${issue.photoUrl}" alt="Submitted laundry issue photo" style="width:72px;height:72px;object-fit:cover;border-radius:var(--radius-sm);margin-top:8px;border:1px solid var(--border-color);"></a>` : ''}</div></div><span class="status-pill warning">${issue.status.replaceAll('_', ' ')}</span></div><div style="display:flex;gap:8px;margin-top:10px;"><select class="form-select laundry-status" data-id="${issue.id}"><option value="UNDER_REVIEW">Under review</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved — confirm</option></select><input class="form-input laundry-notes" data-id="${issue.id}" value="${issue.caretakerNotes || ''}" placeholder="Update note"><button class="btn btn-primary btn-sm btn-save-laundry" data-id="${issue.id}">Save</button></div></div>`).join('') : '<div class="empty-state">No laundry issues are assigned to you.</div>';
      mount.querySelectorAll('.btn-save-laundry').forEach(button => button.addEventListener('click', () => this.updateIssue(button.dataset.id)));
    } catch (error) { mount.innerHTML = `<div class="error-msg">${error.message}</div>`; }
  }
  async updateIssue(id) {
    const status = document.querySelector(`.laundry-status[data-id="${id}"]`)?.value;
    const notes = document.querySelector(`.laundry-notes[data-id="${id}"]`)?.value;
    try { const res = await fetch('/api/complaints/laundry/update-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaintId: id, staffId: this.user.id, status, notes }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); this.app.toast('Laundry issue updated.', 'success'); this.loadIssues(); } catch (error) { this.app.toast(error.message, 'danger'); }
  }
}
