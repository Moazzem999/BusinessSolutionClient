/* ==========================================================================
   Business Solution Client - Supplier Transaction Log JavaScript
   Handles listing, filtering, pagination, KPI stats, modal preview,
   and exports (PDF / Excel) for Supplier Transaction Histories.
   API: GET /api/SupplierTransactionHistories/GetAll
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let fromDate = '';
let toDate = '';
let totalCount = 0;
let totalPages = 1;
let transactionsList = [];
let currentSelectedTransaction = null;
let currentSelectedOrder = null;
let transactionDetailsModalInstance = null;
let orderDetailsModalInstance = null;
let searchDebounceTimer = null;

// Sample fallback supplier order matching GET /api/SupplierOrders/GetById/{id}
const SAMPLE_SUPPLIER_ORDER = {
    supplierId: 1,
    supplierName: "Md Abdul Wadud",
    supplierShopName: "Makka Cap House-2",
    orderNo: "PO-2026-0000001",
    orderDate: "2026-10-27T00:00:00",
    totalAmount: 4000,
    notes: "",
    supplierPreviousBalance: 50000,
    supplierNewBalance: 54000,
    orderDetails: [
        {
            supplierOrderId: 28,
            productId: 2,
            productName: "Hudi",
            remarks: "",
            quantity: 5,
            unitPrice: 300,
            lineTotal: 1500,
            id: 15
        },
        {
            supplierOrderId: 28,
            productId: 8,
            productName: "Pant",
            remarks: "",
            quantity: 10,
            unitPrice: 200,
            lineTotal: 2000,
            id: 16
        },
        {
            supplierOrderId: 28,
            productId: 11,
            productName: "Tupi",
            remarks: "",
            quantity: 5,
            unitPrice: 100,
            lineTotal: 500,
            id: 17
        }
    ],
    id: 28,
    createdOn: "2026-10-27T19:23:52.4447107",
    updatedOn: "2026-10-27T19:23:52.4447128",
    createdBy: 1,
    updatedBy: 1,
    status: 1
};

// Sample Fallback Data matching the backend response schema
const SAMPLE_TRANSACTION_HISTORIES = [
    {
        supplierId: 5,
        supplierName: "Md Rejaul Karim",
        supplierShopName: "Lulu Fashion",
        supplierOrderId: 36,
        supplierOrderNo: "PO-2026-0000009",
        transactionNo: "20261027-595f5143de",
        transactionDate: "2026-10-27T00:00:00",
        amount: 2000,
        payment: 0,
        supplierPreviousBalance: 44000,
        supplierNewBalance: 46000,
        id: 20,
        createdOn: "2026-10-27T20:02:40.9531603",
        updatedOn: "2026-10-27T20:02:40.9531621",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 5,
        supplierName: "Md Rejaul Karim",
        supplierShopName: "Lulu Fashion",
        supplierOrderId: null,
        supplierOrderNo: null,
        transactionNo: "20261026-a48e71b29c",
        transactionDate: "2026-10-26T00:00:00",
        amount: 0,
        payment: 10000,
        supplierPreviousBalance: 54000,
        supplierNewBalance: 44000,
        id: 19,
        createdOn: "2026-10-26T14:15:22.1245678",
        updatedOn: "2026-10-26T14:15:22.1245678",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 1,
        supplierName: "Md Abdul Wadud",
        supplierShopName: "Makka Cap House-2",
        supplierOrderId: 12,
        supplierOrderNo: "PO-2026-0000002",
        transactionNo: "20261018-c21d89e73f",
        transactionDate: "2026-10-18T00:00:00",
        amount: 200,
        payment: 0,
        supplierPreviousBalance: 50300,
        supplierNewBalance: 50500,
        id: 18,
        createdOn: "2026-10-18T18:56:53.3367322",
        updatedOn: "2026-10-18T20:16:11.1859271",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 1,
        supplierName: "Md Abdul Wadud",
        supplierShopName: "Makka Cap House-2",
        supplierOrderId: 11,
        supplierOrderNo: "PO-2026-0000001",
        transactionNo: "20261018-b11c78e62a",
        transactionDate: "2026-10-18T00:00:00",
        amount: 300,
        payment: 0,
        supplierPreviousBalance: 50000,
        supplierNewBalance: 50300,
        id: 17,
        createdOn: "2026-10-18T18:55:47.7532508",
        updatedOn: "2026-10-18T20:23:14.3029556",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

// Document Ready Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTransactionLogPage);
} else {
    initTransactionLogPage();
}

/**
 * Initializes page components, URL query params, and fetches records
 */
function initTransactionLogPage() {
    parseUrlParameters();
    initTransactionLogEvents();
    loadTransactionHistories();
}

/**
 * Reads any query parameters passed via URL (e.g., ?SearchTerm=...&FromDate=...)
 */
function parseUrlParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

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
        console.warn('Error parsing URL query parameters:', e);
    }
}

/**
 * Returns API base URL from BSApp, window variable, or fallback
 */
function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getApiBaseUrl === 'function') {
        return BSApp.getApiBaseUrl();
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL.replace(/\/+$/, '');
    }
    return 'https://localhost:7148/api';
}

