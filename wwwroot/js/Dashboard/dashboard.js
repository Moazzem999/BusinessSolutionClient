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
 * Animates a numeric integer element from current value to target value.
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
 * Animates a currency/decimal element to target value with 2 decimal places.
 */
function animateCurrency(element, targetValue, duration = 600) {
    if (!element) return;
    const target = parseFloat(targetValue) || 0;
    if (target === 0) {
        element.innerText = '0.00';
        return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = progress * target;
        element.innerText = current.toLocaleString('en-BD', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.innerText = target.toLocaleString('en-BD', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Fetches all metrics across Today's Performance and Customer Analytics.
 * @param {boolean} isManualRefresh
 */
async function loadAllDashboardMetrics(isManualRefresh = false) {
    const refreshIcon = document.getElementById('refresh-icon');
    if (isManualRefresh && refreshIcon) {
        refreshIcon.classList.add('spin-animation');
    }

    try {
        await Promise.allSettled([
            fetchTodayMetrics(),
            fetchCustomerMetrics()
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
 * Fetches TotalSalesToday and TotalPaymentReceivedToday from Dashboard API.
 */
async function fetchTodayMetrics() {
    const baseUrl = getApiBaseUrl();
    const token = getAuthToken();

    const headers = { 'Accept': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const salesEndpoint = `${baseUrl}/Dashboard/TotalSalesToday`;
    const paymentEndpoint = `${baseUrl}/Dashboard/TotalPaymentReceivedToday`;

    let totalSales = null;
    let totalPayment = null;

    // 1. Fetch Total Sales Today
    try {
        const resSales = await fetch(salesEndpoint, { headers });
        if (resSales.ok) {
            const data = await resSales.json();
            if (data && data.succeeded) {
                if (typeof data.data === 'number') {
                    totalSales = data.data;
                } else if (data.data && typeof data.data.totalAmount === 'number') {
                    totalSales = data.data.totalAmount;
                }
            }
        }
    } catch (err) {
        console.warn('Could not fetch Total Sales Today:', err);
    }

    // 2. Fetch Total Payment Received Today
    try {
        const resPayment = await fetch(paymentEndpoint, { headers });
        if (resPayment.ok) {
            const data = await resPayment.json();
            if (data && data.succeeded) {
                if (typeof data.data === 'number') {
                    totalPayment = data.data;
                } else if (data.data && typeof data.data.totalAmount === 'number') {
                    totalPayment = data.data.totalAmount;
                }
            }
        }
    } catch (err) {
        console.warn('Could not fetch Total Payment Received Today:', err);
    }

    // Update Sales & Payment Elements
    const salesEl = document.getElementById('metric-sales-today');
    const paymentEl = document.getElementById('metric-payment-today');

    if (salesEl) animateCurrency(salesEl, totalSales !== null ? totalSales : 0);
    if (paymentEl) animateCurrency(paymentEl, totalPayment !== null ? totalPayment : 0);
}

/**
 * Fetches TotalSpecialCustomerCount and TotalRegularCustomerCount from Dashboard API
 * and updates customer analytics cards.
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
}
