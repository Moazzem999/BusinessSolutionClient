/* ==========================================================================
   Business Solution Client - Customer Transaction Log JavaScript
   Handles listing, filtering, pagination, modal preview, printing,
   and exports (PDF / Excel) for Customer Transaction Histories.
   API: GET /api/CustomerTransactionHistories/GetAll
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let fromDate = '';
let toDate = '';
let customerIdFilter = '';
let customerOrderIdFilter = '';
let customerPaymentIdFilter = '';
let totalCount = 0;
let totalPages = 1;
let transactionsList = [];
let currentSelectedTransaction = null;
let currentSelectedOrder = null;
let currentSelectedPayment = null;
let orderDetailsModalInstance = null;
let paymentDetailsModalInstance = null;
let searchDebounceTimer = null;

// Sample fallback customer order matching GET /api/CustomerOrders/GetById/{id}
const SAMPLE_CUSTOMER_ORDER = {
    id: 5,
    customerId: 6,
    customerName: "Liton Mia",
    customerShopName: "Liton Garments",
    customerMobile: "01712345678",
    orderNo: "CO-2026-0000005",
    orderDate: "2026-11-02T00:00:00",
    totalAmount: 5000,
    notes: "Regular order shipment",
    customerPreviousBalance: 41000,
    customerNewBalance: 46000,
    isSpecial: true,
    orderDetails: [
        {
            id: 1,
            customerOrderId: 5,
            productId: 1,
            productName: "Jacket",
            remarks: "Black winter edition",
            quantity: 2,
            unitPrice: 2500,
            lineTotal: 5000
        }
    ],
    createdOn: "2026-11-02T18:15:11.0388549",
    updatedOn: "2026-11-02T18:15:11.0388559",
    createdBy: 1,
    updatedBy: 1,
    status: 1
};

// Sample fallback customer payment matching GET /api/CustomerPayments/GetById/{id}
const SAMPLE_CUSTOMER_PAYMENT = {
    id: 3,
    customerId: 6,
    customerName: "Liton Mia",
    customerShopName: "Liton Garments",
    customerMobile: "01712345678",
    transactionNo: "20261102-d229f62b1e",
    paymentDate: "2026-11-02T00:00:00",
    amount: 5000,
    paymentMethod: "Bank Transfer",
    notes: "Invoice settlement payment",
    customerPreviousBalance: 46000,
    customerNewBalance: 41000,
    createdOn: "2026-11-02T18:15:11.0388549",
    updatedOn: "2026-11-02T18:15:11.0388559",
    createdBy: 1,
    updatedBy: 1,
    status: 1
};

// Sample Fallback Data matching the backend response schema provided by user
const SAMPLE_TRANSACTION_HISTORIES = [
    {
        id: 8,
        customerId: 6,
        customerName: "Liton Mia",
        customerShopName: "Liton Garments",
        customerOrderId: 5,
        customerOrderNo: "CO-2026-0000005",
        customerPaymentId: null,
        transactionNo: "20261102-d229f62b1e",
        transactionDate: "2026-11-02T00:00:00",
        amount: 5000,
        payment: 0,
        customerPreviousBalance: 41000,
        customerNewBalance: 46000,
        isSpecial: true,
        createdOn: "2026-11-02T18:15:11.0388549",
        updatedOn: "2026-11-02T18:15:11.0388559",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 7,
        customerId: 5,
        customerName: "Samsul Haque",
        customerShopName: "Samsu Fashion",
        customerOrderId: null,
        customerOrderNo: null,
        customerPaymentId: 3,
        transactionNo: "20261101-a1b2c3d4e5",
        transactionDate: "2026-11-01T14:30:00",
        amount: 0,
        payment: 15000,
        customerPreviousBalance: 65000,
        customerNewBalance: 50000,
        isSpecial: true,
        createdOn: "2026-11-01T14:30:00",
        updatedOn: "2026-11-01T14:30:00",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 6,
        customerId: 6,
        customerName: "Liton Mia",
        customerShopName: "Liton Garments",
        customerOrderId: 4,
        customerOrderNo: "CO-2026-0000004",
        customerPaymentId: null,
        transactionNo: "20261030-f8e7d6c5b4",
        transactionDate: "2026-10-30T11:15:00",
        amount: 10000,
        payment: 0,
        customerPreviousBalance: 31000,
        customerNewBalance: 41000,
        isSpecial: true,
        createdOn: "2026-10-30T11:15:00",
        updatedOn: "2026-10-30T11:15:00",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 5,
        customerId: 4,
        customerName: "Jamil Khan",
        customerShopName: "",
        customerOrderId: null,
        customerOrderNo: null,
        customerPaymentId: 2,
        transactionNo: "20261028-1234567890",
        transactionDate: "2026-10-28T09:00:00",
        amount: 0,
        payment: 5000,
        customerPreviousBalance: 20000,
        customerNewBalance: 15000,
        isSpecial: false,
        createdOn: "2026-10-28T09:00:00",
        updatedOn: "2026-10-28T09:00:00",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 4,
        customerId: 3,
        customerName: "Arif Hossain",
        customerShopName: "",
        customerOrderId: 2,
        customerOrderNo: "CO-2026-0000002",
        customerPaymentId: null,
        transactionNo: "20261025-9876543210",
        transactionDate: "2026-10-25T16:20:00",
        amount: 3500,
        payment: 0,
        customerPreviousBalance: 0,
        customerNewBalance: 3500,
        isSpecial: false,
        createdOn: "2026-10-25T16:20:00",
        updatedOn: "2026-10-25T16:20:00",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

// Helper: Get Base URL for API
function getApiBaseUrl() {
    return (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : 'https://localhost:7148/api';
}

// Helper: Get Authorization Token
function getAuthToken() {
    let token = localStorage.getItem('bs_token');
    if (!token) {
        const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
        if (match) token = decodeURIComponent(match[2]);
    }
    return token;
}

// Helper: HTML Escaping
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Currency Formatter
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Helper: Date Formatter (e.g. Nov 2, 2026)
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (_) {
        return dateStr;
    }
}

// Helper: DateTime Formatter
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (_) {
        return dateStr;
    }
}

// Show Toast Message
function showToast(message, type = 'primary') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toastEl || !toastMsg) return;

    toastEl.className = `toast align-items-center text-white border-0 rounded-3 shadow-lg bg-${type}`;
    if (toastIcon) {
        toastIcon.className = type === 'success' ? 'bi bi-check-circle-fill fs-5' :
                              type === 'danger' ? 'bi bi-exclamation-triangle-fill fs-5' :
                              type === 'warning' ? 'bi bi-exclamation-circle-fill fs-5' :
                              'bi bi-info-circle-fill fs-5';
    }
    toastMsg.textContent = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
        toast.show();
    }
}

// Copy to Clipboard
window.copyToClipboard = function(text, label = 'Text') {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied to clipboard!`, 'success');
    }).catch(() => {
        showToast(`Failed to copy ${label}.`, 'danger');
    });
};

/**
 * Reads any query parameters passed via URL (e.g., ?SearchTerm=...&CustomerId=...&FromDate=...&ToDate=...)
 */
function parseUrlParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('CustomerId')) customerIdFilter = urlParams.get('CustomerId') || '';
        else if (urlParams.has('customerId')) customerIdFilter = urlParams.get('customerId') || '';

        if (urlParams.has('CustomerOrderId')) customerOrderIdFilter = urlParams.get('CustomerOrderId') || '';
        else if (urlParams.has('customerOrderId')) customerOrderIdFilter = urlParams.get('customerOrderId') || '';

        if (urlParams.has('CustomerPaymentId')) customerPaymentIdFilter = urlParams.get('CustomerPaymentId') || '';
        else if (urlParams.has('customerPaymentId')) customerPaymentIdFilter = urlParams.get('customerPaymentId') || '';

        if (urlParams.has('SearchTerm')) searchTerm = urlParams.get('SearchTerm') || '';
        else if (urlParams.has('searchTerm')) searchTerm = urlParams.get('searchTerm') || '';

        if (urlParams.has('FromDate')) fromDate = urlParams.get('FromDate') || '';
        else if (urlParams.has('fromDate')) fromDate = urlParams.get('fromDate') || '';

        if (urlParams.has('ToDate')) toDate = urlParams.get('ToDate') || '';
        else if (urlParams.has('toDate')) toDate = urlParams.get('toDate') || '';

        if (urlParams.has('PageNumber')) currentPage = parseInt(urlParams.get('PageNumber'), 10) || 1;
        if (urlParams.has('PageSize')) pageSize = parseInt(urlParams.get('PageSize'), 10) || 10;

        // Sync inputs with parsed params
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchTerm) searchInput.value = searchTerm;

        const fromDateInput = document.getElementById('from-date-input');
        if (fromDateInput && fromDate) fromDateInput.value = fromDate;

        const toDateInput = document.getElementById('to-date-input');
        if (toDateInput && toDate) toDateInput.value = toDate;

        const pageSizeSelect = document.getElementById('page-size-select');
        if (pageSizeSelect && pageSize) pageSizeSelect.value = pageSize.toString();

    } catch (e) {
        console.warn('Could not parse URL query parameters:', e);
    }
}

/**
 * Collects current filter inputs and triggers reload without needing to click Apply Filter button
 */
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');

    searchTerm = searchInput ? searchInput.value.trim() : '';
    fromDate = fromDateInput ? fromDateInput.value.trim() : '';
    toDate = toDateInput ? toDateInput.value.trim() : '';

    currentPage = 1;

    // Keep URL in sync without reload
    if (window.history && window.history.replaceState) {
        const url = new URL(window.location);
        if (searchTerm) url.searchParams.set('SearchTerm', searchTerm);
        else url.searchParams.delete('SearchTerm');

        if (fromDate) url.searchParams.set('FromDate', fromDate);
        else url.searchParams.delete('FromDate');

        if (toDate) url.searchParams.set('ToDate', toDate);
        else url.searchParams.delete('ToDate');

        window.history.replaceState({}, document.title, url.pathname + url.search);
    }

    loadTransactionHistories();
}

/* ==========================================================================
   Page Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', initCustomerTransactionLogPage);

function initCustomerTransactionLogPage() {
    const filterForm = document.getElementById('transaction-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const btnReset = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const btnRetryApi = document.getElementById('btn-retry-api');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');

    // Parse URL parameters on load
    parseUrlParameters();

    // Debounced search typing (auto-filters as user types)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
            }, 400);
        });
    }

    // Filter Form Submit
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    // Auto-apply filters when dates change (no need to click Apply Filter)
    if (fromDateInput) {
        fromDateInput.addEventListener('change', () => {
            applyFilters();
        });
        fromDateInput.addEventListener('input', () => {
            applyFilters();
        });
    }
    if (toDateInput) {
        toDateInput.addEventListener('change', () => {
            applyFilters();
        });
        toDateInput.addEventListener('input', () => {
            applyFilters();
        });
    }

    // Reset Filters
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            searchTerm = '';
            fromDate = '';
            toDate = '';
            customerIdFilter = '';
            customerOrderIdFilter = '';
            customerPaymentIdFilter = '';
            currentPage = 1;

            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }

            loadTransactionHistories();
        });
    }

    // Rows per page change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadTransactionHistories();
        });
    }

    // Retry API button
    if (btnRetryApi) {
        btnRetryApi.addEventListener('click', () => {
            const apiErrorAlert = document.getElementById('api-error-alert');
            if (apiErrorAlert) apiErrorAlert.classList.add('d-none');
            loadTransactionHistories();
        });
    }

    // Export PDF
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportToPdf);
    }

    // Export Excel
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }

    // Initial Load
    loadTransactionHistories();
}

/* ==========================================================================
   Data Fetching & Table Rendering
   ========================================================================== */
