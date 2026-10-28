/* ==========================================================================
   Business Solution Client - Supplier Payments JavaScript
   Handles listing, filtering, pagination, KPI stats, payment voucher modal,
   delete payment, and exports (PDF / Excel) for Supplier Payments.
   API: 
     - GET /api/SupplierPayments/GetAll?SearchTerm=...&SupplierId=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
     - DELETE /api/SupplierPayments/{id}
   Note: All query parameters are optional.
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let supplierId = '';
let fromDate = '';
let toDate = '';
let totalCount = 0;
let totalPages = 1;
let paymentsList = [];
let currentSelectedPayment = null;
let paymentDetailsModalInstance = null;
let deletePaymentModalInstance = null;
let deletePaymentId = null;
let searchDebounceTimer = null;

// Sample fallback supplier payments matching GET /api/SupplierPayments/GetAll response
const SAMPLE_PAYMENTS_DATA = [
    {
        supplierId: 6,
        supplierName: "Monir Hossain",
        supplierShopName: "Modina Clothing",
        payment: 5000,
        remarks: "Advance Settlement",
        transactionNo: "20261028-c848c74913",
        transactionDate: "2026-10-28T15:16:21.174",
        supplierPreviousBalance: -13000,
        supplierNewBalance: -18000,
        id: 7,
        createdOn: "2026-10-28T22:48:03.3190934", // Within 2 days -> Delete button visible
        updatedOn: "2026-10-28T22:48:03.3190961",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 6,
        supplierName: "Monir Hossain",
        supplierShopName: "Modina Clothing",
        payment: 5000,
        remarks: "Invoice Payment #INV-1029",
        transactionNo: "20261028-e2b7f28b92",
        transactionDate: "2026-10-28T15:16:21.174",
        supplierPreviousBalance: -8000,
        supplierNewBalance: -13000,
        id: 6,
        createdOn: "2026-10-28T22:47:22.3908373", // Within 2 days -> Delete button visible
        updatedOn: "2026-10-28T22:47:22.3912689",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 5,
        supplierName: "Md Rejaul Karim",
        supplierShopName: "Lulu Fashion",
        payment: 10000,
        remarks: "Fabric Payment Settlement",
        transactionNo: "20261026-a48e71b29c",
        transactionDate: "2026-10-26T14:15:22.000",
        supplierPreviousBalance: 54000,
        supplierNewBalance: 44000,
        id: 5,
        createdOn: "2026-10-25T14:15:22.1245678", // 4 days ago -> Delete button HIDDEN
        updatedOn: "2026-10-25T14:15:22.1245678",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 1,
        supplierName: "Md Abdul Wadud",
        supplierShopName: "Makka Cap House-2",
        payment: 4000,
        remarks: "Order Partial Payment",
        transactionNo: "20261025-b87f21a41e",
        transactionDate: "2026-10-25T11:30:00.000",
        supplierPreviousBalance: 54000,
        supplierNewBalance: 50000,
        id: 4,
        createdOn: "2026-10-20T11:30:00.0000000", // 9 days ago -> Delete button HIDDEN
        updatedOn: "2026-10-20T11:30:00.0000000",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

// Document Ready Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupplierPaymentsPage);
} else {
    initSupplierPaymentsPage();
}

/**
 * Initializes page components, URL query params, and fetches records
 */
function initSupplierPaymentsPage() {
    parseUrlParameters();
    ensureDeleteModal();
    initPaymentEvents();
    loadSupplierPayments();
}

/**
 * Reads any query parameters passed via URL (e.g. ?SearchTerm=...&SupplierId=...&FromDate=...)
 */
function parseUrlParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('SearchTerm')) searchTerm = urlParams.get('SearchTerm') || '';
        else if (urlParams.has('searchTerm')) searchTerm = urlParams.get('searchTerm') || '';

        if (urlParams.has('SupplierId')) supplierId = urlParams.get('SupplierId') || '';
        else if (urlParams.has('supplierId')) supplierId = urlParams.get('supplierId') || '';

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
 * Checks if a given date string is strictly within 2 days of current time.
 * Rule: Delete button is visible ONLY if createdOn is within 2 days (<= 48 hours and calendar day diff <= 2).
 */