/**
 * Returns stored auth token from BSApp, localStorage, or cookies
 */
function getAuthToken() {
    let token = '';
    if (typeof BSApp !== 'undefined' && typeof BSApp.getStoredToken === 'function') {
        token = BSApp.getStoredToken();
    }
    if (!token) {
        token = localStorage.getItem('bs_token') || '';
    }
    if (!token) {
        const match = document.cookie.match(/(?:^|;\s*)bs_auth_token=([^;]*)/);
        if (match) {
            token = decodeURIComponent(match[1]);
        }
    }
    return token;
}

/**
 * Format date string into user-friendly localized format (e.g. 27 Oct 2026)
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (_) {
        return dateStr;
    }
}

/**
 * Format date string into US format (e.g. Oct 27, 2026) matching order details modal
 */
function formatDateUS(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (_) {
        return dateStr;
    }
}

/**
 * Format date string with time (e.g. 27 Oct 2026, 08:02 PM)
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (_) {
        return dateStr;
    }
}

/**
 * Format number into currency format (e.g. 44,000.00)
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Safely escape string for HTML rendering
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Displays toast notification
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMsg) return;

    toastEl.className = 'toast align-items-center text-white border-0 rounded-3 shadow-lg';
    let iconClass = 'bi-info-circle-fill';

    if (type === 'success') {
        toastEl.classList.add('bg-success');
        iconClass = 'bi-check-circle-fill';
    } else if (type === 'danger' || type === 'error') {
        toastEl.classList.add('bg-danger');
        iconClass = 'bi-exclamation-triangle-fill';
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning', 'text-dark');
        iconClass = 'bi-exclamation-circle-fill';
    } else {
        toastEl.classList.add('bg-primary');
        iconClass = 'bi-info-circle-fill';
    }

    if (toastIcon) toastIcon.className = `bi ${iconClass} fs-5`;
    toastMsg.innerText = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = bootstrap.Toast.getOrCreateInstance
            ? bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 })
            : (bootstrap.Toast.getInstance(toastEl) || new bootstrap.Toast(toastEl, { delay: 4000 }));
        toast.show();
    }
}

/**
 * Helper to copy string to clipboard
 */
