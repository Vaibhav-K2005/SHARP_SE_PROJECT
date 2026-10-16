// public/js/app.js
// Main Controller, Role Switcher, State Management & Portal Routing

import { StudentPortal } from './studentPortal.js';
import { ParentPortal } from './parentPortal.js';
import { CaretakerPortal } from './caretakerPortal.js';
import { AdminPortal } from './adminPortal.js';

class SharpApp {
  constructor() {
    this.currentUser = null;
    this.demoUsers = null;
    this.currentPortalInstance = null;
    this.notifications = [];
  }

  async init() {
    this.initTheme();
    this.initModal();
    this.attachHeaderEvents();
    this.renderHomePage();

    await this.fetchDemoUsers();
    await this.refreshHeaderBadge();
    this.renderDemoRolePills();

    // Always start on the login dashboard. The top debug switcher can still
    // impersonate users quickly without preserving a portal session on refresh.
    localStorage.removeItem('sharp-currentUser');
    this.renderHomePage();
    this.renderDemoRolePills();
  }

  initTheme() {
    let savedTheme = localStorage.getItem('sharp-theme');
    // If first time or set to legacy theme-dark default without explicit user toggle, default to theme-light
    if (!savedTheme || (savedTheme === 'theme-dark' && !localStorage.getItem('sharp-theme-user-set'))) {
      savedTheme = 'theme-light';
      localStorage.setItem('sharp-theme', 'theme-light');
    }
    document.body.className = savedTheme;

    const btnToggle = document.getElementById('btn-toggle-theme');
    const syncThemeToggle = (theme) => {
      if (!btnToggle) return;
      const isDark = theme === 'theme-dark';
      btnToggle.innerHTML = isDark
        ? '<i class="fa-solid fa-sun"></i> Switch to Light Theme'
        : '<i class="fa-solid fa-moon"></i> Switch to Dark Theme';
      btnToggle.title = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    };

    if (btnToggle) {
      syncThemeToggle(savedTheme);
      btnToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        const nextTheme = isDark ? 'theme-light' : 'theme-dark';
        document.body.className = nextTheme;
        localStorage.setItem('sharp-theme', nextTheme);
        localStorage.setItem('sharp-theme-user-set', 'true');
        syncThemeToggle(nextTheme);
      });
    }
  }

  async fetchDemoUsers() {
    try {
      const res = await fetch('/api/auth/demo-users');
      this.demoUsers = await res.json();
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async refreshHeaderBadge() {
    try {
      const res = await fetch('/api/allocation/status');
      const data = await res.json();
      const sem = data.semester || {};
      const semBadge = document.getElementById('header-semester-badge');
      const phaseChip = document.getElementById('header-phase-chip');

      if (semBadge && phaseChip) {
        if (sem.allotmentStatus === 'NOT_STARTED') {
          phaseChip.innerText = `Allotment: Not Started`;
          phaseChip.style.background = 'var(--warning-bg)';
          phaseChip.style.borderColor = 'var(--warning-border)';
          phaseChip.style.color = 'var(--warning)';
        } else if (sem.allotmentStatus === 'ENDED') {
          phaseChip.innerText = `Allotment: Ended`;
          phaseChip.style.background = 'var(--danger-bg)';
          phaseChip.style.borderColor = 'var(--danger-border)';
          phaseChip.style.color = 'var(--danger)';
        } else {
          phaseChip.innerText = `Phase ${sem.activePhase || 1}: ${this.getPhaseName(sem.activePhase || 1)}`;
          phaseChip.style.background = '';
          phaseChip.style.borderColor = '';
          phaseChip.style.color = '';
        }
      }
    } catch (err) {
      console.error('Failed to refresh semester badge:', err);
    }
  }

  getPhaseName(p) {
    const map = {
      1: 'Pre-Allocation',
      2: 'Cluster Formation',
      3: 'Eligibility Check',
      4: 'Room Selection',
      5: 'Conflict Resolution',
      6: 'Final Allocation',
      7: 'Fee Payment',
      8: 'Confirmed'
    };
    return map[p] || 'Allocation';
  }

  renderDemoRolePills() {
    const mount = document.getElementById('demo-role-pills');
    if (!mount || !this.demoUsers) return;

    const students = this.demoUsers.students || [];
    const parents = this.demoUsers.parents || [];
    const caretakers = this.demoUsers.caretakers || [];
    const admins = this.demoUsers.admins || [];

    const pills = [];

    // Add admins
    admins.forEach(a => {
      pills.push({ label: `Admin (${a.fullName.split(' ')[0]})`, user: a, icon: 'fa-user-shield' });
    });

    // Add registered caretakers
    caretakers.forEach(c => {
      pills.push({ label: `Caretaker (${c.hostelName?.split(' ')[0] || c.fullName.split(' ')[0]})`, user: c, icon: 'fa-building-user' });
    });

    // Add registered students
    students.forEach(s => {
      pills.push({ label: `Student (${s.fullName.split(' ')[0]})`, user: s, icon: 'fa-user-graduate' });
    });

    // Add registered parents
    parents.forEach(p => {
      pills.push({ label: `Parent (${p.fullName.split(' ')[0]})`, user: p, icon: 'fa-people-roof' });
    });

    if (pills.length === 0) {
      mount.innerHTML = `<span style="font-size: 0.72rem; color: var(--text-muted); padding: 4px 8px;">No debug accounts available yet. Register or reset seed data to add accounts.</span>`;
      return;
    }

    const activeIndex = pills.findIndex(p => p.user?.id === this.currentUser?.id);
    const activePill = activeIndex >= 0 ? pills[activeIndex] : null;

    mount.innerHTML = `
      <div class="demo-debug-dropdown" id="demo-debug-dropdown">
        <button class="demo-debug-trigger" id="btn-debug-switcher" title="Debug-only quick user switcher">
          <span><i class="fa-solid fa-bug"></i> Debug User</span>
          <strong>${activePill ? activePill.label : 'Select account'}</strong>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="demo-debug-menu" id="demo-debug-menu">
          ${pills.map((p, idx) => `
            <button class="demo-role-btn ${this.currentUser?.id === p.user?.id ? 'active' : ''}" data-idx="${idx}" title="Debug login as ${p.user.email}">
              <span><i class="fa-solid ${p.icon}"></i> ${p.label}</span>
              <small>${p.user.email}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const dropdown = mount.querySelector('#demo-debug-dropdown');
    const trigger = mount.querySelector('#btn-debug-switcher');
    trigger?.addEventListener('click', (event) => {
      event.stopPropagation();
      const willShow = !dropdown?.classList.contains('show');
      dropdown?.classList.toggle('show', willShow);
      if (willShow) {
        setTimeout(() => {
          document.addEventListener('click', () => dropdown?.classList.remove('show'), { once: true });
        }, 0);
      }
    });

    mount.querySelectorAll('.demo-role-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const idx = Number(btn.getAttribute('data-idx'));
        if (pills[idx]?.user) {
          this.switchUser(pills[idx].user);
          this.renderDemoRolePills();
        }
      });
    });

  }

  // ═══════════════════════════════════════════════════════
  // HOME / LANDING PAGE
  // ═══════════════════════════════════════════════════════
  renderHomePage() {
    this.currentUser = null;
    localStorage.removeItem('sharp-currentUser');

    // Update Header
    const guestAuth = document.getElementById('header-auth-guest');
    const userAuth = document.getElementById('header-auth-user');
    if (guestAuth) guestAuth.style.display = 'flex';
    if (userAuth) userAuth.style.display = 'none';

    const mount = document.getElementById('portal-mount-point');
    if (!mount) return;

    mount.innerHTML = `
      <div class="home-container">
        <!-- Hero Section -->
        <div class="home-hero">
          <div class="hero-institute-tag">
            <i class="fa-solid fa-right-to-bracket"></i> SHARP Login Dashboard
          </div>
          <h1 class="hero-title">
            Sign in to your <br>
            <span class="hero-gradient-text">Hostel Portal</span>
          </h1>
          <p class="hero-desc">
            Choose a role to sign in or create a demo account. The debug switcher in the top bar is only for quick testing and bypasses manual login.
          </p>
          <div class="hero-actions">
            <button class="hero-btn-primary" id="btn-hero-login">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In
            </button>
            <button class="hero-btn-secondary" id="btn-hero-register">
              <i class="fa-solid fa-user-plus"></i> Register New User
            </button>
          </div>
        </div>

        <!-- Campus Scale Stats Ribbon -->
        <div class="home-stats-ribbon">
          <div class="stat-ribbon-item">
            <div class="stat-ribbon-icon"><i class="fa-solid fa-building"></i></div>
            <div class="stat-ribbon-text">
              <span class="stat-ribbon-val">11</span>
              <span class="stat-ribbon-lbl">Campus Hostels</span>
            </div>
          </div>
          <div class="stat-ribbon-item">
            <div class="stat-ribbon-icon"><i class="fa-solid fa-layer-group"></i></div>
            <div class="stat-ribbon-text">
              <span class="stat-ribbon-val">8</span>
              <span class="stat-ribbon-lbl">Floors per Hostel</span>
            </div>
          </div>
          <div class="stat-ribbon-item">
            <div class="stat-ribbon-icon"><i class="fa-solid fa-door-open"></i></div>
            <div class="stat-ribbon-text">
              <span class="stat-ribbon-val">50</span>
              <span class="stat-ribbon-lbl">Rooms per Floor</span>
            </div>
          </div>
          <div class="stat-ribbon-item">
            <div class="stat-ribbon-icon"><i class="fa-solid fa-cubes"></i></div>
            <div class="stat-ribbon-text">
              <span class="stat-ribbon-val">2,200</span>
              <span class="stat-ribbon-lbl">Room Suites (4,400 Rms)</span>
            </div>
          </div>
          <div class="stat-ribbon-item">
            <div class="stat-ribbon-icon"><i class="fa-solid fa-users"></i></div>
            <div class="stat-ribbon-text">
              <span class="stat-ribbon-val">8,800</span>
              <span class="stat-ribbon-lbl">Total Bed Capacity</span>
            </div>
          </div>
        </div>

        <!-- 4 Portals Overview Grid -->
        <div>
          <h2 class="home-portals-section-title">
            <i class="fa-solid fa-shapes"></i> Select Your Resident Portal
          </h2>
          <div class="home-portals-grid" style="margin-top: 16px;">
            
            <!-- 1. Student Portal Card -->
            <div class="home-portal-card">
              <div class="portal-card-header">
                <div class="portal-card-icon student"><i class="fa-solid fa-user-graduate"></i></div>
                <span class="portal-card-role-badge student">Student</span>
              </div>
              <h3 class="portal-card-title">Student Portal</h3>
              <p class="portal-card-desc">
                Register with your official @thapar.edu email. Enter your 10-digit roll number to auto-derive academic year, choose pre-allocation roommate preferences, pick suites on the airline-style seat map, and download digital QR gate passes.
              </p>
              <div class="portal-card-features">
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Official @thapar.edu OTP Verification</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> 8-Floor Airline-Style Room Selection</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Digital QR Gate Passes & Maintenance Desk</div>
              </div>
              <div class="portal-card-actions">
                <button class="portal-card-btn-reg" id="btn-card-reg-student">
                  <i class="fa-solid fa-user-plus"></i> Register
                </button>
                <button class="portal-card-btn-login" id="btn-card-login-student">
                  Sign In
                </button>
              </div>
            </div>

            <!-- 2. Parent Portal Card -->
            <div class="home-portal-card">
              <div class="portal-card-header">
                <div class="portal-card-icon parent"><i class="fa-solid fa-people-roof"></i></div>
                <span class="portal-card-role-badge parent">Parent</span>
              </div>
              <h3 class="portal-card-title">Parent Portal</h3>
              <p class="portal-card-desc">
                Link to your child's account using their official 10-digit Roll Number and your email. Review and approve home leave requests with 1-click, authorize local late entries, and track digital passes.
              </p>
              <div class="portal-card-features">
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Student Roll Number Linking</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> 1-Click Home Leave & Outing Approvals</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Dual-Authority Local Entry Security</div>
              </div>
              <div class="portal-card-actions">
                <button class="portal-card-btn-reg" id="btn-card-reg-parent">
                  <i class="fa-solid fa-user-plus"></i> Register
                </button>
                <button class="portal-card-btn-login" id="btn-card-login-parent">
                  Sign In
                </button>
              </div>
            </div>

            <!-- 3. Caretaker Portal Card -->
            <div class="home-portal-card">
              <div class="portal-card-header">
                <div class="portal-card-icon caretaker"><i class="fa-solid fa-building-user"></i></div>
                <span class="portal-card-role-badge caretaker">Caretaker</span>
              </div>
              <h3 class="portal-card-title">Caretaker Portal</h3>
              <p class="portal-card-desc">
                Register as caretaker for any of the 11 campus hostels (Agira Hall, Anantam Hall, Hostel O, B, J, etc.). Monitor live 8-floor suite occupancy, execute cluster formation, run conflict resolution, and triage maintenance.
              </p>
              <div class="portal-card-features">
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> 11 Hostels 8-Floor Live Blueprint</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Cluster Formation & Conflict Resolver</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Local Entry Approvals & Complaint Desk</div>
              </div>
              <div class="portal-card-actions">
                <button class="portal-card-btn-reg" id="btn-card-reg-caretaker">
                  <i class="fa-solid fa-user-plus"></i> Register
                </button>
                <button class="portal-card-btn-login" id="btn-card-login-caretaker">
                  Sign In
                </button>
              </div>
            </div>

            <!-- 4. Administrator Portal Card -->
            <div class="home-portal-card">
              <div class="portal-card-header">
                <div class="portal-card-icon admin"><i class="fa-solid fa-user-shield"></i></div>
                <span class="portal-card-role-badge admin">Administrator</span>
              </div>
              <h3 class="portal-card-title">Hostel Board Admin</h3>
              <p class="portal-card-desc">
                Configure campus-wide allocation parameters, adjust academic year CGPA eligibility rules, manage semester deadlines, and oversee university-wide housing operations and audit trails.
              </p>
              <div class="portal-card-features">
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Dynamic Year/Gender/CGPA Rule Builder</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Universal Allocation Parameters</div>
                <div class="portal-card-feature-item"><i class="fa-solid fa-check"></i> Official College Admin Access</div>
              </div>
              <div class="portal-card-actions">
                <button class="portal-card-btn-reg" id="btn-card-login-admin" style="background: var(--info-bg); border-color: var(--info-border); color: var(--info);">
                  <i class="fa-solid fa-lock"></i> Admin Sign In
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Attach Home Page Listeners
    document.getElementById('btn-hero-register')?.addEventListener('click', () => this.openRegisterModal('student'));
    document.getElementById('btn-hero-login')?.addEventListener('click', () => this.openLoginModal('student'));
    
    document.getElementById('btn-card-reg-student')?.addEventListener('click', () => this.openRegisterModal('student'));
    document.getElementById('btn-card-login-student')?.addEventListener('click', () => this.openLoginModal('student'));

    document.getElementById('btn-card-reg-parent')?.addEventListener('click', () => this.openRegisterModal('parent'));
    document.getElementById('btn-card-login-parent')?.addEventListener('click', () => this.openLoginModal('parent'));

    document.getElementById('btn-card-reg-caretaker')?.addEventListener('click', () => this.openRegisterModal('caretaker'));
    document.getElementById('btn-card-login-caretaker')?.addEventListener('click', () => this.openLoginModal('caretaker'));

    document.getElementById('btn-card-login-admin')?.addEventListener('click', () => this.openLoginModal('admin'));
  }

  switchUser(user) {
    if (!user) return;
    this.currentUser = user;
    localStorage.setItem('sharp-currentUser', JSON.stringify(user));

    // Update Header
    const guestAuth = document.getElementById('header-auth-guest');
    const userAuth = document.getElementById('header-auth-user');
    if (guestAuth) guestAuth.style.display = 'none';
    if (userAuth) userAuth.style.display = 'flex';

    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-user-avatar');
    const dropName = document.getElementById('dropdown-user-name');
    const dropEmail = document.getElementById('dropdown-user-email');

    const initials = (user.fullName || 'User').split(' ').map(n => n[0]).join('').slice(0, 2);

    if (nameEl) nameEl.innerText = user.fullName;
    if (roleEl) roleEl.innerText = user.role.toUpperCase();
    if (avatarEl) avatarEl.innerText = initials;
    if (dropName) dropName.innerText = user.fullName;
    if (dropEmail) dropEmail.innerText = user.email;

    this.toast(`Signed in as ${user.fullName} (${user.role.toUpperCase()})`, 'info');

    // Mount respective portal
    this.routePortal(user);
    this.loadNotifications();
    this.renderDemoRolePills();
  }

  routePortal(user) {
    if (user.role === 'student') {
      this.currentPortalInstance = new StudentPortal(this, user);
    } else if (user.role === 'parent') {
      this.currentPortalInstance = new ParentPortal(this, user);
    } else if (user.role === 'caretaker') {
      this.currentPortalInstance = new CaretakerPortal(this, user);
    } else if (user.role === 'admin') {
      this.currentPortalInstance = new AdminPortal(this, user);
    }

    if (this.currentPortalInstance) {
      this.currentPortalInstance.init();
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('sharp-currentUser');
    this.toast('You have logged out of your resident portal', 'info');
    this.renderHomePage();
    this.renderDemoRolePills();
  }

  async loadNotifications() {
    if (!this.currentUser) return;
    try {
      const res = await fetch(`/api/notifications/${this.currentUser.id}`);
      this.notifications = await res.json();
      const badge = document.getElementById('notif-badge');
      const list = document.getElementById('notif-list');

      const unreadCount = this.notifications.filter(n => !n.read).length;
      if (badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
      }

      if (list) {
        if (this.notifications.length === 0) {
          list.innerHTML = `<div class="empty-state">No notifications right now</div>`;
        } else {
          list.innerHTML = this.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}">
              <div class="notif-msg">${n.message}</div>
              <div class="notif-time">${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  attachHeaderEvents() {
    // Reset Data
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (confirm('Reset system data to initial clean database state?')) {
          await fetch('/api/admin/reset-data', { method: 'POST' });
          this.toast('Database restored to clean initial state (0 test users)!', 'success');
          await this.fetchDemoUsers();
          await this.refreshHeaderBadge();
          this.renderHomePage();
          this.renderDemoRolePills();
        }
      });
    }

    // Brand Logo Click -> Go Home
    const btnGoHome = document.getElementById('btn-go-home');
    if (btnGoHome) {
      btnGoHome.addEventListener('click', () => {
        this.renderHomePage();
      });
    }

    // Header Guest Auth Buttons
    document.getElementById('btn-header-login')?.addEventListener('click', () => this.openLoginModal());
    document.getElementById('btn-header-register')?.addEventListener('click', () => this.openRegisterModal());

    // Header Logout Button
    document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());

    // Notifications Dropdown Toggle
    const btnNotif = document.getElementById('btn-notif-bell');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (btnNotif && notifDropdown) {
      btnNotif.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
        document.getElementById('profile-dropdown')?.classList.remove('show');
      });
    }

    // Mark All Read
    const btnMarkRead = document.getElementById('btn-mark-all-read');
    if (btnMarkRead) {
      btnMarkRead.addEventListener('click', () => {
        this.notifications.forEach(n => n.read = true);
        const badge = document.getElementById('notif-badge');
        if (badge) badge.style.display = 'none';
        this.loadNotifications();
      });
    }

    // User Profile Dropdown Toggle
    const btnProfile = document.getElementById('btn-user-profile');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (btnProfile && profileDropdown) {
      btnProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
        notifDropdown?.classList.remove('show');
      });
    }

    // Close Dropdowns on Click Outside
    document.addEventListener('click', () => {
      notifDropdown?.classList.remove('show');
      profileDropdown?.classList.remove('show');
    });

    // Login & Register Modals in Profile Menu
    document.getElementById('btn-open-login')?.addEventListener('click', () => this.openLoginModal());
    document.getElementById('btn-open-register')?.addEventListener('click', () => this.openRegisterModal());
  }

  // ═══════════════════════════════════════════════════════
  // LOGIN MODAL
  // ═══════════════════════════════════════════════════════
  openLoginModal(initialRole = 'student') {
    const students = this.demoUsers?.students || [];
    const parents = this.demoUsers?.parents || [];
    const caretakers = this.demoUsers?.caretakers || [];
    const admins = this.demoUsers?.admins || [];

    const allUsers = [...admins, ...caretakers, ...students, ...parents];

    let quickPicksHtml = '';
    if (allUsers.length > 0) {
      quickPicksHtml = `
        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border-color);">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Registered Accounts in Real Database:
          </span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            ${allUsers.map(u => `
              <button class="btn btn-secondary btn-sm btn-quick-login" data-role="${u.role}" data-email="${u.email}" style="font-size: 0.72rem; padding: 3px 8px;">
                <strong>${u.fullName}</strong> (${u.role.toUpperCase()})
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    const defaultEmail = initialRole === 'admin' ? 'admin@thapar.edu' : (allUsers.find(u => u.role === initialRole)?.email || '');

    const modalBody = `
      <div class="form-group">
        <label class="form-label">Select Your Role</label>
        <select id="login-role" class="form-select">
          <option value="student" ${initialRole === 'student' ? 'selected' : ''}>Student</option>
          <option value="parent" ${initialRole === 'parent' ? 'selected' : ''}>Parent</option>
          <option value="caretaker" ${initialRole === 'caretaker' ? 'selected' : ''}>Hostel Caretaker</option>
          <option value="admin" ${initialRole === 'admin' ? 'selected' : ''}>Administrator (Board)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Registered Email Address</label>
        <input type="email" id="login-email" class="form-input" placeholder="e.g. name@thapar.edu" value="${defaultEmail}">
      </div>

      ${quickPicksHtml}
    `;

    this.openModal('Sign In to SHARP', modalBody, [
      {
        label: 'Sign In',
        class: 'btn-primary',
        onClick: async () => {
          const role = document.getElementById('login-role').value;
          const email = document.getElementById('login-email').value.trim();

          if (!email) {
            this.toast('Please enter your registered email address', 'warning');
            return;
          }

          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role, email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.closeModal();
            this.switchUser(data.user);
          } catch (err) {
            this.toast(err.message, 'danger');
          }
        }
      }
    ]);

    // Attach quick login clicks
    setTimeout(() => {
      document.querySelectorAll('.btn-quick-login').forEach(btn => {
        btn.addEventListener('click', () => {
          const role = btn.getAttribute('data-role');
          const email = btn.getAttribute('data-email');
          const sel = document.getElementById('login-role');
          const inp = document.getElementById('login-email');
          if (sel) sel.value = role;
          if (inp) inp.value = email;
        });
      });
    }, 50);
  }

  // ═══════════════════════════════════════════════════════
  // REGISTRATION MODAL (Student, Parent, Caretaker)
  // ═══════════════════════════════════════════════════════
  openRegisterModal(initialRole = 'student') {
    let verifiedEmail = null;
    let selectedRole = initialRole;

    const modalBody = `
      <!-- Role Switcher Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 4px; border-radius: var(--radius-md);">
        <button id="tab-reg-student" class="btn btn-sm ${initialRole === 'student' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;">
          <i class="fa-solid fa-graduation-cap"></i> Student
        </button>
        <button id="tab-reg-parent" class="btn btn-sm ${initialRole === 'parent' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;">
          <i class="fa-solid fa-people-roof"></i> Parent
        </button>
        <button id="tab-reg-caretaker" class="btn btn-sm ${initialRole === 'caretaker' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;">
          <i class="fa-solid fa-building-user"></i> Caretaker
        </button>
      </div>

      <!-- ================= 1. STUDENT REGISTRATION WORKFLOW ================= -->
      <div id="section-student-reg" style="display: ${initialRole === 'student' ? 'block' : 'none'};">
        <!-- Step 1: Real Thapar Email & Verification -->
        <div id="step-student-verify" style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 0.95rem; color: var(--primary);">
              <i class="fa-solid fa-envelope-circle-check"></i> Step 1: Official Email Verification
            </strong>
            <span id="badge-email-status" class="status-pill warning">Pending Verification</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px;">
            Students must register using an official institutional email ending with <strong>@thapar.edu</strong>.
          </p>

          <div class="form-group">
            <label class="form-label">Official Thapar Email Address</label>
            <div style="display: flex; gap: 8px;">
              <input type="email" id="student-thapar-email" class="form-input" placeholder="e.g. student.demo@thapar.edu" style="font-family: var(--font-mono);">
              <button class="btn btn-primary btn-sm" id="btn-student-send-otp" style="white-space: nowrap;">
                <i class="fa-solid fa-paper-plane"></i> Send OTP
              </button>
            </div>
          </div>

          <!-- OTP Box -->
          <div id="student-otp-box" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--border-color);">
            <div id="student-otp-alert" style="background: rgba(184,86,20,0.1); border: 1px solid var(--border-glow); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 0.82rem; color: var(--primary);">
            </div>
            <div class="form-group">
              <label class="form-label">Enter 6-Digit Verification Code</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="student-otp-code" class="form-input" placeholder="e.g. 123456" maxlength="6" style="font-family: var(--font-mono); font-size: 1.1rem; letter-spacing: 0.2em; text-align: center;">
                <button class="btn btn-success btn-sm" id="btn-student-verify-otp" style="white-space: nowrap;">
                  <i class="fa-solid fa-check-double"></i> Verify Code
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Student & Parent Details -->
        <div id="step-student-details" style="display: none; background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
          <div style="margin-bottom: 14px;">
            <strong style="font-size: 0.95rem; color: var(--success);">
              <i class="fa-solid fa-id-card"></i> Step 2: Complete Student Profile & Parent Details
            </strong>
          </div>

          <!-- Student Profile -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">
              Student Academic Profile
            </span>
            <div class="grid-2" style="margin-top: 10px;">
              <div class="form-group">
                <label class="form-label">Student Full Name *</label>
                <input type="text" id="stu-fullname" class="form-input" placeholder="e.g. Aarav Mehta">
              </div>
              <div class="form-group">
                <label class="form-label">10-Digit Roll Number *</label>
                <input type="text" id="stu-rollno" class="form-input" placeholder="e.g. 1024260001" style="font-family: var(--font-mono);">
                <small id="stu-roll-derived-hint" style="color: var(--primary); font-size: 0.72rem; display: block; margin-top: 4px;"></small>
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Academic Year *</label>
                <select id="stu-year" class="form-select">
                  <option value="1">1st Year (College Automated Allotment)</option>
                  <option value="2">2nd Year</option>
                  <option value="3" selected>3rd Year (Cluster Allocation)</option>
                  <option value="4">4th Year (Cluster Allocation)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Course / Branch *</label>
                <input type="text" id="stu-course" class="form-input" value="B.Tech Computer Science" placeholder="e.g. B.Tech Computer Engineering">
              </div>
            </div>

            <div class="grid-3">
              <div class="form-group">
                <label class="form-label">Gender *</label>
                <select id="stu-gender" class="form-select">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Current Living Hostel *</label>
                <select id="stu-hostel" class="form-select">
                  <option value="Hostel A (Agira Hall)">Hostel A (Agira Hall)</option>
                  <option value="Hostel M (Anantam Hall)">Hostel M (Anantam Hall)</option>
                  <option value="Hostel O" selected>Hostel O</option>
                  <option value="Hostel B">Hostel B</option>
                  <option value="Hostel J">Hostel J</option>
                  <option value="Hostel H">Hostel H</option>
                  <option value="Hostel Q">Hostel Q (Girls)</option>
                  <option value="Hostel N">Hostel N (Girls)</option>
                  <option value="Hostel E">Hostel E (Girls)</option>
                  <option value="Hostel F">Hostel F (First Year)</option>
                  <option value="Hostel G">Hostel G (First Year)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Room Number</label>
                <input type="text" id="stu-room" class="form-input" value="101" placeholder="e.g. 101">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Current Academic CGPA</label>
              <input type="number" step="0.01" id="stu-cgpa" class="form-input" value="8.50" placeholder="e.g. 8.50">
            </div>
          </div>

          <!-- Parent Details -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-glow); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">
              <i class="fa-solid fa-users"></i> Parent & Guardian Details
            </span>
            <div class="grid-2" style="margin-top: 10px;">
              <div class="form-group">
                <label class="form-label">Parent / Guardian Full Name *</label>
                <input type="text" id="stu-parent-name" class="form-input" placeholder="e.g. Mr. Demo Guardian">
              </div>
              <div class="form-group">
                <label class="form-label">Parent Email Address *</label>
                <input type="email" id="stu-parent-email" class="form-input" placeholder="e.g. guardian.demo@example.com">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Parent Contact Phone *</label>
              <input type="text" id="stu-parent-phone" class="form-input" placeholder="e.g. +91 94140 12345">
            </div>
          </div>

          <!-- Contact & Address -->
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Student Phone Number</label>
              <input type="text" id="stu-phone" class="form-input" placeholder="+91 98765 43210">
            </div>
            <div class="form-group">
              <label class="form-label">Home Address</label>
              <input type="text" id="stu-address" class="form-input" placeholder="City, State">
            </div>
          </div>

          <button class="btn btn-primary" id="btn-student-submit-final" style="width: 100%; margin-top: 10px;">
            <i class="fa-solid fa-check"></i> Complete Registration & Launch Student Portal
          </button>
        </div>
      </div>

      <!-- ================= 2. PARENT REGISTRATION WORKFLOW ================= -->
      <div id="section-parent-reg" style="display: ${initialRole === 'parent' ? 'block' : 'none'};">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 18px;">
          <strong style="font-size: 0.95rem; color: var(--primary); display: block; margin-bottom: 4px;">
            <i class="fa-solid fa-link"></i> Connect to Your Child's Account
          </strong>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px;">
            Parents register by verifying their student's official Roll Number and their own email ID.
          </p>

          <div class="form-group">
            <label class="form-label">Student's Official Roll Number *</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="parent-student-roll" class="form-input" placeholder="e.g. 1024260001" style="font-family: var(--font-mono); text-transform: uppercase;">
              <button class="btn btn-secondary btn-sm" id="btn-parent-lookup-student" style="white-space: nowrap;">
                <i class="fa-solid fa-magnifying-glass"></i> Verify Student
              </button>
            </div>
          </div>

          <!-- Student Lookup Live Result Card -->
          <div id="parent-student-lookup-card" style="display: none; margin-bottom: 14px;">
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Parent Full Name *</label>
              <input type="text" id="parent-fullname" class="form-input" placeholder="e.g. Mr. Demo Guardian">
            </div>
            <div class="form-group">
              <label class="form-label">Parent Email ID *</label>
              <input type="email" id="parent-email" class="form-input" placeholder="e.g. guardian.demo@example.com">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Parent Contact Phone</label>
            <input type="text" id="parent-phone" class="form-input" placeholder="e.g. +91 94140 12345">
          </div>

          <button class="btn btn-success" id="btn-parent-submit-final" style="width: 100%; margin-top: 10px;">
            <i class="fa-solid fa-user-plus"></i> Register Parent & Connect to Student
          </button>
        </div>
      </div>

      <!-- ================= 3. CARETAKER REGISTRATION WORKFLOW ================= -->
      <div id="section-caretaker-reg" style="display: ${initialRole === 'caretaker' ? 'block' : 'none'};">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; margin-bottom: 18px;">
          <strong style="font-size: 0.95rem; color: var(--warning); display: block; margin-bottom: 4px;">
            <i class="fa-solid fa-building-user"></i> Hostel Caretaker Registration
          </strong>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px;">
            Register as hostel caretaker to oversee floor plans, cluster formation, room conflict resolution, and resident gate passes.
          </p>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Caretaker Full Name *</label>
              <input type="text" id="caretaker-fullname" class="form-input" placeholder="e.g. Ms. Demo Caretaker">
            </div>
            <div class="form-group">
              <label class="form-label">Official Email ID *</label>
              <input type="email" id="caretaker-email" class="form-input" placeholder="e.g. caretaker.demo@thapar.edu">
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Assigned Campus Hostel *</label>
              <select id="caretaker-hostel" class="form-select">
                <option value="Hostel M (Anantam Hall)" selected>Hostel M (Anantam Hall)</option>
                <option value="Hostel A (Agira Hall)">Hostel A (Agira Hall)</option>
                <option value="Hostel O">Hostel O</option>
                <option value="Hostel B">Hostel B</option>
                <option value="Hostel J">Hostel J</option>
                <option value="Hostel H">Hostel H</option>
                <option value="Hostel Q">Hostel Q (Girls)</option>
                <option value="Hostel N">Hostel N (Girls)</option>
                <option value="Hostel E">Hostel E (Girls)</option>
                <option value="Hostel F (First Year Boys)">Hostel F (First Year Boys)</option>
                <option value="Hostel G (First Year Girls)">Hostel G (First Year Girls)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone Number</label>
              <input type="text" id="caretaker-phone" class="form-input" placeholder="+91 98765 43210">
            </div>
          </div>

          <button class="btn btn-warning" id="btn-caretaker-submit-final" style="width: 100%; margin-top: 10px; color: #000; font-weight: 800;">
            <i class="fa-solid fa-building-user"></i> Register Caretaker & Open Hostel Dashboard
          </button>
        </div>
      </div>
    `;

    this.openModal('Register for SHARP', modalBody);

    // Tab Toggling
    const tabStu = document.getElementById('tab-reg-student');
    const tabPar = document.getElementById('tab-reg-parent');
    const tabCar = document.getElementById('tab-reg-caretaker');
    const secStu = document.getElementById('section-student-reg');
    const secPar = document.getElementById('section-parent-reg');
    const secCar = document.getElementById('section-caretaker-reg');

    const selectTab = (role) => {
      selectedRole = role;
      tabStu.className = role === 'student' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      tabPar.className = role === 'parent' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      tabCar.className = role === 'caretaker' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';

      secStu.style.display = role === 'student' ? 'block' : 'none';
      secPar.style.display = role === 'parent' ? 'block' : 'none';
      secCar.style.display = role === 'caretaker' ? 'block' : 'none';
    };

    tabStu?.addEventListener('click', () => selectTab('student'));
    tabPar?.addEventListener('click', () => selectTab('parent'));
    tabCar?.addEventListener('click', () => selectTab('caretaker'));

    // Dynamic Roll Number Admission Year Detection
    const stuRollInput = document.getElementById('stu-rollno');
    const stuRollHint = document.getElementById('stu-roll-derived-hint');
    const stuYearSelect = document.getElementById('stu-year');

    stuRollInput?.addEventListener('input', () => {
      const val = stuRollInput.value.trim();
      if (/^\d{10}$/.test(val)) {
        const yearDigit = parseInt(val.substring(2, 4), 10);
        const admYear = 2000 + yearDigit;
        const currentSession = 2026;
        const computedYear = Math.max(1, Math.min(5, currentSession - admYear + 1));
        if (stuRollHint) {
          stuRollHint.innerHTML = `<i class="fa-solid fa-circle-info"></i> Admitted in <strong>${admYear}</strong> (${yearDigit}) &rarr; Automatically computed as <strong>${computedYear}${computedYear === 1 ? 'st' : computedYear === 2 ? 'nd' : computedYear === 3 ? 'rd' : 'th'} Year</strong>.`;
        }
        if (stuYearSelect) {
          stuYearSelect.value = computedYear.toString();
        }
      } else if (stuRollHint) {
        stuRollHint.innerText = '';
      }
    });

    // 1. Send OTP for student email
    const btnSendOtp = document.getElementById('btn-student-send-otp');
    btnSendOtp?.addEventListener('click', async () => {
      const emailInput = document.getElementById('student-thapar-email');
      const email = emailInput?.value.trim().toLowerCase();

      if (!email || (!email.endsWith('@thapar.edu') && !email.endsWith('.thapar.edu') && !email.endsWith('@thapar.ac.in'))) {
        this.toast('Please enter a valid Thapar email ending with @thapar.edu', 'warning');
        emailInput?.focus();
        return;
      }

      try {
        const res = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: 'student' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const otpBox = document.getElementById('student-otp-box');
        const otpAlert = document.getElementById('student-otp-alert');
        const otpInput = document.getElementById('student-otp-code');

        otpBox.style.display = 'block';
        otpAlert.innerHTML = `
          <strong><i class="fa-solid fa-key"></i> Verification Code:</strong> 
          <span style="font-family: var(--font-mono); font-weight: 700; font-size: 1.1rem; color: #fff; margin-left: 8px;">${data.verificationCode}</span>
          <button id="btn-autofill-code" class="btn btn-secondary btn-sm" style="float: right; padding: 2px 8px; font-size: 0.72rem;">Fill Code</button>
        `;
        otpInput.value = data.verificationCode;

        document.getElementById('btn-autofill-code')?.addEventListener('click', () => {
          otpInput.value = data.verificationCode;
        });

        this.toast(`Verification code generated for ${email}!`, 'info');
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });

    // 2. Verify OTP for student email
    const btnVerifyOtp = document.getElementById('btn-student-verify-otp');
    btnVerifyOtp?.addEventListener('click', async () => {
      const email = document.getElementById('student-thapar-email')?.value.trim().toLowerCase();
      const code = document.getElementById('student-otp-code')?.value.trim();

      if (!code) {
        this.toast('Please enter the verification code', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        verifiedEmail = email;

        // Update badge and lock email input
        const badge = document.getElementById('badge-email-status');
        badge.className = 'status-pill success';
        badge.innerHTML = '<i class="fa-solid fa-check"></i> Verified';

        document.getElementById('student-thapar-email').disabled = true;
        document.getElementById('btn-student-send-otp').disabled = true;
        document.getElementById('student-otp-box').style.display = 'none';

        // Reveal Step 2
        document.getElementById('step-student-details').style.display = 'block';
        this.toast('Thapar email verified! Now complete student and parent details.', 'success');
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });

    // 3. Submit Student Registration
    const btnStudentSubmit = document.getElementById('btn-student-submit-final');
    btnStudentSubmit?.addEventListener('click', async () => {
      if (!verifiedEmail) {
        this.toast('Please verify your @thapar.edu email first', 'warning');
        return;
      }

      const fullName = document.getElementById('stu-fullname')?.value.trim();
      const rollNumber = document.getElementById('stu-rollno')?.value.trim();
      const academicYear = Number(document.getElementById('stu-year')?.value);
      const course = document.getElementById('stu-course')?.value.trim();
      const gender = document.getElementById('stu-gender')?.value;
      const currentHostel = document.getElementById('stu-hostel')?.value;
      const currentRoom = document.getElementById('stu-room')?.value.trim();
      const cgpa = document.getElementById('stu-cgpa')?.value;

      const parentName = document.getElementById('stu-parent-name')?.value.trim();
      const parentEmail = document.getElementById('stu-parent-email')?.value.trim();
      const parentPhone = document.getElementById('stu-parent-phone')?.value.trim();

      const phone = document.getElementById('stu-phone')?.value.trim();
      const address = document.getElementById('stu-address')?.value.trim();

      if (!fullName || !rollNumber || !currentHostel) {
        this.toast('Please fill in all required student details (Full Name, Roll Number, Hostel)', 'warning');
        return;
      }

      if (!parentName || !parentEmail) {
        this.toast('Please fill in parent / guardian name and email address', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'student',
            email: verifiedEmail,
            fullName,
            rollNumber,
            academicYear,
            course,
            gender,
            currentHostel,
            currentRoom,
            cgpa,
            parentName,
            parentEmail,
            parentPhone,
            phone,
            address
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        this.toast('Student account successfully registered!', 'success');
        this.closeModal();

        await this.fetchDemoUsers();
        this.switchUser(data.user);
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });

    // 4. Parent Student Roll Number Live Lookup
    const btnParentLookup = document.getElementById('btn-parent-lookup-student');
    btnParentLookup?.addEventListener('click', async () => {
      const roll = document.getElementById('parent-student-roll')?.value.trim();
      const card = document.getElementById('parent-student-lookup-card');

      if (!roll) {
        this.toast('Please enter the student roll number to verify', 'warning');
        return;
      }

      try {
        const res = await fetch(`/api/auth/lookup-student/${encodeURIComponent(roll)}`);
        const data = await res.json();

        if (!data.found) {
          card.style.display = 'block';
          card.innerHTML = `
            <div style="background: var(--danger-bg); border: 1px solid var(--danger-border); padding: 10px 14px; border-radius: var(--radius-sm); color: var(--danger); font-size: 0.82rem; font-weight: 600;">
              <i class="fa-solid fa-triangle-exclamation"></i> ${data.message}
            </div>
          `;
          return;
        }

        const s = data.student;
        card.style.display = 'block';
        card.innerHTML = `
          <div style="background: var(--success-bg); border: 1px solid var(--success-border); padding: 12px 14px; border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong><i class="fa-solid fa-circle-check" style="color: var(--success);"></i> Student Found: ${s.fullName}</strong>
              <span class="status-pill success">${s.academicYear}${s.academicYear === 1 ? 'st' : s.academicYear === 2 ? 'nd' : s.academicYear === 3 ? 'rd' : 'th'} Year</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              Roll: <strong>${s.rollNumber}</strong> | Branch: ${s.course} | Hostel: ${s.currentHostel} Room ${s.currentRoom}
            </div>
          </div>
        `;

        if (s.parentEmail && !document.getElementById('parent-email').value) {
          document.getElementById('parent-email').value = s.parentEmail;
        }
        if (s.parentName && !document.getElementById('parent-fullname').value) {
          document.getElementById('parent-fullname').value = s.parentName;
        }

        this.toast(`Verified student ${s.fullName}!`, 'success');
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });

    // 5. Submit Parent Registration
    const btnParentSubmit = document.getElementById('btn-parent-submit-final');
    btnParentSubmit?.addEventListener('click', async () => {
      const studentRollNumber = document.getElementById('parent-student-roll')?.value.trim();
      const fullName = document.getElementById('parent-fullname')?.value.trim();
      const email = document.getElementById('parent-email')?.value.trim().toLowerCase();
      const phone = document.getElementById('parent-phone')?.value.trim();

      if (!studentRollNumber) {
        this.toast('Please enter the student roll number', 'warning');
        return;
      }
      if (!fullName || !email) {
        this.toast('Please provide parent full name and email address', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'parent',
            studentRollNumber,
            fullName,
            email,
            phone
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        this.toast(data.message || 'Parent registered successfully!', 'success');
        this.closeModal();

        await this.fetchDemoUsers();
        this.switchUser(data.user);
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });

    // 6. Submit Caretaker Registration
    const btnCaretakerSubmit = document.getElementById('btn-caretaker-submit-final');
    btnCaretakerSubmit?.addEventListener('click', async () => {
      const fullName = document.getElementById('caretaker-fullname')?.value.trim();
      const email = document.getElementById('caretaker-email')?.value.trim().toLowerCase();
      const hostelName = document.getElementById('caretaker-hostel')?.value;
      const phone = document.getElementById('caretaker-phone')?.value.trim();

      if (!fullName || !email || !hostelName) {
        this.toast('Please provide caretaker name, official email, and assigned hostel', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'caretaker',
            fullName,
            email,
            hostelName,
            phone
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        this.toast(data.message || 'Caretaker registered successfully!', 'success');
        this.closeModal();

        await this.fetchDemoUsers();
        this.switchUser(data.user);
      } catch (err) {
        this.toast(err.message, 'danger');
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // MODAL CONTROLLER
  // ═══════════════════════════════════════════════════════
  initModal() {
    this.modalOverlay = document.getElementById('modal-overlay') || document.getElementById('app-modal-overlay');
    this.modalTitle = document.getElementById('modal-title');
    this.modalBody = document.getElementById('modal-body');
    this.modalFooter = document.getElementById('modal-footer');
    this.modalClose = document.getElementById('modal-close') || document.getElementById('btn-modal-close');

    if (this.modalClose) {
      this.modalClose.addEventListener('click', () => this.closeModal());
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.modalOverlay) this.closeModal();
      });
    }
  }

  openModal(title, bodyHtml, actions = []) {
    if (!this.modalOverlay) return;
    this.modalTitle.innerText = title;
    this.modalBody.innerHTML = bodyHtml;

    if (actions.length > 0) {
      this.modalFooter.style.display = 'flex';
      this.modalFooter.innerHTML = actions.map((act, idx) => `
        <button class="btn ${act.class || 'btn-secondary'}" data-action-idx="${idx}">
          ${act.label}
        </button>
      `).join('');

      this.modalFooter.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-action-idx'));
          if (actions[idx]?.onClick) actions[idx].onClick();
        });
      });
    } else {
      this.modalFooter.style.display = 'none';
      this.modalFooter.innerHTML = '';
    }

    this.modalOverlay.classList.add('show');
  }

  closeModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('show');
    }
  }

  toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      success: 'fa-circle-check',
      danger: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    toast.innerHTML = `
      <i class="fa-solid ${iconMap[type] || 'fa-circle-info'}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Bootstrap SHARP on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.sharpApp = new SharpApp();
  window.sharpApp.init();
});
