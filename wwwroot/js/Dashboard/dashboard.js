/* ==========================================================================
   Business Solution Client - Dashboard Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

/**
 * Initializes dashboard event listeners and loads metrics.
 */
function initDashboard() {
    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadAllDashboardMetrics(true);
        });
    }

    loadAllDashboardMetrics();
}

/**
 * Resolves API Base URL from application configuration or global variable.
 */
function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getApiBaseUrl === 'function') {
        const url = BSApp.getApiBaseUrl();
        if (url) return url.replace(/\/+$/, '');
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL.replace(/\/+$/, '');
    }
    return 'https://localhost:7148/api';
}

/**
 * Retrieves authentication token from BSApp, cookie, or localStorage.
 */
function getAuthToken() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getStoredToken === 'function') {
        const token = BSApp.getStoredToken();
        if (token) return token;
    }
    const match = document.cookie.match(/(?:^|;\s*)bs_auth_token=([^;]+)/);
    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }
    return localStorage.getItem('bs_token') || '';
}

/**
 * Animates a numeric element from current value to target value.
 */
function animateCounter(element, targetValue, duration = 600) {
    if (!element) return;
    const target = parseInt(targetValue, 10) || 0;
    if (target === 0) {
        element.innerText = '0';
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        element.innerText = Math.floor(progress * target).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.innerText = target.toLocaleString();
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Fetches all metrics (Customer Analytics and Workforce/Employee data).
 * @param {boolean} isManualRefresh
 */
async function loadAllDashboardMetrics(isManualRefresh = false) {
    const refreshIcon = document.getElementById('refresh-icon');
    if (isManualRefresh && refreshIcon) {
        refreshIcon.classList.add('spin-animation');
    }

    try {
        await Promise.allSettled([
            fetchCustomerMetrics(),
            fetchEmployeeMetrics()
        ]);
    } finally {
        if (refreshIcon) {
            setTimeout(() => {
                refreshIcon.classList.remove('spin-animation');
            }, 400);
        }
    }
}

/**
 * Fetches TotalSpecialCustomerCount and TotalRegularCustomerCount from Dashboard API
 * and updates customer analytics cards and distribution bars.
 */
async function fetchCustomerMetrics() {
    const baseUrl = getApiBaseUrl();
    const token = getAuthToken();

    const headers = { 'Accept': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const specialEndpoint = `${baseUrl}/Dashboard/TotalSpecialCustomerCount`;
    const regularEndpoint = `${baseUrl}/Dashboard/TotalRegularCustomerCount`;

    let specialCount = null;
    let regularCount = null;

    // 1. Fetch Special Customers Count
    try {
        const resSpecial = await fetch(specialEndpoint, { headers });
        if (resSpecial.ok) {
            const data = await resSpecial.json();
            if (data && data.succeeded) {
                if (typeof data.data === 'number') {
                    specialCount = data.data;
                } else if (data.data && typeof data.data.totalCount === 'number') {
                    specialCount = data.data.totalCount;
                }
            }
        }
    } catch (err) {
        console.warn('Could not fetch Special Customer count:', err);
    }

    // 2. Fetch Regular Customers Count
    try {
        const resRegular = await fetch(regularEndpoint, { headers });
        if (resRegular.ok) {
            const data = await resRegular.json();
            if (data && data.succeeded) {
                if (typeof data.data === 'number') {
                    regularCount = data.data;
                } else if (data.data && typeof data.data.totalCount === 'number') {
                    regularCount = data.data.totalCount;
                }
            }
        }
    } catch (err) {
        console.warn('Could not fetch Regular Customer count:', err);
    }

    // Default fallbacks if backend is unreachable
    const resolvedSpecial = specialCount !== null ? specialCount : 0;
    const resolvedRegular = regularCount !== null ? regularCount : 0;
    const totalCustomers = resolvedSpecial + resolvedRegular;

    // Update DOM Cards
    const specialEl = document.getElementById('metric-special-customers');
    const regularEl = document.getElementById('metric-regular-customers');
    const totalEl = document.getElementById('metric-total-customers');

    if (specialEl) animateCounter(specialEl, resolvedSpecial);
    if (regularEl) animateCounter(regularEl, resolvedRegular);
    if (totalEl) animateCounter(totalEl, totalCustomers);

    // Update Distribution Breakdown
    updateCustomerDistribution(resolvedRegular, resolvedSpecial, totalCustomers);
}

/**
 * Updates the visual customer portfolio distribution progress bar and labels.
 */
function updateCustomerDistribution(regularCount, specialCount, totalCustomers) {
    let regularPct = 0;
    let specialPct = 0;

    if (totalCustomers > 0) {
        specialPct = Math.round((specialCount / totalCustomers) * 100);
        regularPct = 100 - specialPct;
    }

    // Update Progress Bars
    const barRegular = document.getElementById('bar-regular');
    const barSpecial = document.getElementById('bar-special');

    if (barRegular) {
        barRegular.style.width = `${regularPct}%`;
        barRegular.setAttribute('aria-valuenow', regularPct);
    }
    if (barSpecial) {
        barSpecial.style.width = `${specialPct}%`;
        barSpecial.setAttribute('aria-valuenow', specialPct);
    }

    // Update Header Labels
    const labelRegPct = document.getElementById('label-reg-pct');
    const labelSpecialPct = document.getElementById('label-special-pct');

    if (labelRegPct) labelRegPct.innerText = `${regularPct}% (${regularCount})`;
    if (labelSpecialPct) labelSpecialPct.innerText = `${specialPct}% (${specialCount})`;

    // Update Summary Row Ratios
    const statSpecialRatio = document.getElementById('stat-special-ratio');
    const statRegularRatio = document.getElementById('stat-regular-ratio');

    if (statSpecialRatio) statSpecialRatio.innerText = `${specialPct}%`;
    if (statRegularRatio) statRegularRatio.innerText = `${regularPct}%`;
}

/**
 * Fetches employee count metrics from API and updates workforce metric cards.
 */
async function fetchEmployeeMetrics() {
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/Employees/GetAll?pageNumber=1&pageSize=1`;

    const headers = { 'Accept': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(endpoint, { headers });
        if (response.ok) {
            const res = await response.json();
            if (res.succeeded && res.data && typeof res.data.totalCount === 'number') {
                const totalEmpEl = document.getElementById('metric-total-emp');
                if (totalEmpEl) {
                    animateCounter(totalEmpEl, res.data.totalCount);
                }
            }
        }
    } catch (e) {
        // Keeps fallback count if live backend is offline
    }
}