function copyToClipboard(text, label = 'Transaction reference') {
    if (!navigator.clipboard) {
        showToast(`Copied ${label}: ${text}`, 'success');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Copied ${label} to clipboard!`, 'success');
    }).catch(() => {
        showToast(`Could not copy: ${text}`, 'warning');
    });
}

/**
 * Initializes event listeners for form controls, exports, and modals
 */
function initTransactionLogEvents() {
    const filterForm = document.getElementById('transaction-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const retryBtn = document.getElementById('btn-retry-api');
    const refreshBtn = document.getElementById('btn-refresh-transactions');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');
    const printModalBtn = document.getElementById('btn-modal-print-transaction');

    // Bootstrap Modal Instances
    const modalEl = document.getElementById('transactionDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            transactionDetailsModalInstance = new bootstrap.Modal(modalEl);
        } catch (e) {
            console.warn('Could not initialize transactionDetailsModal bootstrap instance:', e);
        }
    }

    const orderModalEl = document.getElementById('orderDetailsModal');
    if (orderModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            orderDetailsModalInstance = new bootstrap.Modal(orderModalEl);
        } catch (e) {
            console.warn('Could not initialize orderDetailsModal bootstrap instance:', e);
        }
    }

    // Filter Form Submit
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    // Search Input Debouncing
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
            }, 450);
        });
    }

    // Date Filters Change
    if (fromDateInput) {
        fromDateInput.addEventListener('change', () => {
            applyFilters();
        });
    }
    if (toDateInput) {
        toDateInput.addEventListener('change', () => {
            applyFilters();
        });
    }

    // Reset Filters
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';

            searchTerm = '';
            supplierId = '';
            supplierOrderId = '';
            fromDate = '';
            toDate = '';
            currentPage = 1;

            // Clear URL search params without reload
            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }

            loadTransactionHistories();
        });
    }

    // Page Size Change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadTransactionHistories();
        });
    }

    // Refresh & Retry
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            loadTransactionHistories();
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadTransactionHistories();
            showToast('Refreshed transaction log.', 'info');
        });
    }

    // Print Modal Voucher
    if (printModalBtn) {
        printModalBtn.addEventListener('click', () => {
            window.printTransactionVoucher();
        });
    }

    // Export Buttons
    if (pdfBtn) {
        pdfBtn.addEventListener('click', exportToPdf);
    }
    if (excelBtn) {
        excelBtn.addEventListener('click', exportToExcel);
    }
}

/**
 * Collects current filter inputs and triggers reload
 */
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');

    searchTerm = searchInput ? searchInput.value.trim() : '';
    fromDate = fromDateInput ? fromDateInput.value.trim() : '';
    toDate = toDateInput ? toDateInput.value.trim() : '';

    currentPage = 1;
    loadTransactionHistories();
}

/**
 * Fetches transaction histories from API:
 * GET /api/SupplierTransactionHistories/GetAll?SearchTerm=...&SupplierId=...&SupplierOrderId=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
 * Note: All parameters are optional.
 */
async function loadTransactionHistories() {
    const tableBody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('transactions-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Reset error & empty state
    if (apiErrorAlert) {
        apiErrorAlert.classList.add('d-none');
        apiErrorAlert.classList.remove('d-flex');
    }
    if (emptyState) emptyState.classList.add('d-none');

    // Loading skeleton
    tableBody.innerHTML = `
        <tr id="transactions-loading-row">
            <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching transaction histories...</div>
            </td>
        </tr>
    `;

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

    // Build URLSearchParams - only append parameters that have values (all optional)
    const queryParams = new URLSearchParams();

    if (searchTerm && searchTerm.trim() !== '') {
        queryParams.append('SearchTerm', searchTerm.trim());
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
    const endpoint = queryString ? `${baseUrl}/SupplierTransactionHistories/GetAll?${queryString}` : `${baseUrl}/SupplierTransactionHistories/GetAll`;

    try {
        console.log('Fetching Supplier Transaction Histories from:', endpoint);
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

        const result = await response.json();
        console.log('Supplier Transaction Histories API Response:', result);

        let items = [];
        totalCount = 0;
        totalPages = 1;

        if (result) {
            if (result.data) {
                if (Array.isArray(result.data.items || result.data.Items)) {
                    items = result.data.items || result.data.Items;
                    totalCount = result.data.totalCount !== undefined ? result.data.totalCount : (result.data.TotalCount !== undefined ? result.data.TotalCount : items.length);
                    totalPages = result.data.totalPages || result.data.TotalPages || Math.ceil(totalCount / pageSize) || 1;
                    currentPage = result.data.pageNumber || result.data.PageNumber || currentPage;
                } else if (Array.isArray(result.data)) {
                    items = result.data;
                    totalCount = items.length;
                    totalPages = Math.ceil(totalCount / pageSize) || 1;
                }
            } else if (Array.isArray(result.items)) {
                items = result.items;
                totalCount = result.totalCount || items.length;
                totalPages = result.totalPages || Math.ceil(totalCount / pageSize) || 1;
            } else if (Array.isArray(result)) {
                items = result;
                totalCount = items.length;
                totalPages = Math.ceil(totalCount / pageSize) || 1;
            }
        }

        transactionsList = items;
        renderTransactionsTable(transactionsList);
        updateKpiCards(transactionsList, totalCount);
        renderPaginationInfo(transactionsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();

    } catch (err) {
        console.warn('API error while fetching transaction histories:', err.message);

        // If backend returned 401 or offline, provide fallback sample records for seamless preview
        if (apiErrorAlert && apiErrorMsg) {
            apiErrorMsg.innerText = `Backend Notice: ${err.message}. Showing sample transaction records below for preview.`;
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }

        // Filter sample data based on current inputs
        let filteredSample = SAMPLE_TRANSACTION_HISTORIES.filter(item => {
            let match = true;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const sName = (item.supplierName || '').toLowerCase();
                const shop = (item.supplierShopName || '').toLowerCase();
                const po = (item.supplierOrderNo || '').toLowerCase();
                const tx = (item.transactionNo || '').toLowerCase();
                if (!sName.includes(term) && !shop.includes(term) && !po.includes(term) && !tx.includes(term)) {
                    match = false;
                }
            }
            return match;
        });

        transactionsList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderTransactionsTable(transactionsList);
        updateKpiCards(transactionsList, totalCount);
        renderPaginationInfo(transactionsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();
    }
}

/**
 * Updates KPI Summary Stat Cards at the top of the page
 */
function updateKpiCards(items, totalRecordsCount) {
    const totalRecordsEl = document.getElementById('stat-total-records');
    const totalAmountEl = document.getElementById('stat-total-amount');
    const totalPaymentEl = document.getElementById('stat-total-payment');
    const netDiffEl = document.getElementById('stat-net-diff');

    if (totalRecordsEl) {
        totalRecordsEl.innerText = Number(totalRecordsCount).toLocaleString('en-US');
    }

    // Sum amount and payment for visible list
    let sumAmount = 0;
    let sumPayment = 0;

    items.forEach(item => {
        sumAmount += Number(item.amount || 0);
        sumPayment += Number(item.payment || 0);
    });

    const netDiff = sumAmount - sumPayment;

    if (totalAmountEl) totalAmountEl.innerText = `৳ ${formatCurrency(sumAmount)}`;
    if (totalPaymentEl) totalPaymentEl.innerText = `৳ ${formatCurrency(sumPayment)}`;
    if (netDiffEl) {
        netDiffEl.innerText = `৳ ${formatCurrency(netDiff)}`;
        netDiffEl.className = netDiff > 0 ? 'fw-bold text-primary mb-0' : (netDiff < 0 ? 'fw-bold text-success mb-0' : 'fw-bold text-dark mb-0');
    }
}

/**
 * Renders transaction rows into table body
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
    items.forEach(item => {
        const id = item.id || 0;
        const transNo = item.transactionNo || '—';
        const dateFormatted = formatDate(item.transactionDate || item.createdOn);
        const supplierName = item.supplierName || 'N/A';
        const shopName = item.supplierShopName || '';
        const orderNo = item.supplierOrderNo || (item.supplierOrderId ? `#${item.supplierOrderId}` : null);
        const amount = Number(item.amount || 0);
        const payment = Number(item.payment || 0);
        const prevBal = Number(item.supplierPreviousBalance || 0);
        const newBal = Number(item.supplierNewBalance || 0);

        // Initials for avatar
        const initials = supplierName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SP';

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

                <!-- Supplier Info -->
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="avatar-circle-sm bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width: 36px; height: 36px; font-size: 13px;">
                            ${initials}
                        </div>
                        <div class="overflow-hidden">
                            <div class="fw-bold text-dark text-truncate mb-0" style="max-width: 180px;" title="${escapeHtml(supplierName)}">
                                ${escapeHtml(supplierName)}
                            </div>
                            ${shopName ? `
                                <span class="badge bg-light text-secondary border fw-normal rounded-pill px-2 py-0 small" style="font-size: 0.72rem;">
                                    <i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </td>

                <!-- Order Reference -->
                <td>
                    ${orderNo ? `
                        <button type="button" class="btn-order-details" 
                            data-order-id="${item.supplierOrderId || ''}" 
                            data-order-no="${escapeHtml(orderNo)}"
                            title="Click to view details of ${escapeHtml(orderNo)}">${escapeHtml(orderNo)}</button>
                    ` : `
                        <span class="badge bg-light text-muted border px-2 py-1 fw-normal" style="font-size: 0.75rem;">
                            Payment
                        </span>
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

    // Attach click listeners to clickable Order No badges
    tableBody.querySelectorAll('.btn-order-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const orderId = btn.getAttribute('data-order-id');
            const orderNo = btn.getAttribute('data-order-no');
            fetchAndShowOrderDetails(orderId, orderNo);
        });
    });
}

