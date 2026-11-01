import { renderPortalShell, attachPortalShellEvents } from './portalLayout.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export class MessManagerPortal {
  constructor(app, user) {
    this.app = app;
    this.user = user;
    this.activeTab = 'dashboard';
    this.feedback = [];
    this.messName = user.messName || (user.hostelName ? `${user.hostelName} Mess` : 'Assigned Mess');
    this.mealFilter = 'all';
    this.categoryFilter = 'all';
  }

  async init() {
    try {
      await this.loadFeedback();
    } catch (error) {
      this.app.toast(error.message, 'danger');
    }
    this.render();
    this.attachEvents();
  }

  async loadFeedback() {
    const response = await fetch(`/api/complaints/mess-feedback/manager/${encodeURIComponent(this.user.id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load mess feedback');
    this.feedback = data.feedback || [];
    this.messName = data.messName || this.messName;
  }

  async refreshFeedback() {
    try {
      await this.loadFeedback();
      this.render();
      this.attachEvents();
      if (this.activeTab === 'feedback') this.renderFeedbackList();
    } catch (error) {
      this.app.toast(error.message, 'danger');
    }
  }

  render() {
    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    const navItems = [
      { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
      { id: 'feedback', icon: 'fa-comments', label: 'Mess Feedback' }
    ];

    const contentHtml = `
      <div class="portal-pane ${this.activeTab === 'dashboard' ? 'active' : ''}" id="mess-pane-dashboard">
        ${this.renderDashboard()}
      </div>
      <div class="portal-pane ${this.activeTab === 'feedback' ? 'active' : ''}" id="mess-pane-feedback">
        ${this.renderFeedbackSection()}
      </div>
    `;

    mount.innerHTML = renderPortalShell({
      roleTitle: 'Mess Manager Portal',
      roleIcon: 'fa-utensils',
      userName: this.user.fullName,
      userSubtitle: this.messName,
      navItems,
      activeTab: this.activeTab,
      contentHtml
    });
  }

  renderDashboard() {
    const total = this.feedback.length;
    const average = total
      ? (this.feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total).toFixed(1)
      : '—';
    const lowRatings = this.feedback.filter(item => Number(item.rating) <= 2).length;

    return `
      <div class="demo-page-heading">
        <div>
          <h2>Mess Feedback Overview</h2>
          <p>Review anonymous resident feedback for <strong>${escapeHtml(this.messName)}</strong>.</p>
        </div>
        <span class="status-pill primary"><i class="fa-solid fa-utensils"></i> Mess Manager</span>
      </div>

      <div class="grid-3" style="margin-bottom: 24px;">
        <div class="stat-widget">
          <div class="stat-icon info"><i class="fa-solid fa-comments"></i></div>
          <div class="stat-content"><span class="stat-label">Total Feedback</span><span class="stat-value">${total}</span></div>
        </div>
        <div class="stat-widget">
          <div class="stat-icon warning"><i class="fa-solid fa-star"></i></div>
          <div class="stat-content"><span class="stat-label">Average Rating</span><span class="stat-value">${average}${total ? ' / 5' : ''}</span></div>
        </div>
        <div class="stat-widget">
          <div class="stat-icon danger"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="stat-content"><span class="stat-label">Low Ratings (1–2)</span><span class="stat-value">${lowRatings}</span></div>
        </div>
      </div>

      <div class="card demo-focus-card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-list-check"></i> Feedback Review</h3>
            <p class="card-subtitle">Feedback is anonymous: reporter identity is not available in this portal.</p>
          </div>
        </div>
        <div class="demo-action-grid two-up">
          <button class="btn btn-secondary btn-large-action" id="btn-open-mess-feedback">
            <i class="fa-solid fa-comments" style="color: var(--primary);"></i>
            <span>Open Feedback Inbox</span>
          </button>
          <button class="btn btn-secondary btn-large-action" id="btn-refresh-mess-dashboard">
            <i class="fa-solid fa-rotate" style="color: var(--info);"></i>
            <span>Refresh Feedback</span>
          </button>
        </div>
      </div>
    `;
  }

  renderFeedbackSection() {
    const meals = [...new Set(this.feedback.map(item => item.mealType).filter(Boolean))];
    const categories = [...new Set(this.feedback.map(item => item.category).filter(Boolean))];

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-comments"></i> Anonymous Feedback — ${escapeHtml(this.messName)}</h3>
            <p class="card-subtitle">Student identity is withheld from mess staff.</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-mess-inbox">
            <i class="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
        <div class="grid-2" style="margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label" for="mess-filter-meal">Filter by meal</label>
            <select id="mess-filter-meal" class="form-select">
              <option value="all">All meals</option>
              ${meals.map(meal => `<option value="${escapeHtml(meal)}" ${this.mealFilter === meal ? 'selected' : ''}>${escapeHtml(meal)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="mess-filter-category">Filter by category</label>
            <select id="mess-filter-category" class="form-select">
              <option value="all">All categories</option>
              ${categories.map(category => `<option value="${escapeHtml(category)}" ${this.categoryFilter === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="mess-manager-feedback-list"></div>
      </div>
    `;
  }

  renderFeedbackList() {
    const mount = document.getElementById('mess-manager-feedback-list');
    if (!mount) return;

    const visible = this.feedback.filter(item =>
      (this.mealFilter === 'all' || item.mealType === this.mealFilter) &&
      (this.categoryFilter === 'all' || item.category === this.categoryFilter)
    );

    if (!visible.length) {
      mount.innerHTML = `<div class="empty-state">No feedback matches these filters.</div>`;
      return;
    }

    mount.innerHTML = visible.map(item => {
      const rating = Math.min(5, Math.max(1, Number(item.rating) || 1));
      const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
      const needsAttention = rating <= 2;
      return `
        <article style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div>
              <strong>${escapeHtml(item.mealType)} — ${escapeHtml(item.category)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">${escapeHtml(item.date || '')}</div>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--warning);" aria-label="${rating} out of 5 stars">${stars}</span>
              ${needsAttention ? '<div><span class="status-pill warning">Needs attention</span></div>' : ''}
            </div>
          </div>
          <p style="margin: 0; color: var(--text-secondary);">${escapeHtml(item.comments)}</p>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 10px;"><i class="fa-solid fa-user-secret"></i> Anonymous student feedback</div>
        </article>
      `;
    }).join('');
  }

  attachEvents() {
    attachPortalShellEvents();

    document.querySelectorAll('.portal-tab-btn').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab;
        this.render();
        this.attachEvents();
        if (this.activeTab === 'feedback') this.renderFeedbackList();
      });
    });

    document.getElementById('btn-open-mess-feedback')?.addEventListener('click', () => {
      this.activeTab = 'feedback';
      this.render();
      this.attachEvents();
      this.renderFeedbackList();
    });

    document.getElementById('btn-refresh-mess-dashboard')?.addEventListener('click', () => this.refreshFeedback());
    document.getElementById('btn-refresh-mess-inbox')?.addEventListener('click', () => this.refreshFeedback());

    const mealSelect = document.getElementById('mess-filter-meal');
    mealSelect?.addEventListener('change', () => {
      this.mealFilter = mealSelect.value;
      this.renderFeedbackList();
    });

    const categorySelect = document.getElementById('mess-filter-category');
    categorySelect?.addEventListener('change', () => {
      this.categoryFilter = categorySelect.value;
      this.renderFeedbackList();
    });
  }
}
