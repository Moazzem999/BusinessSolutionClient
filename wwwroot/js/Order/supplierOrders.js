/* ==========================================================================
   Business Solution Client - Supplier Orders List JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let fromDate = '';
let toDate = '';
let totalCount = 0;
let totalPages = 1;
let ordersList = [];
let orderDetailsModalInstance = null;
let searchDebounceTimer = null;

// Sample fallback orders matching the API schema
const SAMPLE_ORDERS_DATA = [
    {
        supplierId: 1,
        supplierName: "Md Abdul Wadud",
        supplierShopName: "Makka Cap House-2",
        orderNo: "PO-2026-0000002",
        orderDate: "2026-10-18T00:00:00",
        totalAmount: 200,
        notes: "Deliver before 5 PM",
        supplierPreviousBalance: 50300,
        supplierNewBalance: 50500,
        orderDetails: [
            {
                supplierOrderId: 12,
                productId: 3,
                productName: "Trouser",
                remarks: "Regular fit",
                quantity: 1,
                unitPrice: 100,
                lineTotal: 100,
                id: 19,
                createdOn: "2026-10-18T18:56:53.3367322",
                updatedOn: "2026-10-18T20:16:11.1859271",
                createdBy: 1,
                updatedBy: 1,
                status: 1
            },
            {
                supplierOrderId: 12,
                productId: 4,
                productName: "Suif Shirt",
                remarks: "Full sleeve",
                quantity: 1,
                unitPrice: 100,
                lineTotal: 100,
                id: 20,
                createdOn: "2026-10-18T18:56:53.3367333",
                updatedOn: "2026-10-18T20:16:11.1859356",
                createdBy: 1,
                updatedBy: 1,
                status: 1
            }
        ],
        id: 12,
        createdOn: "2026-10-18T18:56:53.3334024",
        updatedOn: "2026-10-18T20:23:14.3030369",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        supplierId: 1,
        supplierName: "Md Abdul Wadud",
        supplierShopName: "Makka Cap House-2",
        orderNo: "PO-2026-0000001",
        orderDate: "2026-10-18T00:00:00",
        totalAmount: 300,
        notes: "Urgent shipment",
        supplierPreviousBalance: 50000,
        supplierNewBalance: 50300,
        orderDetails: [
            {
                supplierOrderId: 11,
                productId: 1,
                productName: "Jacket",
                remarks: "Black winter edition",
                quantity: 1,
                unitPrice: 100,
                lineTotal: 100,
                id: 17,
                createdOn: "2026-10-18T18:55:47.7571139",
                updatedOn: "2026-10-18T20:23:14.3030027",
                createdBy: 1,
                updatedBy: 1,
                status: 1
            },
            {
                supplierOrderId: 11,
                productId: 2,
                productName: "Hudi",
                remarks: "Cotton hoodie",
                quantity: 1,
                unitPrice: 100,
                lineTotal: 200,
                id: 18,
                createdOn: "2026-10-18T18:55:47.7571148",
                updatedOn: "2026-10-18T20:23:14.3030154",
                createdBy: 1,
                updatedBy: 1,
                status: 1
            }
        ],
        id: 11,
        createdOn: "2026-10-18T18:55:47.7532508",
        updatedOn: "2026-10-18T20:23:14.3029556",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

// Initialize when DOM is ready (or immediately if already loaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupplierOrdersPage);
} else {
    initSupplierOrdersPage();
}

function initSupplierOrdersPage() {
    initSupplierOrdersEvents();
    loadSupplierOrders();
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
 * Formats ISO date string to user-friendly readable date (e.g., Oct 18, 2026)
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

/**
 * Formats numbers into currency presentation (e.g. 50,300.00)
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
 * Displays a toast notification
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

    if (toastIcon) {
        toastIcon.className = `bi ${iconClass} fs-5`;
    }
    toastMsg.innerText = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
    }
}

/**
 * Initializes form listeners, filter controls, and modal instances
 */
function initSupplierOrdersEvents() {
    const searchForm = document.getElementById('orders-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const retryBtn = document.getElementById('btn-retry-api');
    const refreshBtn = document.getElementById('btn-refresh-orders');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');

    // Safely init modal
    const modalEl = document.getElementById('orderDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            orderDetailsModalInstance = new bootstrap.Modal(modalEl);
        } catch (e) {
            console.warn('Could not initialize orderDetailsModal bootstrap instance:', e);
        }
    }

    // Filter Form Submit
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    // Debounced Search Input
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
            fromDate = '';
            toDate = '';
            currentPage = 1;

            loadSupplierOrders();
        });
    }

    // Page Size Change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadSupplierOrders();
        });
    }

    // Refresh & Retry
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            loadSupplierOrders();
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadSupplierOrders();
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
 * Collects current filter form inputs and triggers reload
 */
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');

    searchTerm = searchInput ? searchInput.value.trim() : '';
    fromDate = fromDateInput ? fromDateInput.value.trim() : '';
    toDate = toDateInput ? toDateInput.value.trim() : '';

    currentPage = 1;
    loadSupplierOrders();
}

