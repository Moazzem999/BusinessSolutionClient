/* ==========================================================================
   Business Solution Client - Global / Shared JavaScript
   ========================================================================== */

// Global App Namespace & Helper Utilities
window.BSApp = window.BSApp || {
    getApiBaseUrl: function () {
        if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
            return API_BASE_URL.replace(/\/+$/, '');
        }
        return 'https://localhost:7148/api';
    },

    getStoredUser: function () {
        const storedUser = localStorage.getItem('bs_user');
        if (!storedUser) return null;
        try {
            return JSON.parse(storedUser);
        } catch (e) {
            return null;
        }
    },

    getStoredToken: function () {
        return localStorage.getItem('bs_token') || '';
    },

    clearSession: function () {
        localStorage.removeItem('bs_user');
        localStorage.removeItem('bs_token');
        document.cookie = 'bs_auth_token=; path=/; max-age=0; SameSite=Lax';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize user details in header (Avatar initials & Name)
    initGlobalUserHeader();
    
    // 2. Initialize mobile sidebar toggle & backdrop
    initMobileSidebar();

    // 3. Initialize Navigation Theme Color Manager (Navbar & Sidebar)
    initAppThemeManager();
});

/**
 * Syncs stored user name and initials into top navbar avatar element across layout pages.
 */
function initGlobalUserHeader() {
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    if (!userAvatarBtn) return;

    const user = BSApp.getStoredUser();
    if (user && user.name) {
        const dropdownName = document.getElementById('dropdown-user-name');
        if (dropdownName) {
            dropdownName.innerText = user.name;
        }

        const nameParts = user.name.trim().split(' ');
        let initials = 'BS';
        if (nameParts.length >= 2) {
            initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else if (nameParts.length === 1 && nameParts[0].length > 0) {
            initials = nameParts[0].substring(0, 2).toUpperCase();
        }
        userAvatarBtn.innerText = initials;
    }
}

/**
 * Initializes mobile responsive sidebar toggle behavior and overlay handling.
 */
function initMobileSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const navLinks = document.querySelectorAll('.sidebar-link:not([data-bs-toggle]), .sidebar-sublink');

    if (toggleBtn && sidebar && backdrop) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show-sidebar');
            backdrop.classList.toggle('show');
        });

        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('show-sidebar');
            backdrop.classList.remove('show');
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('show-sidebar');
                    backdrop.classList.remove('show');
                }
            });
        });
    }
}

/**
 * Initializes navigation color theme manager (Navbar + Sidebar) with persistent storage.
 */
function initAppThemeManager() {
    const themeButtons = document.querySelectorAll('.app-color-picker button[data-app-theme]');
    if (!themeButtons || themeButtons.length === 0) return;

    const savedTheme = localStorage.getItem('bs_app_theme') || 'default';
    applyAppTheme(savedTheme);

    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const themeName = btn.getAttribute('data-app-theme');
            applyAppTheme(themeName);
            localStorage.setItem('bs_app_theme', themeName);
        });
    });

    function applyAppTheme(themeName) {
        if (themeName && themeName !== 'default') {
            document.documentElement.setAttribute('data-app-theme', themeName);
        } else {
            document.documentElement.removeAttribute('data-app-theme');
        }

        // Update active checkmarks in dropdown
        themeButtons.forEach(btn => {
            const btnTheme = btn.getAttribute('data-app-theme');
            const checkIcon = btn.querySelector('.theme-check-icon');
            if (btnTheme === themeName) {
                btn.classList.add('active-theme-btn');
                if (checkIcon) checkIcon.classList.remove('d-none');
            } else {
                btn.classList.remove('active-theme-btn');
                if (checkIcon) checkIcon.classList.add('d-none');
            }
        });
    }
}
