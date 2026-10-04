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
