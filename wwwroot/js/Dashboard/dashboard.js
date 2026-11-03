/* ==========================================================================
   Business Solution Client - Dashboard Page JavaScript
   ========================================================================== */

let monthlyChartInstance = null;
let currentChartType = 'bar';
let cachedDayWiseData = [];

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

    // Chart & Table view toggle handlers
    const btnBar = document.getElementById('btn-chart-bar');
    const btnLine = document.getElementById('btn-chart-line');
    const btnTable = document.getElementById('btn-view-table');

    if (btnBar) {
        btnBar.addEventListener('click', () => switchViewMode('bar'));
    }
    if (btnLine) {
        btnLine.addEventListener('click', () => switchViewMode('line'));
    }
    if (btnTable) {
        btnTable.addEventListener('click', () => switchViewMode('table'));
    }

    loadAllDashboardMetrics();
}

/**
 * Switches between Bar chart, Line chart, and Table view.
 * @param {'bar'|'line'|'table'} mode
 */
function switchViewMode(mode) {
    const btnBar = document.getElementById('btn-chart-bar');
    const btnLine = document.getElementById('btn-chart-line');
    const btnTable = document.getElementById('btn-view-table');
    const chartContainer = document.getElementById('chart-view-container');
    const tableContainer = document.getElementById('table-view-container');

    [btnBar, btnLine, btnTable].forEach(btn => btn && btn.classList.remove('active'));

    if (mode === 'table') {
        if (btnTable) btnTable.classList.add('active');
        if (chartContainer) chartContainer.classList.add('d-none');
        if (tableContainer) tableContainer.classList.remove('d-none');
    } else {
        currentChartType = mode;
        if (mode === 'bar' && btnBar) btnBar.classList.add('active');
        if (mode === 'line' && btnLine) btnLine.classList.add('active');
        if (tableContainer) tableContainer.classList.add('d-none');
        if (chartContainer) chartContainer.classList.remove('d-none');
        renderMonthlyChart();
    }
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
 * Formats a number to currency with 2 decimal places and Bangladeshi grouping.
 */
function formatCurrencyString(val) {
    return Number(val || 0).toLocaleString('en-BD', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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
 * Fetches all metrics across Today's Performance, Monthly Trends, and Customer Analytics.
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
            fetchMonthlyMetrics(),
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
 * Fetches TotalSalesThisMonth and TotalPaymentReceivedThisMonth from Dashboard API,
 * updates month metric cards, and prepares daily trends chart & table.
 */
async function fetchMonthlyMetrics() {
    const baseUrl = getApiBaseUrl();
    const token = getAuthToken();

    const headers = { 'Accept': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const monthSalesEndpoint = `${baseUrl}/Dashboard/TotalSalesThisMonth`;
    const monthPaymentEndpoint = `${baseUrl}/Dashboard/TotalPaymentReceivedThisMonth`;

    let salesList = [];
    let paymentList = [];

    // 1. Fetch Day-wise Sales This Month
    try {
        const resSales = await fetch(monthSalesEndpoint, { headers });
        if (resSales.ok) {
            const data = await resSales.json();
            if (data && data.succeeded && Array.isArray(data.data)) {
                salesList = data.data;
            }
        }
    } catch (err) {
        console.warn('Could not fetch TotalSalesThisMonth:', err);
    }

    // 2. Fetch Day-wise Payments Received This Month
    try {
        const resPayment = await fetch(monthPaymentEndpoint, { headers });
        if (resPayment.ok) {
            const data = await resPayment.json();
            if (data && data.succeeded && Array.isArray(data.data)) {
                paymentList = data.data;
            }
        }
    } catch (err) {
        console.warn('Could not fetch TotalPaymentReceivedThisMonth:', err);
    }

    // Calculate Totals for the entire month
    const totalSalesMonth = salesList.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);
    const totalPaymentMonth = paymentList.reduce((acc, item) => acc + (parseFloat(item.total) || 0), 0);

    // Update Month Metric Cards
    const salesMonthEl = document.getElementById('metric-sales-month');
    const paymentMonthEl = document.getElementById('metric-payment-month');
    if (salesMonthEl) animateCurrency(salesMonthEl, totalSalesMonth);
    if (paymentMonthEl) animateCurrency(paymentMonthEl, totalPaymentMonth);

    // Update Trend Badges
    const badgeSales = document.getElementById('badge-month-sales');
    const badgePayment = document.getElementById('badge-month-payment');
    if (badgeSales) badgeSales.innerText = `৳ ${formatCurrencyString(totalSalesMonth)}`;
    if (badgePayment) badgePayment.innerText = `৳ ${formatCurrencyString(totalPaymentMonth)}`;

    // Build Unified Day-wise List
    const dayMap = new Map();

    salesList.forEach(item => {
        if (!dayMap.has(item.day)) {
            dayMap.set(item.day, { day: item.day, sales: 0, payments: 0 });
        }
        dayMap.get(item.day).sales = parseFloat(item.total) || 0;
    });

    paymentList.forEach(item => {
        if (!dayMap.has(item.day)) {
            dayMap.set(item.day, { day: item.day, sales: 0, payments: 0 });
        }
        dayMap.get(item.day).payments = parseFloat(item.total) || 0;
    });

    cachedDayWiseData = Array.from(dayMap.values()).map(x => ({
        ...x,
        net: x.payments - x.sales
    }));

    // Render Chart and Table
    renderMonthlyChart();
    renderDayWiseTable();
}

/**
 * Renders or updates the Monthly Trends Chart using Chart.js.
 */
function renderMonthlyChart() {
    const canvas = document.getElementById('monthlyTrendsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = cachedDayWiseData.map(item => item.day);
    const salesData = cachedDayWiseData.map(item => item.sales);
    const paymentData = cachedDayWiseData.map(item => item.payments);

    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
        monthlyChartInstance = null;
    }

    const ctx = canvas.getContext('2d');

    const datasets = [
        {
            label: 'Sales',
            data: salesData,
            borderColor: '#2563eb',
            backgroundColor: currentChartType === 'bar' ? 'rgba(37, 99, 235, 0.75)' : 'rgba(37, 99, 235, 0.12)',
            fill: currentChartType === 'line',
            tension: 0.35,
            borderWidth: 2.5,
            borderRadius: 6,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4,
            pointHoverRadius: 6
        },
        {
            label: 'Payment Received',
            data: paymentData,
            borderColor: '#16a34a',
            backgroundColor: currentChartType === 'bar' ? 'rgba(22, 163, 74, 0.75)' : 'rgba(22, 163, 74, 0.12)',
            fill: currentChartType === 'line',
            tension: 0.35,
            borderWidth: 2.5,
            borderRadius: 6,
            pointBackgroundColor: '#16a34a',
            pointRadius: 4,
            pointHoverRadius: 6
        }
    ];

    monthlyChartInstance = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            weight: 600,
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        family: "'Plus Jakarta Sans', sans-serif",
                        size: 13,
                        weight: 700
                    },
                    bodyFont: {
                        family: "'Plus Jakarta Sans', sans-serif",
                        size: 12
                    },
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += `৳ ${formatCurrencyString(context.parsed.y)}`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)'
                    },
                    ticks: {
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            size: 11
                        },
                        callback: function (value) {
                            return `৳ ${Number(value).toLocaleString('en-BD')}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the day-wise breakdown table for the current month.
 */
function renderDayWiseTable() {
    const tbody = document.getElementById('month-data-table-body');
    if (!tbody) return;

    if (!cachedDayWiseData || cachedDayWiseData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-4 d-block mb-1"></i> No day-wise records recorded for this month.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    cachedDayWiseData.forEach(item => {
        const netColor = item.net >= 0 ? 'text-success' : 'text-danger';
        const netPrefix = item.net > 0 ? '+' : '';
        html += `
            <tr>
                <td class="ps-3 fw-semibold text-dark">
                    <i class="bi bi-calendar2-day text-muted me-2"></i>${item.day}
                </td>
                <td class="text-end fw-semibold text-primary">
                    ৳ ${formatCurrencyString(item.sales)}
                </td>
                <td class="text-end fw-semibold text-success">
                    ৳ ${formatCurrencyString(item.payments)}
                </td>
                <td class="text-end pe-3 fw-bold ${netColor}">
                    ${netPrefix}৳ ${formatCurrencyString(item.net)}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
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