/**
 * Fetches supplier order details by ID from API:
 * GET /api/SupplierOrders/GetById/{id}
 * Displays order details modal matching the design
 */
async function fetchAndShowOrderDetails(orderId, fallbackOrderNo) {
    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    if (!modalContent) return;

    if (modalTitleNo) {
        modalTitleNo.innerText = fallbackOrderNo || (orderId ? `PO-${orderId}` : '');
    }

    // Show loading skeleton inside modal
    modalContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading order details...</span>
            </div>
            <div class="text-muted small mt-2">Fetching order details for ${escapeHtml(fallbackOrderNo || `#${orderId}`)}...</div>
        </div>
    `;

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
        currentSelectedOrder = SAMPLE_SUPPLIER_ORDER;
        renderOrderDetailsModal(SAMPLE_SUPPLIER_ORDER);
        return;
    }

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    const endpoint = `${baseUrl}/SupplierOrders/GetById/${encodeURIComponent(orderId)}`;

    try {
        console.log('Fetching Supplier Order Details from:', endpoint);
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
        console.log('Supplier Order Details API Response:', result);

        const orderData = result.data || result;
        if (!orderData) {
            throw new Error('No order data found in API response.');
        }

        currentSelectedOrder = orderData;
        renderOrderDetailsModal(orderData);

    } catch (err) {
        console.warn('Could not fetch supplier order details from API, using fallback data:', err.message);
        // Fallback using sample order matching schema provided by user
        const fallback = Object.assign({}, SAMPLE_SUPPLIER_ORDER, {
            id: orderId,
            orderNo: fallbackOrderNo || SAMPLE_SUPPLIER_ORDER.orderNo
        });
        currentSelectedOrder = fallback;
        renderOrderDetailsModal(fallback);
    }
}

/**
 * Renders the Supplier Order Details into the modal matching the design
 */
function renderOrderDetailsModal(order) {
    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    if (!order || !modalContent) return;

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `PO-${orderId}`;
    const orderDateFormatted = formatDateUS(order.orderDate || order.OrderDate);
    const supplierName = order.supplierName || order.SupplierName || '—';
    const supplierShopName = order.supplierShopName || order.SupplierShopName || '';
    const supplierId = order.supplierId || order.SupplierId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.supplierPreviousBalance !== undefined ? order.supplierPreviousBalance : (order.SupplierPreviousBalance !== undefined ? order.SupplierPreviousBalance : 0);
    const newBalance = order.supplierNewBalance !== undefined ? order.supplierNewBalance : (order.SupplierNewBalance !== undefined ? order.SupplierNewBalance : 0);
    const notes = order.notes || order.Notes || '';
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
            <!-- Supplier Card -->
            <div class="col-12 col-md-4">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-primary-subtle text-primary p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-truck fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Supplier</h6>
                    </div>
                    <div class="fw-bold text-dark fs-6">${escapeHtml(supplierName)}</div>
                    <div class="text-muted small mb-1">${supplierShopName ? `<i class="bi bi-shop me-1"></i>${escapeHtml(supplierShopName)}` : ''}</div>
                    <div class="text-muted small">Supplier ID: <span class="fw-medium text-dark">#${escapeHtml(supplierId)}</span></div>
                </div>
            </div>

            <!-- Order Financials -->
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
                        <span class="fw-bold text-danger">৳ ${formatCurrency(newBalance)}</span>
                    </div>
                </div>
            </div>

            <!-- Meta & Notes -->
            <div class="col-12 col-md-4">
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

/**
 * Generates and prints a high-fidelity Purchase Order Voucher matching supplier orders
 */
window.printOrderDetails = function(orderParam) {
    const order = orderParam || currentSelectedOrder;
    if (!order) return;

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `PO-${orderId}`;
    const orderDateFormatted = formatDateUS(order.orderDate || order.orderDate);
    const supplierName = order.supplierName || order.SupplierName || '—';
    const supplierShopName = order.supplierShopName || order.SupplierShopName || '';
    const supplierId = order.supplierId || order.SupplierId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.supplierPreviousBalance !== undefined ? order.supplierPreviousBalance : (order.SupplierPreviousBalance !== undefined ? order.SupplierPreviousBalance : 0);
    const newBalance = order.supplierNewBalance !== undefined ? order.supplierNewBalance : (order.SupplierNewBalance !== undefined ? order.SupplierNewBalance : 0);
    const notes = order.notes || order.Notes || 'None';
    const details = order.orderDetails || order.OrderDetails || [];

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
        window.print();
        return;
    }

    let rowsHtml = '';
    let totalQty = 0;
    if (Array.isArray(details)) {
        details.forEach((item, idx) => {
            const pName = item.productName || item.ProductName || `Product #${item.productId || ''}`;
            const qty = item.quantity || item.Quantity || 0;
            const price = item.unitPrice || item.UnitPrice || 0;
            const line = item.lineTotal || item.LineTotal || (qty * price);
            totalQty += Number(qty);
            rowsHtml += `
                <tr>
                    <td style="text-align:center;">${idx + 1}</td>
                    <td><strong>${escapeHtml(pName)}</strong></td>
                    <td>${escapeHtml(item.remarks || item.Remarks || '—')}</td>
                    <td style="text-align:center;">${qty}</td>
                    <td style="text-align:right;">৳ ${formatCurrency(price)}</td>
                    <td style="text-align:right; font-weight:bold;">৳ ${formatCurrency(line)}</td>
                </tr>
            `;
        });
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Order Voucher - ${escapeHtml(orderNo)}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
                .voucher-box { border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; }
                .table-bordered th, .table-bordered td { border: 1px solid #cbd5e1 !important; padding: 6px 10px; }
                @@media print {
                    body { padding: 0; }
                    .btn-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="voucher-box">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <div>
                        <h4 class="fw-bold text-primary mb-0">Business Solution</h4>
                        <div class="text-muted small">Supplier Purchase Order Details</div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold font-monospace fs-5 text-primary">${escapeHtml(orderNo)}</div>
                        <div class="text-muted small">Date: ${orderDateFormatted}</div>
                    </div>
                </div>

                <div class="row g-3 mb-3">
                    <div class="col-6">
                        <div class="text-muted small text-uppercase fw-semibold">Supplier Information</div>
                        <div class="fw-bold fs-6">${escapeHtml(supplierName)}</div>
                        <div class="text-secondary small">Shop: ${escapeHtml(supplierShopName)}</div>
                        <div class="text-secondary small">Supplier ID: #${supplierId}</div>
                    </div>
                    <div class="col-6 text-end">
                        <div class="text-muted small text-uppercase fw-semibold">Financial Summary</div>
                        <div class="small">Old Balance: <strong>৳ ${formatCurrency(prevBalance)}</strong></div>
                        <div class="small text-primary fw-bold">Order Total: ৳ ${formatCurrency(totalAmount)}</div>
                        <div class="small text-danger fw-bold">New Balance: ৳ ${formatCurrency(newBalance)}</div>
                    </div>
                </div>

                <div class="fw-bold mb-2">Order Items (${details.length})</div>
                <table class="table table-bordered mb-3">
                    <thead class="table-light">
                        <tr>
                            <th style="width:40px; text-align:center;">#</th>
                            <th>Product</th>
                            <th>Remarks</th>
                            <th style="width:80px; text-align:center;">Quantity</th>
                            <th style="width:120px; text-align:right;">Unit Price</th>
                            <th style="width:120px; text-align:right;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot class="table-light fw-bold">
                        <tr>
                            <td colspan="3" style="text-align:right;">Total:</td>
                            <td style="text-align:center;">${totalQty}</td>
                            <td></td>
                            <td style="text-align:right; color:#2563eb;">৳ ${formatCurrency(totalAmount)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="mb-3 text-muted small">
                    <strong>Notes:</strong> ${escapeHtml(notes)}
                </div>

                <div class="d-flex justify-content-between align-items-center pt-4 border-top text-muted small">
                    <div>Printed on: ${new Date().toLocaleDateString('en-GB')}</div>
                    <div>Authorized Signature: _______________________</div>
                </div>
            </div>

            <div class="text-center mt-3">
                <button type="button" class="btn btn-primary btn-print" onclick="window.print()">Print Order</button>
            </div>
            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 400); };
            </script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

/**
 * Updates dynamic active filters badges below the filter row
 */
function updateActiveFilterBadges() {
    const container = document.getElementById('active-filter-badges');
    if (!container) return;

    let badgesHtml = '';

    if (searchTerm) {
        badgesHtml += `
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1 small">
                Search: "${escapeHtml(searchTerm)}"
                <button type="button" class="btn-close btn-close-sm p-0 ms-1" style="font-size: 0.65rem;" onclick="clearSingleFilter('search')"></button>
            </span>
        `;
    }

    if (fromDate || toDate) {
        badgesHtml += `
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1 small">
                <i class="bi bi-calendar3 text-secondary"></i> ${fromDate || 'Start'} to ${toDate || 'End'}
                <button type="button" class="btn-close btn-close-sm p-0 ms-1" style="font-size: 0.65rem;" onclick="clearSingleFilter('date')"></button>
            </span>
        `;
    }

    container.innerHTML = badgesHtml;
}

/**
 * Clears an individual active filter chip
 */
function clearSingleFilter(type) {
    if (type === 'search') {
        const el = document.getElementById('search-input');
        if (el) el.value = '';
        searchTerm = '';
    } else if (type === 'date') {
        const fromEl = document.getElementById('from-date-input');
        const toEl = document.getElementById('to-date-input');
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        fromDate = '';
        toDate = '';
    }
    currentPage = 1;
    loadTransactionHistories();
}

/**
 * Opens detailed transaction voucher receipt modal
 */
function openTransactionDetailsModal(item) {
    currentSelectedTransaction = item;

    const modalTitleNo = document.getElementById('modal-transaction-no');
    const modalContent = document.getElementById('modal-transaction-details-content');

    if (modalTitleNo) modalTitleNo.innerText = item.transactionNo || `ID #${item.id}`;

    const dateFormatted = formatDateTime(item.transactionDate || item.createdOn);
    const amount = Number(item.amount || 0);
    const payment = Number(item.payment || 0);
    const prevBal = Number(item.supplierPreviousBalance || 0);
    const newBal = Number(item.supplierNewBalance || 0);

    const isPurchase = amount > 0 && payment === 0;
    const isPayment = payment > 0;

    let transactionTypeBadge = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1">General Ledger</span>';
    if (isPurchase) {
        transactionTypeBadge = '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle px-3 py-1">Purchase Invoice Bill</span>';
    } else if (isPayment) {
        transactionTypeBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1">Supplier Payment Voucher</span>';
    }

    modalContent.innerHTML = `
        <div class="transaction-voucher-print-area">
            <!-- Top Voucher Header Banner -->
            <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between p-3 rounded-4 bg-light mb-4 gap-3">
                <div>
                    <span class="text-muted small d-block">Transaction Reference</span>
                    <span class="h5 fw-bold font-monospace text-dark mb-0">${escapeHtml(item.transactionNo || 'N/A')}</span>
                </div>
                <div class="text-sm-end">
                    ${transactionTypeBadge}
                    <div class="text-muted small mt-1"><i class="bi bi-calendar-event me-1"></i>${dateFormatted}</div>
                </div>
            </div>

            <!-- Supplier & Order Card Section -->
            <div class="row g-3 mb-4">
                <!-- Supplier Info -->
                <div class="col-12 col-md-6">
                    <div class="card border rounded-4 h-100 p-3 bg-white shadow-none">
                        <div class="d-flex align-items-center gap-2 mb-2 text-primary fw-semibold small text-uppercase" style="letter-spacing: 0.5px;">
                            <i class="bi bi-truck fs-6"></i> Supplier Profile
                        </div>
                        <h6 class="fw-bold text-dark mb-1">${escapeHtml(item.supplierName || 'N/A')}</h6>
                        <div class="text-muted small mb-1">
                            <i class="bi bi-shop me-1 text-secondary"></i> Shop: <strong>${escapeHtml(item.supplierShopName || 'N/A')}</strong>
                        </div>
                        <div class="text-muted small">
                            <i class="bi bi-person-badge me-1 text-secondary"></i> Supplier ID: #${item.supplierId || 'N/A'}
                        </div>
                    </div>
                </div>

                <!-- Order Reference Info -->
                <div class="col-12 col-md-6">
                    <div class="card border rounded-4 h-100 p-3 bg-white shadow-none">
                        <div class="d-flex align-items-center gap-2 mb-2 text-primary fw-semibold small text-uppercase" style="letter-spacing: 0.5px;">
                            <i class="bi bi-cart-check fs-6"></i> Linked Supplier Order
                        </div>
                        ${item.supplierOrderNo ? `
                            <h6 class="fw-bold font-monospace text-primary mb-1">${escapeHtml(item.supplierOrderNo)}</h6>
                            <div class="text-muted small mb-1">
                                <i class="bi bi-hash me-1 text-secondary"></i> Supplier Order ID: #${item.supplierOrderId || 'N/A'}
                            </div>
                            <div class="mt-2">
                                <a href="/Order/SupplierOrders?searchTerm=${encodeURIComponent(item.supplierOrderNo)}" target="_blank" class="btn btn-sm btn-outline-primary rounded-2 px-2 py-1 small">
                                    <i class="bi bi-box-arrow-up-right me-1"></i> View Order Details
                                </a>
                            </div>
                        ` : `
                            <div class="text-muted small py-2">
                                <i class="bi bi-info-circle me-1"></i> No supplier purchase order linked directly. This transaction is recorded as a balance settlement or payment ledger entry.
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <!-- Financial Impact Breakdown Table -->
            <div class="card border rounded-4 overflow-hidden mb-4 shadow-none">
                <div class="card-header bg-light py-2 px-3 fw-semibold text-secondary small text-uppercase" style="letter-spacing: 0.5px;">
                    Financial Settlement & Balance Audit
                </div>
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="bg-white">
                            <tr class="text-muted small">
                                <th class="ps-3 py-2">Metric</th>
                                <th class="text-end pe-3 py-2">Amount (BDT)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="ps-3 text-secondary">Supplier Previous Balance</td>
                                <td class="text-end pe-3 font-monospace fw-semibold text-dark">৳ ${formatCurrency(prevBal)}</td>
                            </tr>
                            <tr class="${amount > 0 ? 'bg-primary-subtle bg-opacity-25' : ''}">
                                <td class="ps-3">
                                    <span class="fw-medium text-dark">Purchase Bill / Billed Amount</span>
                                    <span class="text-muted small ms-1">(Added to payable balance)</span>
                                </td>
                                <td class="text-end pe-3 font-monospace fw-bold ${amount > 0 ? 'text-primary' : 'text-muted'}">
                                    ${amount > 0 ? `+ ৳ ${formatCurrency(amount)}` : '৳ 0.00'}
                                </td>
                            </tr>
                            <tr class="${payment > 0 ? 'bg-success-subtle bg-opacity-25' : ''}">
                                <td class="ps-3">
                                    <span class="fw-medium text-dark">Payment Paid to Supplier</span>
                                    <span class="text-muted small ms-1">(Deducted from payable balance)</span>
                                </td>
                                <td class="text-end pe-3 font-monospace fw-bold ${payment > 0 ? 'text-success' : 'text-muted'}">
                                    ${payment > 0 ? `- ৳ ${formatCurrency(payment)}` : '৳ 0.00'}
                                </td>
                            </tr>
                            <tr class="table-light border-top border-2">
                                <td class="ps-3 py-3 fw-bold text-dark fs-6">
                                    Supplier New Running Balance
                                </td>
                                <td class="text-end pe-3 py-3 font-monospace fw-bold text-dark fs-5">
                                    ৳ ${formatCurrency(newBal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Audit Metadata Footer -->
            <div class="p-3 rounded-4 bg-light text-muted small d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                    <i class="bi bi-clock-history me-1"></i> Recorded: <strong>${formatDateTime(item.createdOn)}</strong>
                </div>
                <div>
                    <i class="bi bi-person-check me-1"></i> Operator ID: <strong>User #${item.createdBy || 1}</strong>
                </div>
                <div>
                    <i class="bi bi-shield-check text-success me-1"></i> Status: <span class="badge bg-success-subtle text-success border border-success-subtle">Verified Active</span>
                </div>
            </div>
        </div>
    `;

    if (transactionDetailsModalInstance) {
        transactionDetailsModalInstance.show();
    } else {
        const modalEl = document.getElementById('transactionDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }
}

/**
 * Print transaction receipt / voucher
 */
window.printTransactionVoucher = function() {
    if (!currentSelectedTransaction) return;

    const item = currentSelectedTransaction;
    const dateFormatted = formatDateTime(item.transactionDate || item.createdOn);
    const amount = Number(item.amount || 0);
    const payment = Number(item.payment || 0);
    const prevBal = Number(item.supplierPreviousBalance || 0);
    const newBal = Number(item.supplierNewBalance || 0);

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
        window.print();
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Transaction Voucher - ${escapeHtml(item.transactionNo || '')}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; }
                .voucher-box { border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; }
                .brand-title { font-size: 20px; font-weight: 800; color: #2563eb; }
                .table-bordered th, .table-bordered td { border: 1px solid #cbd5e1 !important; }
                @@media print {
                    body { padding: 0; }
                    .btn-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="voucher-box">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <div>
                        <div class="brand-title">Business Solution</div>
                        <div class="text-muted small">Supplier Transaction Voucher</div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold font-monospace text-primary">${escapeHtml(item.transactionNo || 'N/A')}</div>
                        <div class="text-muted small">${dateFormatted}</div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-6">
                        <div class="text-muted small text-uppercase">Supplier Information</div>
                        <div class="fw-bold fs-6">${escapeHtml(item.supplierName || 'N/A')}</div>
                        <div class="text-secondary small">Shop: ${escapeHtml(item.supplierShopName || 'N/A')}</div>
                        <div class="text-secondary small">Supplier ID: #${item.supplierId || 'N/A'}</div>
                    </div>
                    <div class="col-6 text-end">
                        <div class="text-muted small text-uppercase">Order Reference</div>
                        <div class="fw-bold font-monospace">${escapeHtml(item.supplierOrderNo || 'Payment')}</div>
                        ${item.supplierOrderId ? `<div class="text-secondary small">Order ID: #${item.supplierOrderId}</div>` : ''}
                    </div>
                </div>

                <table class="table table-bordered mb-4">
                    <thead class="table-light">
                        <tr>
                            <th>Particulars / Description</th>
                            <th class="text-end" style="width: 200px;">Amount (BDT)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Supplier Previous Balance</td>
                            <td class="text-end font-monospace">৳ ${formatCurrency(prevBal)}</td>
                        </tr>
                        <tr>
                            <td>Purchase Bill / Invoice Amount (Debit)</td>
                            <td class="text-end font-monospace fw-bold text-primary">${amount > 0 ? `+ ৳ ${formatCurrency(amount)}` : '৳ 0.00'}</td>
                        </tr>
                        <tr>
                            <td>Payment Paid to Supplier (Credit)</td>
                            <td class="text-end font-monospace fw-bold text-success">${payment > 0 ? `- ৳ ${formatCurrency(payment)}` : '৳ 0.00'}</td>
                        </tr>
                        <tr class="table-light">
                            <td class="fw-bold">Supplier New Balance</td>
                            <td class="text-end font-monospace fw-bold fs-6">৳ ${formatCurrency(newBal)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="d-flex justify-content-between align-items-center pt-4 border-top text-muted small">
                    <div>Recorded on: ${dateFormatted}</div>
                    <div>Authorized Signature: _______________________</div>
                </div>
            </div>

            <div class="text-center mt-3">
                <button type="button" class="btn btn-primary btn-print" onclick="window.print()">Print Voucher</button>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 400);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

/**
 * Render pagination summary text (e.g. Showing 1 to 10 of 25 entries)
 */
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

/**
 * Render pagination controls buttons
 */
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

    // Dynamic Pages
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

/**
 * Navigate to a specific page
 */
window.navigateToPage = function(targetPage) {
    if (targetPage < 1 || (totalPages && targetPage > totalPages) || targetPage === currentPage) {
        return;
    }
    currentPage = targetPage;
    loadTransactionHistories();
};

/**
 * Export current transaction list to Excel using SheetJS
 */
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
            "Supplier Name": item.supplierName || '',
            "Supplier Shop": item.supplierShopName || '',
            "Order Ref": item.supplierOrderNo || (item.supplierOrderId ? `#${item.supplierOrderId}` : 'Direct'),
            "Bill Amount (BDT)": Number(item.amount || 0),
            "Payment Paid (BDT)": Number(item.payment || 0),
            "Previous Balance (BDT)": Number(item.supplierPreviousBalance || 0),
            "New Balance (BDT)": Number(item.supplierNewBalance || 0),
            "Created Date": item.createdOn ? formatDateTime(item.createdOn) : ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Supplier Transactions");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Supplier_Transaction_Histories_${dateStr}.xlsx`);
        showToast('Excel report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to Excel:', e);
        showToast('Failed to export to Excel.', 'danger');
    }
}

/**
 * Export current transaction list to PDF using jsPDF + autoTable
 */
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

        // Document Title & Metadata
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("Supplier Transaction Histories Log", 40, 45);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        doc.text(`Generated on: ${nowStr} | Total Records: ${transactionsList.length}`, 40, 62);

        // Build Table Rows
        const head = [[
            "Date",
            "Transaction No",
            "Supplier",
            "Shop",
            "Order Ref",
            { content: "Amount", styles: { halign: 'right' } },
            { content: "Payment", styles: { halign: 'right' } },
            { content: "Prev Bal", styles: { halign: 'right' } },
            { content: "New Bal", styles: { halign: 'right' } }
        ]];
        const body = transactionsList.map(item => [
            formatDate(item.transactionDate || item.createdOn),
            item.transactionNo || '—',
            item.supplierName || '—',
            item.supplierShopName || '—',
            item.supplierOrderNo || (item.supplierOrderId ? `#${item.supplierOrderId}` : 'Direct'),
            formatCurrency(item.amount),
            formatCurrency(item.payment),
            formatCurrency(item.supplierPreviousBalance),
            formatCurrency(item.supplierNewBalance)
        ]);

        doc.autoTable({
            head: head,
            body: body,
            startY: 75,
            theme: 'striped',
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            bodyStyles: {
                fontSize: 8.5,
                cellPadding: 5
            },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 100 },
                2: { cellWidth: 110 },
                3: { cellWidth: 100 },
                4: { cellWidth: 80 },
                5: { halign: 'right', cellWidth: 75 },
                6: { halign: 'right', cellWidth: 75 },
                7: { halign: 'right', cellWidth: 75 },
                8: { halign: 'right', cellWidth: 75 }
            },
            didParseCell: function(data) {
                if (data.section === 'head' && [5, 6, 7, 8].includes(data.column.index)) {
                    data.cell.styles.halign = 'right';
                }
            },
            margin: { left: 40, right: 40 }
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`Supplier_Transaction_Log_${dateStr}.pdf`);
        showToast('PDF report downloaded successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to PDF:', e);
        showToast('Failed to export to PDF.', 'danger');
    }
}

