// public/js/portalLayout.js
// Universal Left List Menu Sidebar & Shell with 3-Dashes Menu Toggle for All SHARP Portals

export function isSidebarCollapsed() {
  return localStorage.getItem('sharp-sidebar-collapsed') === 'true';
}

export function setSidebarCollapsed(collapsed) {
  localStorage.setItem('sharp-sidebar-collapsed', collapsed ? 'true' : 'false');
}

/**
 * Wraps portal content in a responsive layout with a sleek left list menu sidebar
 * and a 3-dashes toggle button.
 */
export function renderPortalShell({
  roleTitle = 'Portal',
  roleIcon = 'fa-building-shield',
  userName = 'User',
  userSubtitle = '',
  navItems = [], // Array of { id, icon, label, badge }
  activeTab = 'dashboard',
  activeTabTitle = '',
  activeTabIcon = '',
  rightActionsHtml = '',
  contentHtml = ''
}) {
  const collapsed = isSidebarCollapsed();
  const currentItem = navItems.find(n => n.id === activeTab) || navItems[0];
  const tabTitle = activeTabTitle || currentItem?.label || 'Dashboard';
  const tabIcon = activeTabIcon || currentItem?.icon || 'fa-gauge';

  return `
    <div class="portal-layout ${collapsed ? 'sidebar-collapsed' : ''}" id="portal-layout">
      <!-- ═══ Left Side Navigation Sidebar (List Menu) ═══ -->
      <aside class="portal-sidebar" id="portal-sidebar" aria-label="Portal Navigation">
        <div class="portal-sidebar-header">
          <div class="sidebar-user-brief">
            <div class="sidebar-avatar-pill">
              <i class="fa-solid ${roleIcon}"></i>
            </div>
            <div class="sidebar-user-details">
              <span class="sidebar-portal-tag">${roleTitle}</span>
              <span class="sidebar-user-name" title="${userName}">${userName}</span>
              ${userSubtitle ? `<span class="sidebar-user-sub" title="${userSubtitle}">${userSubtitle}</span>` : ''}
            </div>
          </div>
          <button class="btn-sidebar-collapse" id="btn-sidebar-close" title="Hide menu (Collapse sidebar)">
            <i class="fa-solid fa-angles-left"></i>
          </button>
        </div>

        <div class="portal-sidebar-nav-wrap">
          <div class="sidebar-nav-title">MAIN NAVIGATION</div>
          <nav class="portal-sidebar-nav" role="navigation">
            ${navItems.map(item => `
              <button class="portal-tab-btn ${activeTab === item.id ? 'active' : ''}" data-tab="${item.id}" title="${item.label}">
                <i class="fa-solid ${item.icon}"></i>
                <span class="tab-label">${item.label}</span>
                ${item.badge ? `<span class="tab-badge">${item.badge}</span>` : ''}
              </button>
            `).join('')}
          </nav>
        </div>

        <div class="portal-sidebar-footer">
          <div class="sidebar-footer-brand">
            <i class="fa-solid fa-shield-halved"></i>
            <span>TIET Secure Resident Portal</span>
          </div>
        </div>
      </aside>

      <!-- Overlay Backdrop for Mobile / Small Screens -->
      <div class="portal-sidebar-backdrop" id="portal-sidebar-backdrop"></div>

      <!-- ═══ Right Side Main Content Area ═══ -->
      <div class="portal-main-wrapper">
        <!-- Top Action Bar with 3-Dashes Menu Button -->
        <div class="portal-top-bar">
          <div class="portal-top-bar-left">
            <button class="btn-sidebar-toggle" id="btn-portal-sidebar-toggle" title="Toggle Navigation Menu">
              <i class="fa-solid fa-bars"></i>
              <span class="toggle-btn-label">Menu</span>
            </button>
            <div class="portal-breadcrumb">
              <span class="breadcrumb-root">${roleTitle}</span>
              <i class="fa-solid fa-chevron-right breadcrumb-arrow"></i>
              <span class="breadcrumb-active">
                <i class="fa-solid ${tabIcon}"></i> ${tabTitle}
              </span>
            </div>
          </div>

          <div class="portal-top-bar-right">
            ${rightActionsHtml}
          </div>
        </div>

        <!-- Portal Panes Container -->
        <div class="portal-panes-body">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches event listeners for the 3-dashes toggle button, close button, and mobile backdrop.
 */
export function attachPortalShellEvents(onTabClick) {
  const layout = document.getElementById('portal-layout');
  const toggleBtn = document.getElementById('btn-portal-sidebar-toggle');
  const closeBtn = document.getElementById('btn-sidebar-close');
  const backdrop = document.getElementById('portal-sidebar-backdrop');

  const toggleSidebar = () => {
    if (!layout) return;
    if (window.innerWidth <= 992) {
      layout.classList.toggle('sidebar-drawer-open');
    } else {
      const isNowCollapsed = !layout.classList.contains('sidebar-collapsed');
      layout.classList.toggle('sidebar-collapsed', isNowCollapsed);
      setSidebarCollapsed(isNowCollapsed);
    }
  };

  toggleBtn?.addEventListener('click', toggleSidebar);
  closeBtn?.addEventListener('click', toggleSidebar);
  backdrop?.addEventListener('click', () => {
    layout?.classList.remove('sidebar-drawer-open');
  });

  // When clicking any tab button on mobile, auto-close drawer
  document.querySelectorAll('.portal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 992) {
        layout?.classList.remove('sidebar-drawer-open');
      }
      if (typeof onTabClick === 'function') {
        onTabClick(btn.getAttribute('data-tab'));
      }
    });
  });
}