function isWithinTwoDays(createdOnStr) {
    if (!createdOnStr) return false;
    try {
        // Strip out excessive microsecond digits if present for reliable parsing
        const cleaned = String(createdOnStr).trim().replace(/(\.\d{3})\d+/, '$1');
        const createdDate = new Date(cleaned);
        if (isNaN(createdDate.getTime())) return false;

        const now = new Date();
        const diffMs = now.getTime() - createdDate.getTime();

        // 48 hours in milliseconds = 2 days
        const twoDaysMs = 48 * 60 * 60 * 1000;

        // If older than 48 hours, it has exceeded 2 days -> FALSE
        if (diffMs > twoDaysMs) {
            return false;
        }

        // Allow at most 10 minutes future clock drift
        if (diffMs < -600000) {
            return false;
        }

        // Calendar day difference: If created 3 or more calendar days ago -> FALSE
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const createdDateOnly = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const calendarDaysDiff = Math.floor((nowDateOnly.getTime() - createdDateOnly.getTime()) / (1000 * 60 * 60 * 24));
        if (calendarDaysDiff > 2) {
            return false;
        }

        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Format date string into user-friendly localized format (e.g. 28 Oct 2026)
 * Note: Time portion is omitted to keep the table clean.
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
 * Format date string with time (e.g. 28 Oct 2026, 03:16 PM) for modal/voucher view
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
 * Format number into currency format without currency symbol (e.g. 5,000.00)
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Safely extract remarks text from item supporting various backend casings
 */
function getRemarksText(item) {
    if (!item) return '';
    let val = '';
    if (item.remarks !== undefined && item.remarks !== null) val = item.remarks;
    else if (item.Remarks !== undefined && item.Remarks !== null) val = item.Remarks;
    else if (item.notes !== undefined && item.notes !== null) val = item.notes;
    else if (item.Notes !== undefined && item.Notes !== null) val = item.Notes;
    else if (item.remark !== undefined && item.remark !== null) val = item.remark;
    else if (item.Remark !== undefined && item.Remark !== null) val = item.Remark;
    return String(val).trim();
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
 * Ensures the Delete Payment Confirmation modal exists in DOM and is properly bound
 */
function ensureDeleteModal() {
    let modalEl = document.getElementById('deletePaymentModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = 'deletePaymentModal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-labelledby', 'deletePaymentModalLabel');
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header border-bottom-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold text-danger d-flex align-items-center gap-2" id="deletePaymentModalLabel">
                            <i class="bi bi-exclamation-triangle-fill"></i> Confirm Deletion
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="mb-2 text-dark">Are you sure you want to delete supplier payment <strong id="delete-payment-ref" class="text-danger font-monospace"></strong> (ID: #<span id="delete-payment-id"></span>)?</p>
                        <p class="text-muted small mb-0">This action cannot be undone and will permanently remove this payment record from the system.</p>
                        <div id="delete-payment-error" class="alert alert-danger d-none mt-3 mb-0 rounded-3 py-2 px-3 small align-items-center gap-2" role="alert">
                            <i class="bi bi-exclamation-circle-fill"></i>
                            <span id="delete-payment-error-text">Failed to delete payment.</span>
                        </div>
                    </div>
                    <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                        <button type="button" class="btn btn-light border rounded-3 px-3" data-bs-dismiss="modal" id="btn-cancel-delete-payment">Cancel</button>
                        <button type="button" class="btn btn-danger rounded-3 px-4 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm" id="btn-confirm-delete-payment">
                            <i class="bi bi-trash-fill"></i>
                            <span id="btn-confirm-delete-payment-text">Delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const confirmBtn = document.getElementById('btn-confirm-delete-payment');
    if (confirmBtn && !confirmBtn.dataset.bound) {
        confirmBtn.dataset.bound = 'true';
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            executeDeletePayment();
        });
    }

    return modalEl;
}

/**
 * Initializes event listeners for form controls, exports, and modals
 */
function initPaymentEvents() {
    const filterForm = document.getElementById('payment-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const retryBtn = document.getElementById('btn-retry-api');
    const refreshBtn = document.getElementById('btn-refresh-payments');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');

    // Bootstrap Modal Instances
    const modalEl = document.getElementById('paymentDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            paymentDetailsModalInstance = new bootstrap.Modal(modalEl);
        } catch (e) {
            console.warn('Could not initialize paymentDetailsModal bootstrap instance:', e);
        }
    }

    ensureDeleteModal();

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
            }, 400);
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
            fromDate = '';
            toDate = '';
            currentPage = 1;

            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }

            loadSupplierPayments();
        });
    }

    // Page Size Selector
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadSupplierPayments();
        });
    }

    // Retry & Refresh Buttons
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            loadSupplierPayments();
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadSupplierPayments();
            showToast('Refreshed supplier payments.', 'info');
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
    loadSupplierPayments();
}