/**
 * Loads supplier orders from the backend API:
 * GET /api/SupplierOrders/GetAll?SearchTerm=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
 * Note: All parameters are optional.
 */
async function loadSupplierOrders() {
    const tableBody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('orders-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Show loading row
    if (apiErrorAlert) {
        apiErrorAlert.classList.add('d-none');
        apiErrorAlert.classList.remove('d-flex');
    }
    if (emptyState) emptyState.classList.add('d-none');

    tableBody.innerHTML = `
        <tr id="orders-loading-row">
            <td colspan="6" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching supplier orders...</div>
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
    const endpoint = queryString ? `${baseUrl}/SupplierOrders/GetAll?${queryString}` : `${baseUrl}/SupplierOrders/GetAll`;

    try {
        console.log('Fetching Supplier Orders from:', endpoint);
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
        console.log('Supplier Orders API Response:', result);

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
            } else if (Array.isArray(result)) {
                items = result;
                totalCount = items.length;
                totalPages = Math.ceil(totalCount / pageSize) || 1;
            }
        }

        ordersList = items;
        renderSupplierOrdersTable(items);
        renderPagination(totalCount, totalPages, currentPage, pageSize);

    } catch (error) {
        console.warn('API returned error or session unauthorized, using sample dataset fallback:', error);
        
        // Filter sample data based on active search filter
        let filteredSample = SAMPLE_ORDERS_DATA;
        if (searchTerm) {
            const st = searchTerm.toLowerCase();
            filteredSample = filteredSample.filter(o => 
                (o.orderNo && o.orderNo.toLowerCase().includes(st)) ||
                (o.supplierName && o.supplierName.toLowerCase().includes(st)) ||
                (o.notes && o.notes.toLowerCase().includes(st))
            );
        }

        ordersList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderSupplierOrdersTable(filteredSample);
        renderPagination(totalCount, totalPages, currentPage, pageSize);

        if (apiErrorAlert && apiErrorMsg) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                apiErrorMsg.innerHTML = `<strong>Note:</strong> ${error.message} Showing sample supplier orders. <a href="/Account/Login" class="btn btn-sm btn-outline-danger ms-2 py-0 px-2 fw-semibold">Sign In</a>`;
            } else {
                apiErrorMsg.innerHTML = `<strong>Notice:</strong> Could not connect to API server (${error.message}). Displaying sample orders.`;
            }
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }
    }
}

/**
 * Renders supplier order items in table body (Items and Status columns removed, Details is icon only)
 */
function renderSupplierOrdersTable(orders) {
    const tableBody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('orders-empty-state');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!orders || orders.length === 0) {
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    orders.forEach((order, index) => {
        const tr = document.createElement('tr');
        tr.className = 'order-row';

        const orderId = order.id || order.Id || '—';
        const orderNo = order.orderNo || order.OrderNo || `PO-${orderId}`;
        const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
        const supplierName = order.supplierName || order.SupplierName || 'Unknown Supplier';
        const supplierShopName = order.supplierShopName || order.SupplierShopName || '';
        const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
        const prevBalance = order.supplierPreviousBalance !== undefined ? order.supplierPreviousBalance : (order.SupplierPreviousBalance !== undefined ? order.SupplierPreviousBalance : 0);
        const newBalance = order.supplierNewBalance !== undefined ? order.supplierNewBalance : (order.SupplierNewBalance !== undefined ? order.SupplierNewBalance : 0);

        // Balance difference indicator
        const isIncreased = Number(newBalance) >= Number(prevBalance);

        tr.innerHTML = `
            <td class="ps-4">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-primary-subtle text-primary fw-bold font-monospace px-2.5 py-1 rounded-2">
                        ${escapeHtml(orderNo)}
                    </span>
                    <span class="text-muted small">#${escapeHtml(orderId)}</span>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center gap-2 text-dark">
                    <i class="bi bi-calendar3 text-muted small"></i>
                    <span class="fw-medium">${escapeHtml(orderDateFormatted)}</span>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="avatar-circle-sm bg-light text-primary border rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 34px; height: 34px; min-width: 34px; font-size: 0.8rem;">
                        <i class="bi bi-truck"></i>
                    </div>
                    <div>
                        <div class="fw-semibold text-dark">${escapeHtml(supplierName)}</div>
                        ${supplierShopName ? `<div class="text-muted small d-flex align-items-center gap-1"><i class="bi bi-shop small"></i> ${escapeHtml(supplierShopName)}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="fw-bold text-dark fs-6">
                    ৳ ${formatCurrency(totalAmount)}
                </div>
            </td>
            <td>
                <div class="d-flex flex-column" style="font-size: 0.85rem;">
                    <div class="text-muted d-flex align-items-center gap-1">
                        <span>Prev:</span>
                        <span>৳ ${formatCurrency(prevBalance)}</span>
                    </div>
                    <div class="fw-semibold ${isIncreased ? 'text-danger' : 'text-success'} d-flex align-items-center gap-1">
                        <span>New:</span>
                        <span>৳ ${formatCurrency(newBalance)}</span>
                        <i class="bi ${isIncreased ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}"></i>
                    </div>
                </div>
            </td>
            <td class="pe-4 text-end">
                <button type="button" class="btn btn-sm btn-outline-primary rounded-3 px-2 py-1.5 d-inline-flex align-items-center justify-content-center" onclick="viewOrderDetails(${index})" title="View Order Details" aria-label="View Details">
                    <i class="bi bi-eye-fill fs-6"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

/**
 * Opens modal with comprehensive details about the selected supplier order
 */
window.viewOrderDetails = function(orderIndex) {
    const order = ordersList[orderIndex];
    if (!order) return;

    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `PO-${orderId}`;
    const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
    const supplierName = order.supplierName || order.SupplierName || '—';
    const supplierShopName = order.supplierShopName || order.SupplierShopName || '—';
    const supplierId = order.supplierId || order.SupplierId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.supplierPreviousBalance !== undefined ? order.supplierPreviousBalance : (order.SupplierPreviousBalance !== undefined ? order.SupplierPreviousBalance : 0);
    const newBalance = order.supplierNewBalance !== undefined ? order.supplierNewBalance : (order.SupplierNewBalance !== undefined ? order.SupplierNewBalance : 0);
    const notes = order.notes || order.Notes || '';
    const details = order.orderDetails || order.OrderDetails || [];
    const status = order.status !== undefined ? order.status : (order.Status !== undefined ? order.Status : 1);

    if (modalTitleNo) {
        modalTitleNo.innerText = orderNo;
    }

    if (!modalContent) return;

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
                    <td class="text-center">
                        <span class="badge bg-light text-dark border px-2 py-1">${qty}</span>
                    </td>
                    <td class="text-end">৳ ${formatCurrency(unitPrice)}</td>
                    <td class="text-end fw-bold text-dark">৳ ${formatCurrency(lineTotal)}</td>
                    <td class="text-muted small">${escapeHtml(remarks || '—')}</td>
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
            <div class="col-12 col-md-5">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-success-subtle text-success p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-cash-stack fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Financial Summary</h6>
                    </div>
                    <div class="d-flex justify-content-between text-muted small py-1 border-bottom">
                        <span>Previous Balance:</span>
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
            <div class="col-12 col-md-3">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-info-subtle text-info p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-info-circle fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Information</h6>
                    </div>
                    <div class="text-muted small mb-1">
                        Date: <span class="fw-medium text-dark">${escapeHtml(orderDateFormatted)}</span>
                    </div>
                    <div class="text-muted small mb-2">
                        Status: ${status === 1 ? '<span class="badge bg-success-subtle text-success">Active</span>' : '<span class="badge bg-secondary-subtle text-secondary">Inactive</span>'}
                    </div>
                    <div class="text-muted small">
                        <strong>Notes:</strong>
                        <div class="p-1 rounded bg-white border mt-1 text-dark text-break" style="font-size: 0.8rem; max-height: 50px; overflow-y: auto;">
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
        <div class="table-responsive rounded-3 border mb-3">
            <table class="table table-hover align-middle mb-0">
                <thead class="bg-light">
                    <tr>
                        <th class="text-center text-secondary small fw-semibold text-uppercase" style="width: 45px;">#</th>
                        <th class="text-secondary small fw-semibold text-uppercase">Product Name</th>
                        <th class="text-center text-secondary small fw-semibold text-uppercase" style="width: 90px;">Quantity</th>
                        <th class="text-end text-secondary small fw-semibold text-uppercase" style="width: 120px;">Unit Price</th>
                        <th class="text-end text-secondary small fw-semibold text-uppercase" style="width: 130px;">Line Total</th>
                        <th class="text-secondary small fw-semibold text-uppercase" style="width: 150px;">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRows}
                </tbody>
                <tfoot class="table-light fw-bold border-top">
                    <tr>
                        <td colspan="2" class="text-end text-dark">Total:</td>
                        <td class="text-center text-dark">${totalItemsQuantity}</td>
                        <td></td>
                        <td class="text-end text-primary fs-6">৳ ${formatCurrency(totalAmount || computedLineTotals)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    if (orderDetailsModalInstance) {
        orderDetailsModalInstance.show();
    } else {
        const modalEl = document.getElementById('orderDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }
};

/**
 * Renders pagination controls and entries indicator
 */
function renderPagination(total, pages, current, size) {
    const paginationInfo = document.getElementById('pagination-info');
    const paginationList = document.getElementById('pagination-list');
    if (!paginationInfo || !paginationList) return;

    if (total === 0) {
        paginationInfo.innerText = 'Showing 0 to 0 of 0 entries';
        paginationList.innerHTML = '';
        return;
    }

    const startEntry = (current - 1) * size + 1;
    const endEntry = Math.min(current * size, total);
    paginationInfo.innerText = `Showing ${startEntry} to ${endEntry} of ${total} entries`;

    let html = '';

    // Previous Button
    const prevDisabled = current <= 1 ? 'disabled' : '';
    html += `
        <li class="page-item ${prevDisabled}">
            <button class="page-link rounded-2 px-2.5" onclick="changePage(${current - 1})" ${prevDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    // Page Numbers logic
    const maxButtons = 5;
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(pages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<li class="page-item"><button class="page-link rounded-2 px-2.5" onclick="changePage(1)">1</button></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === current ? 'active' : '';
        html += `
            <li class="page-item ${activeClass}">
                <button class="page-link rounded-2 px-2.5" onclick="changePage(${p})">${p}</button>
            </li>
        `;
    }

    if (endPage < pages) {
        if (endPage < pages - 1) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
        html += `<li class="page-item"><button class="page-link rounded-2 px-2.5" onclick="changePage(${pages})">${pages}</button></li>`;
    }

    // Next Button
    const nextDisabled = current >= pages ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <button class="page-link rounded-2 px-2.5" onclick="changePage(${current + 1})" ${nextDisabled ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    paginationList.innerHTML = html;
}

/**
 * Page change handler invoked from pagination buttons
 */
window.changePage = function(targetPage) {
    if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage) return;
    currentPage = targetPage;
    loadSupplierOrders();
};

/**
 * Export table data to PDF using jsPDF
 */
function exportToPdf() {
    if (!ordersList || ordersList.length === 0) {
        showToast('No supplier orders available to export.', 'warning');
        return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        showToast('PDF generator library is loading. Please try again.', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text('Business Solution - Supplier Orders Report', 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Orders: ${ordersList.length}`, 14, 22);

        const tableHeaders = [['PO Number', 'Order Date', 'Supplier', 'Shop', 'Total Amount', 'Prev Balance', 'New Balance']];
        const tableRows = ordersList.map(o => [
            o.orderNo || o.OrderNo || `PO-${o.id}`,
            formatDate(o.orderDate || o.OrderDate),
            o.supplierName || o.SupplierName || '',
            o.supplierShopName || o.SupplierShopName || '',
            `BDT ${formatCurrency(o.totalAmount !== undefined ? o.totalAmount : o.TotalAmount)}`,
            `BDT ${formatCurrency(o.supplierPreviousBalance !== undefined ? o.supplierPreviousBalance : o.SupplierPreviousBalance)}`,
            `BDT ${formatCurrency(o.supplierNewBalance !== undefined ? o.supplierNewBalance : o.SupplierNewBalance)}`
        ]);

        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 28,
            theme: 'grid',
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            }
        });

        doc.save(`Supplier_Orders_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF downloaded successfully.', 'success');
    } catch (err) {
        console.error('PDF export failed:', err);
        showToast('Failed to export PDF: ' + err.message, 'danger');
    }
}

/**
 * Export table data to Excel (.xlsx) using SheetJS
 */
function exportToExcel() {
    if (!ordersList || ordersList.length === 0) {
        showToast('No supplier orders available to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel exporter library is loading. Please try again.', 'warning');
        return;
    }

    try {
        const rows = ordersList.map(o => ({
            'PO Number': o.orderNo || o.OrderNo || `PO-${o.id}`,
            'Order Date': formatDate(o.orderDate || o.OrderDate),
            'Supplier Name': o.supplierName || o.SupplierName || '',
            'Shop Name': o.supplierShopName || o.SupplierShopName || '',
            'Total Amount': Number(o.totalAmount !== undefined ? o.totalAmount : (o.TotalAmount || 0)),
            'Previous Balance': Number(o.supplierPreviousBalance !== undefined ? o.supplierPreviousBalance : (o.SupplierPreviousBalance || 0)),
            'New Balance': Number(o.supplierNewBalance !== undefined ? o.supplierNewBalance : (o.SupplierNewBalance || 0)),
            'Notes': o.notes || o.Notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SupplierOrders');

        XLSX.writeFile(wb, `Supplier_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel sheet downloaded successfully.', 'success');
    } catch (err) {
        console.error('Excel export failed:', err);
        showToast('Failed to export Excel: ' + err.message, 'danger');
    }
}