async function loadTransactionHistories() {
    const tableBody = document.getElementById('transactions-table-body');
    const loadingRow = document.getElementById('transactions-loading-row');
    const emptyState = document.getElementById('transactions-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (loadingRow) loadingRow.classList.remove('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    if (apiErrorAlert) apiErrorAlert.classList.add('d-none');

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

    const queryParams = new URLSearchParams();
    if (searchTerm && searchTerm.trim() !== '') {
        queryParams.append('SearchTerm', searchTerm.trim());
    }
    if (customerIdFilter) {
        queryParams.append('CustomerId', customerIdFilter.toString());
    }
    if (customerOrderIdFilter) {
        queryParams.append('CustomerOrderId', customerOrderIdFilter.toString());
    }
    if (customerPaymentIdFilter) {
        queryParams.append('CustomerPaymentId', customerPaymentIdFilter.toString());
    }
    if (fromDate && fromDate.trim() !== '') {
        queryParams.append('FromDate', fromDate.trim());
    }
    if (toDate && toDate.trim() !== '') {
        queryParams.append('ToDate', toDate.trim());
    }
    if (currentPage) {
        queryParams.append('PageNumber', currentPage.toString());
    }
    if (pageSize) {
        queryParams.append('PageSize', pageSize.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString 
        ? `${baseUrl}/CustomerTransactionHistories/GetAll?${queryString}` 
        : `${baseUrl}/CustomerTransactionHistories/GetAll`;

    try {
        console.log('Fetching Customer Transaction Histories from:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        if (response.status === 401) {
            throw new Error('Unauthorized (401). Please sign in to fetch live database records.');
        }

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status} (${response.statusText || 'Error'})`);
        }

        const resData = await response.json();
        console.log('Customer Transaction Histories API Response:', resData);

        let items = [];
        if (resData && resData.succeeded && resData.data) {
            items = resData.data.items || [];
            totalCount = resData.data.totalCount || items.length;
            totalPages = resData.data.totalPages || Math.ceil(totalCount / pageSize) || 1;
        } else if (Array.isArray(resData)) {
            items = resData;
            totalCount = items.length;
            totalPages = Math.ceil(totalCount / pageSize) || 1;
        } else if (resData.items) {
            items = resData.items;
            totalCount = resData.totalCount || items.length;
            totalPages = resData.totalPages || Math.ceil(totalCount / pageSize) || 1;
        }

        transactionsList = items;
        renderTransactionsTable(transactionsList);
        renderPaginationInfo(transactionsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();

    } catch (error) {
        console.warn('Customer Transaction Histories API error, falling back to sample data:', error.message);

        if (apiErrorAlert && apiErrorMsg) {
            apiErrorMsg.textContent = `Unable to connect to live API (${error.message}). Displaying cached sample transactions.`;
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }

        // Filter sample data based on current inputs
        let filteredSample = SAMPLE_TRANSACTION_HISTORIES.filter(item => {
            let match = true;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const cName = (item.customerName || '').toLowerCase();
                const shop = (item.customerShopName || '').toLowerCase();
                const co = (item.customerOrderNo || '').toLowerCase();
                const tx = (item.transactionNo || '').toLowerCase();
                if (!cName.includes(term) && !shop.includes(term) && !co.includes(term) && !tx.includes(term)) {
                    match = false;
                }
            }
            if (fromDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').split('T')[0];
                if (itemDate && itemDate < fromDate) match = false;
            }
            if (toDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').split('T')[0];
                if (itemDate && itemDate > toDate) match = false;
            }
            return match;
        });

        transactionsList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderTransactionsTable(transactionsList);
        renderPaginationInfo(transactionsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();
    }
}

/**
 * Renders transaction rows into the table body
 */
function renderTransactionsTable(items) {
    const tableBody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('transactions-empty-state');
    if (!tableBody) return;

    if (!items || items.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    let html = '';
    items.forEach((item, index) => {
        const id = item.id || 0;
        const transNo = item.transactionNo || '—';
        const dateFormatted = formatDate(item.transactionDate || item.createdOn);
        const customerName = item.customerName || 'N/A';
        const shopName = item.customerShopName || '';
        const orderNo = item.customerOrderNo || (item.customerOrderId ? `CO-${item.customerOrderId}` : null);
        const amount = Number(item.amount || 0);
        const payment = Number(item.payment || 0);
        const prevBal = Number(item.customerPreviousBalance !== undefined ? item.customerPreviousBalance : (item.previousBalance || 0));
        const newBal = Number(item.customerNewBalance !== undefined ? item.customerNewBalance : (item.newBalance || 0));
        const paymentId = item.customerPaymentId || item.CustomerPaymentId || item.paymentId || (payment > 0 ? id : null);
        const isSpecial = item.isSpecial === true || item.IsSpecial === true || item.isSpecial === 'true';

        // Balance direction styling
        const balanceIncreased = newBal > prevBal;
        const balanceDecreased = newBal < prevBal;
        const balColorClass = balanceIncreased ? 'text-primary' : (balanceDecreased ? 'text-success' : 'text-dark');

        html += `
            <tr class="transaction-row" data-id="${id}">
                <!-- Date -->
                <td class="ps-4">
                    <span class="fw-semibold text-dark">${dateFormatted}</span>
                </td>

                <!-- Transaction Ref -->
                <td>
                    <div class="d-inline-flex align-items-center gap-1">
                        <span class="badge bg-light text-dark border font-monospace px-2 py-1 transaction-ref-badge" role="button" onclick="copyToClipboard('${escapeHtml(transNo)}', 'Transaction No')" title="Click to copy">
                            ${escapeHtml(transNo)}
                        </span>
                        <button type="button" class="btn btn-link btn-sm p-0 text-muted" onclick="copyToClipboard('${escapeHtml(transNo)}', 'Transaction No')" title="Copy Reference">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </td>

                <!-- Customer Info -->
                <td style="max-width: 220px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="avatar-circle-sm bg-light text-primary border rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width: 34px; height: 34px; min-width: 34px; font-size: 0.8rem;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div class="text-truncate">
                            <div class="d-flex align-items-center gap-1.5 mb-0 text-truncate">
                                <span class="fw-semibold text-dark text-truncate" title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</span>
                                ${isSpecial ? `
                                    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0 flex-shrink-0" data-bs-toggle="tooltip" data-bs-placement="top" title="Special Customer" style="font-size: 0.72rem; cursor: help;">
                                        <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.65rem;"></i>Special
                                    </span>
                                ` : ''}
                            </div>
                            ${shopName ? `
                                <div class="text-muted small d-flex align-items-center gap-1 text-truncate" title="${escapeHtml(shopName)}">
                                    <i class="bi bi-shop small"></i> ${escapeHtml(shopName)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </td>

                <!-- Order Reference -->
                <td>
                    ${orderNo ? `
                        <button type="button" class="btn-order-details" 
                            data-order-id="${item.customerOrderId || ''}" 
                            data-order-no="${escapeHtml(orderNo)}"
                            title="Click to view details of ${escapeHtml(orderNo)}">${escapeHtml(orderNo)}</button>
                    ` : `
                        <button type="button" class="btn-payment-details" 
                            data-payment-id="${paymentId || ''}" 
                            data-trans-no="${escapeHtml(transNo)}"
                            data-index="${index}"
                            title="Click to view payment voucher of ${escapeHtml(transNo)}">Payment</button>
                    `}
                </td>

                <!-- Bill Amount (Debit) -->
                <td class="text-end">
                    ${amount > 0 ? `
                        <span class="fw-bold text-dark font-monospace">${formatCurrency(amount)}</span>
                    ` : `
                        <span class="text-muted font-monospace small">0.00</span>
                    `}
                </td>

                <!-- Payment (Credit) -->
                <td class="text-end">
                    ${payment > 0 ? `
                        <span class="fw-bold text-success font-monospace">${formatCurrency(payment)}</span>
                    ` : `
                        <span class="text-muted font-monospace small">0.00</span>
                    `}
                </td>

                <!-- Running Balance Flow -->
                <td class="pe-4 text-center">
                    <div class="balance-flow-box justify-content-center">
                        <span class="text-muted font-monospace small" title="Previous Balance">${formatCurrency(prevBal)}</span>
                        <i class="bi bi-arrow-right text-secondary small"></i>
                        <span class="fw-bold font-monospace ${balColorClass}" title="New Balance">${formatCurrency(newBal)}</span>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Attach click listeners to clickable Order No buttons
    tableBody.querySelectorAll('.btn-order-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const orderId = btn.getAttribute('data-order-id');
            const fallbackOrderNo = btn.getAttribute('data-order-no');
            openOrderDetailsModal(orderId, fallbackOrderNo);
        });
    });

    // Attach click listeners to clickable Payment buttons
    tableBody.querySelectorAll('.btn-payment-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const paymentId = btn.getAttribute('data-payment-id');
            const fallbackTransNo = btn.getAttribute('data-trans-no');
            const idx = btn.getAttribute('data-index');
            openPaymentDetailsModal(paymentId, fallbackTransNo, idx);
        });
    });

    // Initialize tooltips for special customer badges
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
    }
}

/**
 * Updates filter badges below the filter bar
 */
function updateActiveFilterBadges() {
    const container = document.getElementById('active-filter-badges');
    if (!container) return;

    let badgesHtml = '';
    if (searchTerm) {
        badgesHtml += `
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>Search: <strong>${escapeHtml(searchTerm)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('search')" title="Remove"></i>
            </span>
        `;
    }
    if (fromDate) {
        badgesHtml += `
            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>From: <strong>${formatDate(fromDate)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('from')" title="Remove"></i>
            </span>
        `;
    }
    if (toDate) {
        badgesHtml += `
            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>To: <strong>${formatDate(toDate)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('to')" title="Remove"></i>
            </span>
        `;
    }

    container.innerHTML = badgesHtml;
}

window.clearSpecificFilter = function(filterType) {
    if (filterType === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
    } else if (filterType === 'from') {
        const fromDateInput = document.getElementById('from-date-input');
        if (fromDateInput) fromDateInput.value = '';
    } else if (filterType === 'to') {
        const toDateInput = document.getElementById('to-date-input');
        if (toDateInput) toDateInput.value = '';
    }
    applyFilters();
};

/* ==========================================================================
   Order Details Modal & Preview
   ========================================================================== */
async function openOrderDetailsModal(orderId, fallbackOrderNo) {
    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    if (modalTitleNo) {
        modalTitleNo.innerText = fallbackOrderNo || (orderId ? `CO-${orderId}` : '—');
    }

    if (modalContent) {
        modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching order details for ${escapeHtml(fallbackOrderNo || `#${orderId}`)}...</div>
            </div>
        `;
    }

    if (orderDetailsModalInstance) {
        orderDetailsModalInstance.show();
    } else {
        const modalEl = document.getElementById('orderDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            orderDetailsModalInstance = new bootstrap.Modal(modalEl);
            orderDetailsModalInstance.show();
        }
    }

    if (!orderId) {
        currentSelectedOrder = SAMPLE_CUSTOMER_ORDER;
        renderOrderDetailsModal(SAMPLE_CUSTOMER_ORDER);
        return;
    }

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    const endpoint = `${baseUrl}/CustomerOrders/GetById/${encodeURIComponent(orderId)}`;

    try {
        console.log('Fetching Customer Order Details from:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status} (${response.statusText || 'Error'})`);
        }

        const result = await response.json();
        console.log('Customer Order Details API Response:', result);

        const orderData = result.data || result;
        if (!orderData) {
            throw new Error('No order data found in API response.');
        }

        currentSelectedOrder = orderData;
        renderOrderDetailsModal(orderData);

    } catch (err) {
        console.warn('Could not fetch customer order details from API, using fallback data:', err.message);
        const fallback = Object.assign({}, SAMPLE_CUSTOMER_ORDER, {
            id: orderId,
            orderNo: fallbackOrderNo || SAMPLE_CUSTOMER_ORDER.orderNo
        });
        currentSelectedOrder = fallback;
        renderOrderDetailsModal(fallback);
    }
}

/**
 * Renders Customer Order Details into modal
 */
function renderOrderDetailsModal(order) {
    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    if (!order || !modalContent) return;

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `CO-${orderId}`;
    const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
    const customerName = order.customerName || order.CustomerName || '—';
    const customerShopName = order.customerShopName || order.CustomerShopName || '';
    const customerId = order.customerId || order.CustomerId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.customerPreviousBalance !== undefined ? order.customerPreviousBalance : (order.CustomerPreviousBalance !== undefined ? order.CustomerPreviousBalance : 0);
    const newBalance = order.customerNewBalance !== undefined ? order.customerNewBalance : (order.CustomerNewBalance !== undefined ? order.CustomerNewBalance : (Number(prevBalance) + Number(totalAmount)));
    const notes = order.notes || order.Notes || '';
    const isSpecial = order.isSpecial === true || order.IsSpecial === true || order.isSpecial === 'true';
    const details = order.orderDetails || order.OrderDetails || [];

    if (modalTitleNo) {
        modalTitleNo.innerText = orderNo;
    }

    let itemsTableRows = '';
    let totalItemsQuantity = 0;
    let computedLineTotals = 0;

    if (Array.isArray(details) && details.length > 0) {
        details.forEach((item, idx) => {
            const productName = item.productName || item.ProductName || `Product #${item.productId || ''}`;
            const qty = item.quantity !== undefined ? item.quantity : (item.Quantity !== undefined ? item.Quantity : 0);
            const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.UnitPrice !== undefined ? item.UnitPrice : 0);
            const lineTotal = item.lineTotal !== undefined ? item.lineTotal : (item.LineTotal !== undefined ? item.LineTotal : (qty * unitPrice));
            const remarks = item.remarks || item.Remarks || '';

            totalItemsQuantity += Number(qty);
            computedLineTotals += Number(lineTotal);

            itemsTableRows += `
                <tr>
                    <td class="text-center text-muted small">${idx + 1}</td>
                    <td>
                        <span class="fw-semibold text-dark">${escapeHtml(productName)}</span>
                    </td>
                    <td class="text-muted small">${escapeHtml(remarks || '—')}</td>
                    <td class="text-center">
                        <span class="badge bg-light text-dark border px-2 py-1">${qty}</span>
                    </td>
                    <td class="text-end">৳ ${formatCurrency(unitPrice)}</td>
                    <td class="text-end fw-bold text-dark">৳ ${formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });
    } else {
        itemsTableRows = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-4 d-block mb-1"></i>
                    No product items found in this order.
                </td>
            </tr>
        `;
    }

    modalContent.innerHTML = `
        <!-- Order Meta Info Cards -->
        <div class="row g-3 mb-4">
            <!-- Customer Card -->
            <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-primary-subtle text-primary p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-person-fill fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Customer</h6>
                    </div>
                    <div class="fw-bold text-dark fs-6 d-flex align-items-center gap-2 mb-1">
                        <span>${escapeHtml(customerName)}</span>
                        ${isSpecial ? `
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0" data-bs-toggle="tooltip" data-bs-placement="top" title="Special Customer" style="font-size: 0.72rem; cursor: help;">
                                <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.65rem;"></i>Special
                            </span>
                        ` : ''}
                    </div>
                    ${customerShopName ? `<div class="text-muted small mb-1"><i class="bi bi-shop me-1"></i>${escapeHtml(customerShopName)}</div>` : ''}
                    <div class="text-muted small">Customer ID: <span class="fw-medium text-dark">#${escapeHtml(customerId)}</span></div>
                </div>
            </div>

            <!-- Financial Summary (Special Customers Only) -->
            ${isSpecial ? `
            <div class="col-12 col-md-4">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-success-subtle text-success p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-cash-stack fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Financial Summary</h6>
                    </div>
                    <div class="d-flex justify-content-between text-muted small py-1 border-bottom">
                        <span>Old Balance:</span>
                        <span class="fw-medium text-dark">৳ ${formatCurrency(prevBalance)}</span>
                    </div>
                    <div class="d-flex justify-content-between py-1 border-bottom">
                        <span class="fw-semibold text-dark">Order Total:</span>
                        <span class="fw-bold text-primary fs-6">৳ ${formatCurrency(totalAmount)}</span>
                    </div>
                    <div class="d-flex justify-content-between text-muted small py-1">
                        <span>New Balance:</span>
                        <span class="fw-bold text-success">৳ ${formatCurrency(newBalance)}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Meta & Notes -->
            <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-info-subtle text-info p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-info-circle fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Information</h6>
                    </div>
                    <div class="text-muted small mb-2">
                        Date: <span class="fw-medium text-dark">${escapeHtml(orderDateFormatted)}</span>
                    </div>
                    <div class="text-muted small">
                        <strong>Notes:</strong>
                        <div class="p-1 px-2 rounded bg-white border mt-1 text-dark text-break" style="font-size: 0.8rem; max-height: 60px; overflow-y: auto;">
                            ${escapeHtml(notes || 'None')}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Order Items Breakdown Table -->
        <h6 class="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
            <i class="bi bi-box-seam-fill text-primary"></i> Order Items (${details.length})
        </h6>
        <div class="table-responsive rounded-3 border mb-0">
            <table class="table table-hover align-middle mb-0">
                <thead class="bg-light">
                    <tr>
                        <th class="text-center text-secondary small fw-semibold text-uppercase" style="width: 45px;">#</th>
                        <th class="text-secondary small fw-semibold text-uppercase" style="min-width: 140px;">Product</th>
                        <th class="text-secondary small fw-semibold text-uppercase" style="min-width: 140px;">Remarks</th>
                        <th class="text-center text-secondary small fw-semibold text-uppercase" style="width: 90px;">Quantity</th>
                        <th class="text-end text-secondary small fw-semibold text-uppercase" style="width: 120px;">Unit Price</th>
                        <th class="text-end text-secondary small fw-semibold text-uppercase" style="width: 130px;">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRows}
                </tbody>
                <tfoot class="table-light fw-bold border-top">
                    <tr>
                        <td colspan="3" class="text-end text-dark">Total:</td>
                        <td class="text-center text-dark">${totalItemsQuantity}</td>
                        <td></td>
                        <td class="text-end text-primary fs-6">৳ ${formatCurrency(totalAmount || computedLineTotals)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

/* ==========================================================================
   Payment Details Voucher Modal
   ========================================================================== */
async function openPaymentDetailsModal(paymentId, fallbackTransNo, itemIndex) {
    const modalTitleNo = document.getElementById('modal-payment-trans-no');
    const modalContent = document.getElementById('modal-payment-details-content');

    if (modalTitleNo) {
        modalTitleNo.innerText = fallbackTransNo || (paymentId ? `#${paymentId}` : '—');
    }

    if (modalContent) {
        modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-success" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching payment voucher details for ${escapeHtml(fallbackTransNo || `#${paymentId}`)}...</div>
            </div>
        `;
    }

    if (paymentDetailsModalInstance) {
        paymentDetailsModalInstance.show();
    } else {
        const modalEl = document.getElementById('paymentDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            paymentDetailsModalInstance = new bootstrap.Modal(modalEl);
            paymentDetailsModalInstance.show();
        }
    }

    const fallbackItem = (transactionsList && itemIndex !== undefined) ? transactionsList[itemIndex] : null;
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    let paymentData = null;

    if (paymentId) {
        const endpoint = `${baseUrl}/CustomerPayments/GetById/${encodeURIComponent(paymentId)}`;
        try {
            console.log('Fetching Customer Payment Details from:', endpoint);
            const headers = { 'accept': '*/*' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: headers
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Customer Payment Details API Response:', result);
                paymentData = result.data || result;
            } else {
                console.warn(`Server returned ${response.status} when fetching payment ${paymentId}`);
            }
        } catch (err) {
            console.warn('Could not fetch customer payment details from API:', err.message);
        }
    }

    if (!paymentData && fallbackItem) {
        paymentData = {
            id: paymentId || fallbackItem.customerPaymentId || fallbackItem.id || 3,
            customerId: fallbackItem.customerId || 6,
            customerName: fallbackItem.customerName || 'Customer',
            customerShopName: fallbackItem.customerShopName || '',
            transactionNo: fallbackItem.transactionNo || fallbackTransNo,
            paymentDate: fallbackItem.transactionDate || fallbackItem.createdOn,
            amount: fallbackItem.payment || fallbackItem.amount || 0,
            paymentMethod: 'Cash / Transfer',
            notes: fallbackItem.remarks || fallbackItem.notes || 'Payment Received',
            customerPreviousBalance: fallbackItem.customerPreviousBalance || 0,
            customerNewBalance: fallbackItem.customerNewBalance || 0,
            isSpecial: fallbackItem.isSpecial
        };
    }

    if (!paymentData) {
        paymentData = Object.assign({}, SAMPLE_CUSTOMER_PAYMENT, {
            id: paymentId || 3,
            transactionNo: fallbackTransNo || SAMPLE_CUSTOMER_PAYMENT.transactionNo
        });
    }

    if (fallbackItem && (paymentData.isSpecial === undefined || paymentData.isSpecial === null)) {
        paymentData.isSpecial = fallbackItem.isSpecial;
    }

    currentSelectedPayment = paymentData;
    renderPaymentDetailsModal(paymentData);
}

/**
 * Renders Customer Payment Voucher details into modal
 */
function renderPaymentDetailsModal(payment) {
    const modalTitleNo = document.getElementById('modal-payment-trans-no');
    const modalContent = document.getElementById('modal-payment-details-content');

    if (!payment || !modalContent) return;

    const paymentId = payment.id || payment.Id || '—';
    const transNo = payment.transactionNo || payment.TransactionNo || '—';
    const customerName = payment.customerName || payment.CustomerName || '—';
    const shopName = payment.customerShopName || payment.CustomerShopName || '';
    const customerId = payment.customerId || payment.CustomerId || '—';
    const dateFormatted = formatDateTime(payment.paymentDate || payment.createdOn || payment.transactionDate);
    const paidAmount = Number(payment.amount !== undefined ? payment.amount : (payment.payment || 0));
    const prevBalance = Number(payment.customerPreviousBalance !== undefined ? payment.customerPreviousBalance : 0);
    const newBalance = Number(payment.customerNewBalance !== undefined ? payment.customerNewBalance : (prevBalance - paidAmount));
    const notes = payment.notes || payment.remarks || 'None';
    const paymentMethod = payment.paymentMethod || 'Cash / Bank Transfer';
    const isSpecial = payment.isSpecial === true || payment.IsSpecial === true || payment.isSpecial === 'true' || payment.IsSpecial === 'true' || payment.isSpecial === 1 || payment.IsSpecial === 1;

    if (modalTitleNo) {
        modalTitleNo.innerText = transNo;
    }

    modalContent.innerHTML = `
        <!-- Master Info Cards -->
        <div class="row g-3 mb-4">
            <!-- 1. Customer Card -->
            <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                <div class="p-3 bg-light rounded-4 h-100 border">
                    <div class="d-flex align-items-center gap-2 mb-2 text-primary">
                        <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-person-fill fs-6 text-primary"></i>
                        </div>
                        <span class="fw-semibold fs-6">Customer</span>
                    </div>
                    <div class="fw-bold text-dark mb-1 d-flex align-items-center gap-2 text-truncate">
                        <span class="text-truncate" title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</span>
                        ${isSpecial ? `
                            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0" style="font-size: 0.72rem;">
                                <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.65rem;"></i>Special
                            </span>
                        ` : ''}
                    </div>
                    ${shopName ? `
                        <div class="text-secondary small mb-1 text-truncate" title="${escapeHtml(shopName)}">
                            <i class="bi bi-shop me-1 text-secondary"></i>${escapeHtml(shopName)}
                        </div>
                    ` : ''}
                    <div class="text-muted small">
                        Customer ID: <span class="fw-bold text-dark">#${escapeHtml(customerId)}</span>
                    </div>
                </div>
            </div>

            <!-- 2. Financial Summary Card (Special Customers Only) -->
            ${isSpecial ? `
            <div class="col-12 col-md-4">
                <div class="p-3 bg-light rounded-4 h-100 border">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-success-subtle text-success p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-cash-stack fs-6 text-success"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Financial Summary</h6>
                    </div>
                    <div class="d-flex justify-content-between text-muted small mb-1">
                        <span>Old Balance:</span>
                        <span class="font-monospace text-dark">৳ ${formatCurrency(prevBalance)}</span>
                    </div>
                    <div class="d-flex justify-content-between fw-bold fs-6 mb-1 text-success">
                        <span>Received:</span>
                        <span class="font-monospace">৳ ${formatCurrency(paidAmount)}</span>
                    </div>
                    <div class="d-flex justify-content-between text-muted small pt-1">
                        <span>New Balance:</span>
                        <span class="font-monospace fw-bold text-dark">৳ ${formatCurrency(newBalance)}</span>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- 3. Information Card -->
            <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                <div class="p-3 bg-light rounded-4 h-100 border">
                    <div class="d-flex align-items-center gap-2 mb-2 text-info">
                        <div class="rounded-circle bg-info-subtle text-info d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-info-circle fs-6 text-info"></i>
                        </div>
                        <span class="fw-semibold fs-6 text-info">Information</span>
                    </div>
                    <div class="text-muted small mb-1">
                        Date: <span class="fw-medium text-dark">${dateFormatted}</span>
                    </div>
                    <div class="text-muted small mb-1">
                        Payment ID: <span class="fw-bold text-dark">#${escapeHtml(paymentId)}</span>
                    </div>
                    <div class="text-muted small d-flex align-items-center gap-1">
                        <span>Notes:</span>
                        <span class="badge bg-white text-dark border fw-normal text-truncate" style="max-width: 150px;" title="${escapeHtml(notes)}">${escapeHtml(notes)}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Voucher Specifications Overview -->
        <div class="card border rounded-3 overflow-hidden">
            <div class="card-header bg-white py-2 px-3 fw-bold small text-uppercase text-secondary d-flex align-items-center gap-2">
                <i class="bi bi-card-text"></i>
                <span>Voucher Specifications</span>
            </div>
            <div class="card-body p-0">
                <table class="table table-bordered mb-0 small">
                    <tbody>
                        <tr>
                            <th class="bg-light text-secondary fw-semibold" style="width: 25%;">Transaction Reference</th>
                            <td class="font-monospace fw-medium" style="width: 25%;">${escapeHtml(transNo)}</td>
                            <th class="bg-light text-secondary fw-semibold" style="width: 25%;">Status</th>
                            <td style="width: 25%;"><span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold">Completed</span></td>
                        </tr>
                        <tr>
                            <th class="bg-light text-secondary fw-semibold">Customer Name</th>
                            <td class="fw-medium">${escapeHtml(customerName)}</td>
                            <th class="bg-light text-secondary fw-semibold">Shop / Outlet</th>
                            <td class="fw-medium">${escapeHtml(shopName || '—')}</td>
                        </tr>
                        <tr>
                            <th class="bg-light text-secondary fw-semibold">Received Amount</th>
                            <td class="fw-bold text-success font-monospace" ${isSpecial ? '' : 'colspan="3"'}>৳ ${formatCurrency(paidAmount)}</td>
                            ${isSpecial ? `
                            <th class="bg-light text-secondary fw-semibold">Updated Balance</th>
                            <td class="font-monospace fw-bold text-dark">৳ ${formatCurrency(newBalance)}</td>
                            ` : ''}
                        </tr>
                        <tr>
                            <th class="bg-light text-secondary fw-semibold">Payment Mode</th>
                            <td>${escapeHtml(paymentMethod)}</td>
                            <th class="bg-light text-secondary fw-semibold">Remarks</th>
                            <td>${escapeHtml(notes)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* ==========================================================================
   Printing Vouchers
   ========================================================================== */
window.printOrderDetails = function() {
    const order = currentSelectedOrder;
    if (!order) return;

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `CO-${orderId}`;
    const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
    const customerName = order.customerName || order.CustomerName || '—';
    const customerShopName = order.customerShopName || order.CustomerShopName || '';
    const customerMobile = order.customerMobile || order.CustomerMobile || '';
    const customerId = order.customerId || order.CustomerId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.customerPreviousBalance !== undefined ? order.customerPreviousBalance : (order.CustomerPreviousBalance !== undefined ? order.CustomerPreviousBalance : 0);
    const newBalance = order.customerNewBalance !== undefined ? order.customerNewBalance : (order.CustomerNewBalance !== undefined ? order.CustomerNewBalance : (Number(prevBalance) + Number(totalAmount)));
    const notes = order.notes || order.Notes || '';
    const isSpecial = order.isSpecial === true || order.IsSpecial === true || order.isSpecial === 'true';
    const details = order.orderDetails || order.OrderDetails || [];

    let itemsRowsHtml = '';
    let totalQty = 0;
    if (Array.isArray(details) && details.length > 0) {
        details.forEach((item, idx) => {
            const pName = item.productName || item.ProductName || `Product #${item.productId || ''}`;
            const qty = Number(item.quantity !== undefined ? item.quantity : (item.Quantity || 0));
            const price = Number(item.unitPrice !== undefined ? item.unitPrice : (item.UnitPrice || 0));
            const lineTot = Number(item.lineTotal !== undefined ? item.lineTotal : (qty * price));
            const remarks = item.remarks || item.Remarks || '';
            totalQty += qty;

            itemsRowsHtml += `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td><div class="fw-semibold">${escapeHtml(pName)}</div></td>
                    <td class="text-muted small">${escapeHtml(remarks || '—')}</td>
                    <td class="text-center fw-medium">${qty}</td>
                    <td class="text-end">৳ ${formatCurrency(price)}</td>
                    <td class="text-end fw-bold">৳ ${formatCurrency(lineTot)}</td>
                </tr>
            `;
        });
    }

    const printDateTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const printWindow = window.open('', '_blank', 'width=850,height=750');
    if (!printWindow) {
        window.print();
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Customer Order Voucher - ${escapeHtml(orderNo)}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
            <style>
                body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; color: #0f172a; padding: 25px; background: #ffffff; }
                .voucher-box { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; }
                .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; height: 100%; }
                .meta-card-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                .items-table th { background: #f8fafc; padding: 9px 12px; font-size: 0.78rem; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; color: #475569; }
                .items-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.86rem; }
                .total-row td { background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1; }
                .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
                .signature-line { width: 200px; border-top: 1px solid #94a3b8; text-align: center; font-size: 0.8rem; padding-top: 6px; color: #475569; }
                @@media print {
                    .no-print { display: none !important; }
                    body { padding: 0; }
                    .voucher-box { border: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print text-center mb-4">
                <button class="btn btn-primary px-4 py-2 rounded-3 me-2" onclick="window.print()"><i class="bi bi-printer me-1"></i> Print</button>
                <button class="btn btn-outline-secondary px-4 py-2 rounded-3" onclick="window.close()">Close</button>
            </div>
            <div class="voucher-box">
                <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4">
                    <div>
                        <h4 class="fw-bold mb-1 text-primary">BUSINESS SOLUTION</h4>
                        <div class="text-secondary small">Smart Enterprise & Sales Management System</div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-primary-subtle text-primary border px-2.5 py-1 mb-1">Customer Order</span>
                        <div class="fw-bold font-monospace fs-5 text-dark">${escapeHtml(orderNo)}</div>
                        <div class="text-muted small">Record ID: #${escapeHtml(orderId)}</div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="${isSpecial ? 'col-4' : 'col-6'}">
                        <div class="meta-card">
                            <div class="meta-card-title text-primary"><i class="bi bi-person-fill"></i> Customer Details</div>
                            <div class="fw-bold text-dark fs-6 d-flex align-items-center gap-1.5 mb-1">
                                <span>${escapeHtml(customerName)}</span>
                                ${isSpecial ? '<span class="badge bg-warning-subtle text-warning-emphasis border rounded-pill px-1.5 py-0 small" style="font-size:0.65rem;">Special</span>' : ''}
                            </div>
                            ${customerShopName ? `<div class="text-secondary small"><i class="bi bi-shop me-1"></i>${escapeHtml(customerShopName)}</div>` : ''}
                            ${customerMobile ? `<div class="text-secondary small"><i class="bi bi-telephone me-1"></i>${escapeHtml(customerMobile)}</div>` : ''}
                            <div class="text-muted small mt-1">Customer ID: <strong class="text-dark">#${escapeHtml(customerId)}</strong></div>
                        </div>
                    </div>

                    ${isSpecial ? `
                    <div class="col-4">
                        <div class="meta-card">
                            <div class="meta-card-title text-success"><i class="bi bi-cash-stack"></i> Financial Summary</div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span class="text-muted">Old Balance:</span>
                                <strong>৳ ${formatCurrency(prevBalance)}</strong>
                            </div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span class="text-muted">Order Total:</span>
                                <strong class="text-primary">৳ ${formatCurrency(totalAmount)}</strong>
                            </div>
                            <div class="d-flex justify-content-between small border-top pt-1 mt-1">
                                <span class="text-muted">New Balance:</span>
                                <strong class="text-success">৳ ${formatCurrency(newBalance)}</strong>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="${isSpecial ? 'col-4' : 'col-6'}">
                        <div class="meta-card">
                            <div class="meta-card-title text-info"><i class="bi bi-calendar3"></i> Order Information</div>
                            <div class="small mb-1"><span class="text-muted">Order Date:</span> <span class="fw-semibold ms-1">${escapeHtml(orderDateFormatted)}</span></div>
                            <div class="small mb-1"><span class="text-muted">Printed On:</span> <span class="text-secondary ms-1">${printDateTime}</span></div>
                            <div class="small"><span class="text-muted">Notes:</span> <span class="fw-medium ms-1">${escapeHtml(notes || 'None')}</span></div>
                        </div>
                    </div>
                </div>

                <table class="items-table mb-4">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 45px;">#</th>
                            <th>Product</th>
                            <th style="width: 160px;">Remarks</th>
                            <th class="text-center" style="width: 90px;">Quantity</th>
                            <th class="text-end" style="width: 130px;">Unit Price</th>
                            <th class="text-end" style="width: 140px;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml}
                        <tr class="total-row">
                            <td colspan="3" class="text-end">Total:</td>
                            <td class="text-center">${totalQty}</td>
                            <td></td>
                            <td class="text-end text-primary">৳ ${formatCurrency(totalAmount)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signature-section">
                    <div class="signature-line">Prepared / Received By</div>
                    <div class="signature-line">Customer Signature & Seal</div>
                    <div class="signature-line">Authorized Signatory</div>
                </div>
            </div>
            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 350); };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

window.printPaymentVoucher = function() {
    const payment = currentSelectedPayment;
    if (!payment) return;

    const paymentId = payment.id || payment.Id || '—';
    const transNo = payment.transactionNo || payment.TransactionNo || '—';
    const customerName = payment.customerName || payment.CustomerName || '—';
    const shopName = payment.customerShopName || payment.CustomerShopName || '';
    const customerId = payment.customerId || payment.CustomerId || '—';
    const dateFormatted = formatDateTime(payment.paymentDate || payment.createdOn || payment.transactionDate);
    const paidAmount = Number(payment.amount !== undefined ? payment.amount : (payment.payment || 0));
    const prevBalance = Number(payment.customerPreviousBalance !== undefined ? payment.customerPreviousBalance : 0);
    const newBalance = Number(payment.customerNewBalance !== undefined ? payment.customerNewBalance : (prevBalance - paidAmount));
    const notes = payment.notes || payment.remarks || 'None';
    const paymentMethod = payment.paymentMethod || 'Cash / Bank Transfer';

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
        window.print();
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Customer Payment Receipt - ${escapeHtml(transNo)}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; color: #0f172a; padding: 30px; background: #fff; }
                .receipt-box { max-width: 750px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; }
                .signature-section { margin-top: 50px; display: flex; justify-content: space-between; }
                .signature-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; font-size: 0.8rem; padding-top: 6px; color: #475569; }
                @@media print {
                    .no-print { display: none !important; }
                    body { padding: 0; }
                    .receipt-box { border: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print text-center mb-4">
                <button class="btn btn-success px-4 py-2 rounded-3 me-2" onclick="window.print()">Print Receipt</button>
                <button class="btn btn-outline-secondary px-4 py-2 rounded-3" onclick="window.close()">Close</button>
            </div>
            <div class="receipt-box">
                <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4">
                    <div>
                        <h4 class="fw-bold mb-1 text-success">BUSINESS SOLUTION</h4>
                        <div class="text-secondary small">Customer Payment Money Receipt</div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-success-subtle text-success border px-2.5 py-1 mb-1">Payment Received</span>
                        <div class="fw-bold font-monospace fs-5 text-dark">${escapeHtml(transNo)}</div>
                        <div class="text-muted small">Date: ${dateFormatted}</div>
                    </div>
                </div>

                <div class="table-responsive mb-4">
                    <table class="table table-bordered mb-0">
                        <tbody>
                            <tr>
                                <th class="bg-light" style="width: 25%;">Customer Name</th>
                                <td style="width: 25%;">${escapeHtml(customerName)}</td>
                                <th class="bg-light" style="width: 25%;">Customer ID</th>
                                <td style="width: 25%;">#${escapeHtml(customerId)}</td>
                            </tr>
                            <tr>
                                <th class="bg-light">Shop / Outlet</th>
                                <td>${escapeHtml(shopName || '—')}</td>
                                <th class="bg-light">Payment Method</th>
                                <td>${escapeHtml(paymentMethod)}</td>
                            </tr>
                            <tr>
                                <th class="bg-light">Previous Due</th>
                                <td class="font-monospace">৳ ${formatCurrency(prevBalance)}</td>
                                <th class="bg-light text-success">Received Amount</th>
                                <td class="font-monospace fw-bold text-success fs-6">৳ ${formatCurrency(paidAmount)}</td>
                            </tr>
                            <tr>
                                <th class="bg-light">Remaining Balance</th>
                                <td class="font-monospace fw-bold text-dark">৳ ${formatCurrency(newBalance)}</td>
                                <th class="bg-light">Remarks</th>
                                <td>${escapeHtml(notes)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="signature-section">
                    <div class="signature-line">Customer Signature</div>
                    <div class="signature-line">Authorized Signature</div>
                </div>
            </div>
            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 350); };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

/* ==========================================================================
   Pagination Controls
   ========================================================================== */
function renderPaginationInfo(itemCount, total, page) {
    const infoEl = document.getElementById('pagination-info');
    if (!infoEl) return;

    if (total === 0 || itemCount === 0) {
        infoEl.innerText = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(start + itemCount - 1, total);
    infoEl.innerText = `Showing ${start} to ${end} of ${total} entries`;
}

function renderPaginationControls(page, totalPgs) {
    const listEl = document.getElementById('pagination-list');
    if (!listEl) return;

    if (totalPgs <= 1) {
        listEl.innerHTML = '';
        return;
    }

    let html = '';

    // Previous Button
    const prevDisabled = page <= 1 ? 'disabled' : '';
    html += `
        <li class="page-item ${prevDisabled}">
            <button class="page-link rounded-2 px-2 py-1" onclick="navigateToPage(${page - 1})" aria-label="Previous" ${page <= 1 ? 'disabled' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPgs, page + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(1)">1</button></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === page ? 'active' : '';
        html += `
            <li class="page-item ${activeClass}">
                <button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(${p})">${p}</button>
            </li>
        `;
    }

    if (endPage < totalPgs) {
        if (endPage < totalPgs - 1) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
        html += `<li class="page-item"><button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(${totalPgs})">${totalPgs}</button></li>`;
    }

    // Next Button
    const nextDisabled = page >= totalPgs ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <button class="page-link rounded-2 px-2 py-1" onclick="navigateToPage(${page + 1})" aria-label="Next" ${page >= totalPgs ? 'disabled' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    listEl.innerHTML = html;
}

window.navigateToPage = function(targetPage) {
    if (targetPage < 1 || (totalPages && targetPage > totalPages) || targetPage === currentPage) {
        return;
    }
    currentPage = targetPage;
    loadTransactionHistories();
};

/* ==========================================================================
   Export PDF & Excel
   ========================================================================== */
function exportToExcel() {
    if (!transactionsList || transactionsList.length === 0) {
        showToast('No transaction data to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel export library not loaded. Please try again.', 'danger');
        return;
    }

    try {
        const exportData = transactionsList.map(item => ({
            "Transaction Ref": item.transactionNo || '',
            "Date": formatDate(item.transactionDate || item.createdOn),
            "Customer Name": item.customerName || '',
            "Customer Shop": item.customerShopName || '',
            "Order Ref": item.customerOrderNo || (item.customerOrderId ? `CO-${item.customerOrderId}` : 'Direct'),
            "Bill Amount (BDT)": Number(item.amount || 0),
            "Payment Received (BDT)": Number(item.payment || 0),
            "Previous Balance (BDT)": Number(item.customerPreviousBalance || 0),
            "New Balance (BDT)": Number(item.customerNewBalance || 0),
            "Created Date": item.createdOn ? formatDateTime(item.createdOn) : ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Customer Transactions");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Customer_Transaction_Histories_${dateStr}.xlsx`);
        showToast('Excel report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to Excel:', e);
        showToast('Failed to export to Excel.', 'danger');
    }
}

function exportToPdf() {
    if (!transactionsList || transactionsList.length === 0) {
        showToast('No transaction data to export.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        showToast('PDF export library not loaded. Please try again.', 'danger');
        return;
    }

    try {
        const doc = new jsPDF('landscape', 'pt', 'a4');

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("Customer Transaction Histories Log", 40, 45);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.text(`Generated on: ${dateStr} | Total Records: ${transactionsList.length}`, 40, 65);

        const tableHeaders = [[
            'Date',
            'Transaction Ref',
            'Customer',
            'Shop',
            'Order No',
            { content: 'Bill (BDT)', styles: { halign: 'right' } },
            { content: 'Payment (BDT)', styles: { halign: 'right' } },
            { content: 'Prev Balance', styles: { halign: 'right' } },
            { content: 'New Balance', styles: { halign: 'right' } }
        ]];
        const tableRows = transactionsList.map(item => [
            formatDate(item.transactionDate || item.createdOn),
            item.transactionNo || '—',
            item.customerName || '',
            item.customerShopName || '',
            item.customerOrderNo || (item.customerOrderId ? `CO-${item.customerOrderId}` : 'Payment'),
            formatCurrency(item.amount),
            formatCurrency(item.payment),
            formatCurrency(item.customerPreviousBalance),
            formatCurrency(item.customerNewBalance)
        ]);

        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 80,
            styles: {
                fontSize: 8.5,
                cellPadding: 5,
                valign: 'middle'
            },
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [51, 65, 85],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 100 },
                2: { cellWidth: 110 },
                3: { cellWidth: 100 },
                4: { cellWidth: 80 },
                5: { halign: 'right', cellWidth: 75 },
                6: { halign: 'right', cellWidth: 75 },
                7: { halign: 'right', cellWidth: 80 },
                8: { halign: 'right', cellWidth: 80 }
            },
            didParseCell: function(data) {
                if (data.section === 'head' && [5, 6, 7, 8].includes(data.column.index)) {
                    data.cell.styles.halign = 'right';
                }
            }
        });

        const saveDate = new Date().toISOString().split('T')[0];
        doc.save(`Customer_Transaction_Histories_${saveDate}.pdf`);
        showToast('PDF report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to PDF:', e);
        showToast('Failed to export to PDF.', 'danger');
    }
}