/**
 * Fetches supplier payments from API:
 * GET /api/SupplierPayments/GetAll?SearchTerm=...&SupplierId=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
 * Note: All parameters are optional.
 */
async function loadSupplierPayments() {
    const tableBody = document.getElementById('payments-table-body');
    const emptyState = document.getElementById('payments-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Reset alert & empty state
    if (apiErrorAlert) {
        apiErrorAlert.classList.add('d-none');
        apiErrorAlert.classList.remove('d-flex');
    }
    if (emptyState) emptyState.classList.add('d-none');

    // Show loading skeleton (7 columns matching the 7 table headers)
    tableBody.innerHTML = `
        <tr id="payments-loading-row">
            <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching supplier payments...</div>
            </td>
        </tr>
    `;

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

    // Build URLSearchParams - only append parameters that have values
    const queryParams = new URLSearchParams();

    if (searchTerm && searchTerm.trim() !== '') {
        queryParams.append('SearchTerm', searchTerm.trim());
    }
    if (supplierId && supplierId.toString().trim() !== '') {
        queryParams.append('SupplierId', supplierId.toString().trim());
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
    const endpoint = queryString ? `${baseUrl}/SupplierPayments/GetAll?${queryString}` : `${baseUrl}/SupplierPayments/GetAll`;

    try {
        console.log('Fetching Supplier Payments from:', endpoint);
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
        console.log('Supplier Payments API Response:', result);

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

        paymentsList = items;
        renderPaymentsTable(paymentsList);
        updateKpiCards(paymentsList, totalCount);
        renderPaginationInfo(paymentsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();

    } catch (err) {
        console.warn('API error while fetching supplier payments:', err.message);

        // Display notice and provide fallback sample payments for preview
        if (apiErrorAlert && apiErrorMsg) {
            apiErrorMsg.innerText = `Backend Notice: ${err.message}. Showing sample supplier payments below for preview.`;
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }

        // Filter sample data based on current inputs
        let filteredSample = SAMPLE_PAYMENTS_DATA.filter(item => {
            let match = true;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const sName = (item.supplierName || '').toLowerCase();
                const shop = (item.supplierShopName || '').toLowerCase();
                const tx = (item.transactionNo || '').toLowerCase();
                const rem = getRemarksText(item).toLowerCase();
                if (!sName.includes(term) && !shop.includes(term) && !tx.includes(term) && !rem.includes(term)) {
                    match = false;
                }
            }
            if (supplierId && item.supplierId != supplierId) {
                match = false;
            }
            if (fromDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').substring(0, 10);
                if (itemDate && itemDate < fromDate) match = false;
            }
            if (toDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').substring(0, 10);
                if (itemDate && itemDate > toDate) match = false;
            }
            return match;
        });

        paymentsList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderPaymentsTable(paymentsList);
        updateKpiCards(paymentsList, totalCount);
        renderPaginationInfo(paymentsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();
    }
}

/**
 * Updates KPI Summary Stat Cards at the top of the page
 */
function updateKpiCards(items, totalRecordsCount) {
    const totalRecordsEl = document.getElementById('stat-total-records');
    const totalPaymentEl = document.getElementById('stat-total-payment');
    const avgPaymentEl = document.getElementById('stat-avg-payment');
    const maxPaymentEl = document.getElementById('stat-max-payment');

    if (totalRecordsEl) {
        totalRecordsEl.innerText = Number(totalRecordsCount).toLocaleString('en-US');
    }

    let sumPayment = 0;
    let maxPayment = 0;

    items.forEach(item => {
        const p = Number(item.payment || 0);
        sumPayment += p;
        if (p > maxPayment) maxPayment = p;
    });

    const avgPayment = items.length > 0 ? (sumPayment / items.length) : 0;

    if (totalPaymentEl) totalPaymentEl.innerText = `৳ ${formatCurrency(sumPayment)}`;
    if (avgPaymentEl) avgPaymentEl.innerText = `৳ ${formatCurrency(avgPayment)}`;
    if (maxPaymentEl) maxPaymentEl.innerText = `৳ ${formatCurrency(maxPayment)}`;
}

/**
 * Renders payment rows into table body
 * Design, fonts, and text sizes strictly mirror TransactionLog tables:
 * - Date: fw-semibold text-dark
 * - Transaction Ref: bg-light text-dark border font-monospace px-2 py-1 transaction-ref-badge
 * - Supplier: avatar-circle-sm (36x36), fw-bold text-dark, small shop badge (0.72rem)
 * - Remarks: clearly visible text-secondary small fw-medium
 * - Payment: fw-bold text-success font-monospace
 * - Balance Flow: text-muted font-monospace small -> fw-bold font-monospace ${balColorClass}
 * - Action Column: Preview button + Delete button (icon-only, visible ONLY if createdOn is within 2 days)
 */
function renderPaymentsTable(items) {
    const tableBody = document.getElementById('payments-table-body');
    const emptyState = document.getElementById('payments-empty-state');
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
        const remarksText = getRemarksText(item);
        const payment = Number(item.payment || 0);
        const prevBal = Number(item.supplierPreviousBalance || 0);
        const newBal = Number(item.supplierNewBalance || 0);

        // Check strictly whether createdOn is within 2 days for conditional Delete button visibility
        const createdOnRaw = item.createdOn || item.CreatedOn || item.createdDate || item.CreatedDate || item.createdAt || item.CreatedAt;
        const canDelete = isWithinTwoDays(createdOnRaw);

        // Initials for avatar matching TransactionLog
        const initials = supplierName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SP';

        // Balance direction styling matching TransactionLog
        const balanceIncreased = newBal > prevBal;
        const balanceDecreased = newBal < prevBal;
        const balColorClass = balanceIncreased ? 'text-primary' : (balanceDecreased ? 'text-success' : 'text-dark');

        html += `
            <tr class="payment-row" data-id="${id}">
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

                <!-- Remarks (Clearly visible text) -->
                <td>
                    ${remarksText ? `
                        <span class="text-secondary small fw-medium d-inline-block text-truncate" style="max-width: 180px;" title="${escapeHtml(remarksText)}">
                            ${escapeHtml(remarksText)}
                        </span>
                    ` : `
                        <span class="text-muted small">—</span>
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

                <!-- Balance Flow -->
                <td class="text-center">
                    <div class="balance-flow-box justify-content-center">
                        <span class="text-muted font-monospace small" title="Previous Balance">${formatCurrency(prevBal)}</span>
                        <i class="bi bi-arrow-right text-secondary small"></i>
                        <span class="fw-bold font-monospace ${balColorClass}" title="New Balance">${formatCurrency(newBal)}</span>
                    </div>
                </td>

                <!-- Action (Preview + Delete icon only within 2 days) -->
                <td class="pe-4 text-end">
                    <div class="d-inline-flex align-items-center justify-content-end gap-1">
                        <button type="button" class="btn btn-outline-primary btn-sm rounded-2 d-inline-flex align-items-center gap-1 px-2 py-1 btn-preview-payment" onclick="viewPaymentDetails(${id})" title="Preview Payment Voucher">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        ${canDelete ? `
                            <button type="button" class="btn btn-outline-danger btn-sm rounded-2 px-2 py-1 d-inline-flex align-items-center justify-content-center btn-delete-payment" onclick="confirmDeletePayment(${id}, '${escapeHtml(transNo)}')" title="Delete Payment">
                                <i class="bi bi-trash-fill"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

/**
 * Updates active filter badge pills under the filter bar
 */
function updateActiveFilterBadges() {
    const container = document.getElementById('active-filter-badges');
    if (!container) return;

    let badges = [];

    if (searchTerm) {
        badges.push(`
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1">
                <span>Keyword: <strong>${escapeHtml(searchTerm)}</strong></span>
                <i class="bi bi-x ms-1" role="button" onclick="clearSpecificFilter('search')"></i>
            </span>
        `);
    }

    if (supplierId) {
        badges.push(`
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1">
                <span>Supplier ID: <strong>#${escapeHtml(supplierId)}</strong></span>
                <i class="bi bi-x ms-1" role="button" onclick="clearSpecificFilter('supplier')"></i>
            </span>
        `);
    }

    if (fromDate) {
        badges.push(`
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1">
                <span>From: <strong>${formatDate(fromDate)}</strong></span>
                <i class="bi bi-x ms-1" role="button" onclick="clearSpecificFilter('fromDate')"></i>
            </span>
        `);
    }

    if (toDate) {
        badges.push(`
            <span class="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1">
                <span>To: <strong>${formatDate(toDate)}</strong></span>
                <i class="bi bi-x ms-1" role="button" onclick="clearSpecificFilter('toDate')"></i>
            </span>
        `);
    }

    if (badges.length > 0) {
        container.innerHTML = `
            <span class="text-muted small me-1">Active Filters:</span>
            ${badges.join('')}
            <button type="button" class="btn btn-link btn-sm text-danger p-0 ms-1 text-decoration-none small" onclick="document.getElementById('btn-reset').click()">Clear All</button>
        `;
        container.classList.remove('d-none');
    } else {
        container.innerHTML = '';
        container.classList.add('d-none');
    }
}

/**
 * Clears an individual active filter
 */
window.clearSpecificFilter = function(filterType) {
    if (filterType === 'search') {
        const el = document.getElementById('search-input');
        if (el) el.value = '';
        searchTerm = '';
    } else if (filterType === 'supplier') {
        supplierId = '';
    } else if (filterType === 'fromDate') {
        const el = document.getElementById('from-date-input');
        if (el) el.value = '';
        fromDate = '';
    } else if (filterType === 'toDate') {
        const el = document.getElementById('to-date-input');
        if (el) el.value = '';
        toDate = '';
    }
    currentPage = 1;
    loadSupplierPayments();
};

/**
 * Renders pagination info: "Showing X to Y of Z entries"
 */
function renderPaginationInfo(renderedCount, totalItems, currentPg) {
    const infoEl = document.getElementById('pagination-info');
    if (!infoEl) return;

    if (totalItems === 0) {
        infoEl.innerText = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const start = (currentPg - 1) * pageSize + 1;
    const end = Math.min(start + renderedCount - 1, totalItems);

    infoEl.innerText = `Showing ${start} to ${end} of ${totalItems} entries`;
}

/**
 * Renders dynamic pagination navigation buttons
 */
function renderPaginationControls(currentPg, totalPgs) {
    const listEl = document.getElementById('pagination-list');
    if (!listEl) return;

    if (totalPgs <= 1) {
        listEl.innerHTML = '';
        return;
    }

    let html = '';

    // Previous Button
    const prevDisabled = currentPg <= 1 ? 'disabled' : '';
    html += `
        <li class="page-item ${prevDisabled}">
            <button class="page-link rounded-2" onclick="navigateToPage(${currentPg - 1})" aria-label="Previous">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    // Dynamic Page Number Window
    const maxButtons = 5;
    let startPage = Math.max(1, currentPg - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPgs, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `
            <li class="page-item">
                <button class="page-link rounded-2" onclick="navigateToPage(1)">1</button>
            </li>
        `;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link border-0">…</span></li>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === currentPg ? 'active' : '';
        html += `
            <li class="page-item ${activeClass}">
                <button class="page-link rounded-2" onclick="navigateToPage(${p})">${p}</button>
            </li>
        `;
    }

    if (endPage < totalPgs) {
        if (endPage < totalPgs - 1) {
            html += `<li class="page-item disabled"><span class="page-link border-0">…</span></li>`;
        }
        html += `
            <li class="page-item">
                <button class="page-link rounded-2" onclick="navigateToPage(${totalPgs})">${totalPgs}</button>
            </li>
        `;
    }

    // Next Button
    const nextDisabled = currentPg >= totalPgs ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <button class="page-link rounded-2" onclick="navigateToPage(${currentPg + 1})" aria-label="Next">
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
    loadSupplierPayments();
};

/**
 * Opens delete confirmation modal for the selected supplier payment
 * Verifies that the payment is strictly within 2 days before allowing deletion.
 */
window.confirmDeletePayment = function(id, transNo) {
    const targetPayment = paymentsList.find(p => String(p.id || p.Id) === String(id));
    if (targetPayment) {
        const createdOnRaw = targetPayment.createdOn || targetPayment.CreatedOn || targetPayment.createdDate || targetPayment.CreatedDate || targetPayment.createdAt || targetPayment.CreatedAt;
        if (!isWithinTwoDays(createdOnRaw)) {
            showToast('Payments older than 2 days cannot be deleted.', 'warning');
            return;
        }
    }

    deletePaymentId = id;

    // Ensure modal DOM elements exist
    ensureDeleteModal();

    const refEl = document.getElementById('delete-payment-ref');
    const idEl = document.getElementById('delete-payment-id');
    const errEl = document.getElementById('delete-payment-error');

    if (refEl) refEl.innerText = transNo || `PAY-#${id}`;
    if (idEl) idEl.innerText = id;
    if (errEl) {
        errEl.classList.add('d-none');
        errEl.classList.remove('d-flex');
    }

    const modalEl = document.getElementById('deletePaymentModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        deletePaymentModalInstance = bootstrap.Modal.getOrCreateInstance
            ? bootstrap.Modal.getOrCreateInstance(modalEl)
            : (bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl));
        deletePaymentModalInstance.show();
    } else {
        // Fallback confirmation prompt if Bootstrap Modal is unavailable
        if (window.confirm(`Are you sure you want to delete supplier payment ${transNo || '#' + id}? This action cannot be undone.`)) {
            executeDeletePayment();
        }
    }
};

/**
 * Executes delete request to backend API: DELETE /api/SupplierPayments/{id}
 * Expected Response: { message: "...", succeeded: true, statusCode: 200, data: true }
 */
async function executeDeletePayment() {
    if (!deletePaymentId) return;

    const targetId = deletePaymentId;
    const btnConfirm = document.getElementById('btn-confirm-delete-payment');
    const btnText = document.getElementById('btn-confirm-delete-payment-text');
    const errEl = document.getElementById('delete-payment-error');

    if (errEl) {
        errEl.classList.add('d-none');
        errEl.classList.remove('d-flex');
    }

    if (btnConfirm) btnConfirm.disabled = true;
    if (btnText) btnText.innerText = 'Deleting...';

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    const endpoint = `${baseUrl}/SupplierPayments/${targetId}`;

    try {
        console.log('Sending DELETE request to:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: headers
        });

        let resData = null;
        try {
            resData = await response.json();
            console.log('Delete Supplier Payment API Response:', resData);
        } catch (_) { }

        if (response.status === 401) {
            throw new Error('Unauthorized (401). Please sign in with an authorized account.');
        }

        let isDeleted = false;
        if (response.ok) {
            if (!resData) {
                isDeleted = true;
            } else if (typeof resData.succeeded === 'boolean') {
                isDeleted = resData.succeeded;
            } else if (typeof resData.Succeeded === 'boolean') {
                isDeleted = resData.Succeeded;
            } else if (resData.data === true || resData.Data === true) {
                isDeleted = true;
            } else if (resData.statusCode && (resData.statusCode < 200 || resData.statusCode >= 300)) {
                isDeleted = false;
            } else {
                isDeleted = true;
            }
        } else {
            isDeleted = false;
        }

        const serverMessage = (resData && (resData.message || resData.Message))
            ? (resData.message || resData.Message)
            : (isDeleted ? 'Supplier payment deleted successfully.' : `Failed to delete supplier payment (Status ${response.status}).`);

        // Close modal
        if (deletePaymentModalInstance) {
            deletePaymentModalInstance.hide();
        }
        const modalEl = document.getElementById('deletePaymentModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst) inst.hide();
        }

        if (isDeleted) {
            // Remove from local sample fallback data if present
            const sampleIdx = SAMPLE_PAYMENTS_DATA.findIndex(p => String(p.id) === String(targetId));
            if (sampleIdx !== -1) {
                SAMPLE_PAYMENTS_DATA.splice(sampleIdx, 1);
            }

            showToast(serverMessage, 'success');
            loadSupplierPayments();
        } else {
            showToast(serverMessage, 'danger');
        }

    } catch (err) {
        console.warn('API delete supplier payment error, checking sample fallback:', err);

        // Close modal
        if (deletePaymentModalInstance) {
            deletePaymentModalInstance.hide();
        }
        const modalEl = document.getElementById('deletePaymentModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst) inst.hide();
        }

        // If in sample fallback mode (offline or 401), allow preview delete
        const sampleIdx = SAMPLE_PAYMENTS_DATA.findIndex(p => String(p.id) === String(targetId));
        const isNetworkOrAuth = err.message.includes('401') ||
                                err.message.includes('Failed to fetch') ||
                                err.message.includes('NetworkError') ||
                                err.message.includes('Network connection');

        if (sampleIdx !== -1 && isNetworkOrAuth) {
            SAMPLE_PAYMENTS_DATA.splice(sampleIdx, 1);
            showToast('Supplier payment deleted successfully.', 'success');
            loadSupplierPayments();
        } else {
            showToast(err.message || 'Failed to delete supplier payment.', 'danger');
        }
    } finally {
        if (btnConfirm) btnConfirm.disabled = false;
        if (btnText) btnText.innerText = 'Delete';
        deletePaymentId = null;
    }
}

/**
 * Open Payment Details Voucher Modal
 */
window.viewPaymentDetails = function(paymentId) {
    const item = paymentsList.find(p => p.id === paymentId) || SAMPLE_PAYMENTS_DATA.find(p => p.id === paymentId);
    if (!item) {
        showToast('Payment record details not found.', 'warning');
        return;
    }

    currentSelectedPayment = item;

    const modalTransNoEl = document.getElementById('modal-payment-trans-no');
    const modalContentEl = document.getElementById('modal-payment-details-content');

    if (modalTransNoEl) {
        modalTransNoEl.innerText = item.transactionNo || `PAY-#${item.id}`;
    }

    if (modalContentEl) {
        const supplierName = item.supplierName || 'N/A';
        const shopName = item.supplierShopName || 'N/A';
        const prevBal = Number(item.supplierPreviousBalance || 0);
        const newBal = Number(item.supplierNewBalance || 0);
        const payment = Number(item.payment || 0);
        const remarksText = getRemarksText(item) || 'None';
        const dateFormatted = formatDateTime(item.transactionDate || item.createdOn);

        modalContentEl.innerHTML = `
            <div class="row g-3 mb-4">
                <!-- Supplier Info Card -->
                <div class="col-12 col-md-4">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-primary">
                            <i class="bi bi-truck fs-5"></i>
                            <span class="fw-semibold">Supplier</span>
                        </div>
                        <h6 class="fw-bold text-dark mb-1">${escapeHtml(supplierName)}</h6>
                        <div class="text-muted small mb-1">
                            <i class="bi bi-shop me-1"></i> ${escapeHtml(shopName)}
                        </div>
                        <div class="text-muted small">
                            Supplier ID: <span class="fw-semibold text-dark">#${item.supplierId || '—'}</span>
                        </div>
                    </div>
                </div>

                <!-- Financial Settlement Card -->
                <div class="col-12 col-md-4">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-success">
                            <i class="bi bi-cash-stack fs-5"></i>
                            <span class="fw-semibold">Settlement Summary</span>
                        </div>
                        <div class="d-flex justify-content-between text-muted small mb-1">
                            <span>Old Balance:</span>
                            <span class="font-monospace text-dark">৳ ${formatCurrency(prevBal)}</span>
                        </div>
                        <div class="d-flex justify-content-between fw-bold fs-6 mb-1 text-success">
                            <span>Paid Amount:</span>
                            <span class="font-monospace">৳ ${formatCurrency(payment)}</span>
                        </div>
                        <div class="d-flex justify-content-between text-muted small border-top pt-1">
                            <span>New Balance:</span>
                            <span class="font-monospace fw-semibold text-dark">৳ ${formatCurrency(newBal)}</span>
                        </div>
                    </div>
                </div>

                <!-- Transaction Info Card -->
                <div class="col-12 col-md-4">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-info">
                            <i class="bi bi-info-circle fs-5"></i>
                            <span class="fw-semibold">Information</span>
                        </div>
                        <div class="text-muted small mb-1">
                            Date: <span class="fw-medium text-dark">${dateFormatted}</span>
                        </div>
                        <div class="text-muted small mb-1">
                            Payment ID: <span class="fw-medium text-dark">#${item.id}</span>
                        </div>
                        <div class="text-muted small">
                            Notes: <span class="badge bg-white text-dark border fw-normal">${escapeHtml(remarksText)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Transaction Detail Overview -->
            <div class="card border rounded-3 overflow-hidden">
                <div class="card-header bg-white py-2 px-3 fw-semibold small text-uppercase text-secondary">
                    <i class="bi bi-receipt me-1"></i> Voucher Specifications
                </div>
                <div class="card-body p-0">
                    <table class="table table-bordered mb-0 small">
                        <tbody>
                            <tr>
                                <th class="bg-light text-secondary" style="width: 25%;">Transaction Reference</th>
                                <td class="font-monospace">${escapeHtml(item.transactionNo || '—')}</td>
                                <th class="bg-light text-secondary" style="width: 25%;">Status</th>
                                <td><span class="badge bg-success-subtle text-success">Completed</span></td>
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary">Supplier Name</th>
                                <td>${escapeHtml(supplierName)}</td>
                                <th class="bg-light text-secondary">Shop / Outlet</th>
                                <td>${escapeHtml(shopName)}</td>
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary">Disbursed Amount</th>
                                <td class="fw-bold text-success font-monospace">৳ ${formatCurrency(payment)}</td>
                                <th class="bg-light text-secondary">Updated Balance</th>
                                <td class="font-monospace fw-semibold">${formatCurrency(newBal)}</td>
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary">Remarks</th>
                                <td colspan="3">${escapeHtml(remarksText)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
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
};

/**
 * Export current payments list to Excel using SheetJS
 */
function exportToExcel() {
    if (!paymentsList || paymentsList.length === 0) {
        showToast('No payment data to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel export library not loaded. Please try again.', 'danger');
        return;
    }

    try {
        const exportData = paymentsList.map(item => ({
            "Transaction Ref": item.transactionNo || '',
            "Date": formatDate(item.transactionDate || item.createdOn),
            "Supplier Name": item.supplierName || '',
            "Supplier Shop": item.supplierShopName || '',
            "Remarks": getRemarksText(item),
            "Payment (BDT)": Number(item.payment || 0),
            "Previous Balance (BDT)": Number(item.supplierPreviousBalance || 0),
            "New Balance (BDT)": Number(item.supplierNewBalance || 0),
            "Created Date": item.createdOn ? formatDateTime(item.createdOn) : ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Supplier Payments");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Supplier_Payments_${dateStr}.xlsx`);
        showToast('Excel report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to Excel:', e);
        showToast('Failed to export to Excel.', 'danger');
    }
}

/**
 * Export current payments list to PDF using jsPDF + autoTable
 * Note: Table headers and columns are properly aligned (numeric columns right-aligned).
 */
function exportToPdf() {
    if (!paymentsList || paymentsList.length === 0) {
        showToast('No payment data to export.', 'warning');
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
        doc.text("Supplier Payments Report", 40, 45);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        doc.text(`Generated on: ${nowStr} | Total Records: ${paymentsList.length}`, 40, 62);

        // Build Table Rows with right-aligned numeric headers
        const head = [[
            "Date",
            "Transaction Ref",
            "Supplier",
            "Shop",
            "Remarks",
            { content: "Payment", styles: { halign: 'right' } },
            { content: "Prev Bal", styles: { halign: 'right' } },
            { content: "New Bal", styles: { halign: 'right' } }
        ]];

        const body = paymentsList.map(item => [
            formatDate(item.transactionDate || item.createdOn),
            item.transactionNo || '—',
            item.supplierName || '—',
            item.supplierShopName || '—',
            getRemarksText(item) || '—',
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
                1: { cellWidth: 105 },
                2: { cellWidth: 110 },
                3: { cellWidth: 100 },
                4: { cellWidth: 95 },
                5: { halign: 'right', cellWidth: 80 },
                6: { halign: 'right', cellWidth: 80 },
                7: { halign: 'right', cellWidth: 80 }
            },
            didParseCell: function(data) {
                // Ensure header cells for numeric columns are strictly right-aligned
                if (data.section === 'head' && [5, 6, 7].includes(data.column.index)) {
                    data.cell.styles.halign = 'right';
                }
            },
            margin: { left: 40, right: 40 }
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`Supplier_Payments_${dateStr}.pdf`);
        showToast('PDF report downloaded successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to PDF:', e);
        showToast('Failed to export to PDF.', 'danger');
    }
}
