/* ==========================================================================
   Business Solution Client - Customer Orders List JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let fromDate = '';
let toDate = '';
let totalCount = 0;
let totalPages = 1;
let ordersList = [];
let currentSelectedOrder = null;
let orderDetailsModalInstance = null;
let deleteOrderModalInstance = null;
let deleteOrderId = null;
let searchDebounceTimer = null;

// Sample fallback orders matching the API schema
const SAMPLE_CUSTOMER_ORDERS = [
    {
        id: 1,
        customerId: 5,
        customerName: "Samsul Haque",
        customerShopName: "Samsu Fashion",
        customerMobile: "01977734343",
        orderNo: "CO-2026-0000001",
        orderDate: "2026-11-01T14:45:23.317Z",
        totalAmount: 1500,
        notes: "Deliver to Jatrabari shop",
        customerPreviousBalance: 70000,
        customerNewBalance: 71500,
        createdOn: new Date().toISOString(),
        orderDetails: [
            {
                id: 1,
                customerOrderId: 1,
                productId: 1,
                productName: "Jacket",
                remarks: "Black winter edition",
                quantity: 1,
                unitPrice: 1000,
                lineTotal: 1000
            },
            {
                id: 2,
                customerOrderId: 1,
                productId: 2,
                productName: "Hudi",
                remarks: "Cotton hoodie",
                quantity: 1,
                unitPrice: 500,
                lineTotal: 500
            }
        ]
    },
    {
        id: 2,
        customerId: 5,
        customerName: "Samsul Haque",
        customerShopName: "Samsu Fashion",
        customerMobile: "01977734343",
        orderNo: "CO-2026-0000002",
        orderDate: "2026-10-31T10:30:00",
        totalAmount: 2400,
        notes: "Urgent shipment",
        customerPreviousBalance: 67600,
        customerNewBalance: 70000,
        createdOn: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        orderDetails: [
            {
                id: 3,
                customerOrderId: 2,
                productId: 3,
                productName: "Trouser",
                remarks: "Regular fit",
                quantity: 2,
                unitPrice: 1200,
                lineTotal: 2400
            }
        ]
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initCustomerOrdersPage();
});

function initCustomerOrdersPage() {
    ensureTableStructureAndModal();
    initCustomerOrdersEvents();
    loadCustomerOrders();
}

/**
 * Returns API Base URL from BSApp, window variable, or fallback
 */
function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && BSApp.apiBaseUrl) {
        return BSApp.apiBaseUrl;
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL;
    }
    return 'https://localhost:7148/api';
}

/**
 * Retrieves authentication token from cookies or localStorage
 */
function getAuthToken() {
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    const cookieToken = getCookie('bs_auth_token');
    if (cookieToken && cookieToken.trim() !== '') {
        return cookieToken.trim();
    }

    const localToken = localStorage.getItem('bs_token') || sessionStorage.getItem('bs_token') || '';
    return localToken.trim();
}

/**
 * Formats ISO date to readable display format
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
    const num = Number(amount);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Sanitizes text to prevent XSS injection in HTML output
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
 * Triggers feedback toast message
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMsg) {
        console.log(`[Toast ${type}]: ${message}`);
        return;
    }

    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-info');

    let bgClass = 'bg-primary';
    let iconClass = 'bi-info-circle-fill';

    if (type === 'success') {
        bgClass = 'bg-success';
        iconClass = 'bi-check-circle-fill';
    } else if (type === 'danger' || type === 'error') {
        bgClass = 'bg-danger';
        iconClass = 'bi-exclamation-triangle-fill';
    } else if (type === 'warning') {
        bgClass = 'bg-warning text-dark';
        iconClass = 'bi-exclamation-circle-fill';
    }

    toastEl.classList.add(bgClass);
    if (toastIcon) {
        toastIcon.className = `bi ${iconClass} fs-5`;
    }
    toastMsg.innerText = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
        toast.show();
    }
}

/**
 * Ensures table structure and modal elements exist
 */
function ensureTableStructureAndModal() {
    const tableThead = document.querySelector('.orders-list-table thead tr');
    if (tableThead) {
        tableThead.innerHTML = `
            <th class="ps-4 text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 150px;">Order No</th>
            <th class="text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 220px;">Customer</th>
            <th class="text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 140px;">Date</th>
            <th class="text-center text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 110px;">Items</th>
            <th class="text-end text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 140px;">Total Amount</th>
            <th class="pe-4 text-end text-secondary small fw-semibold text-uppercase" style="letter-spacing: 0.5px; width: 130px;">Action</th>
        `;
    }

    const existingDelModal = document.getElementById('deleteOrderModal');
    if (!existingDelModal) {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'deleteOrderModal';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-labelledby', 'deleteOrderModalLabel');
        modalDiv.setAttribute('aria-hidden', 'true');
        modalDiv.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header border-bottom-0 pb-0 pt-4 px-4">
                        <h5 class="modal-title fw-bold text-dark d-flex align-items-center gap-2" id="deleteOrderModalLabel">
                            <i class="bi bi-exclamation-triangle-fill text-danger fs-5"></i> Delete Customer Order
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="mb-2 text-dark">Are you sure you want to delete customer order <strong id="delete-order-no" class="text-danger"></strong> (ID: #<span id="delete-order-id"></span>)?</p>
                        <p class="text-muted small mb-0">This action cannot be undone and will permanently remove this customer order from the system.</p>
                        
                        <div id="delete-order-error" class="alert alert-danger d-none mt-3 mb-0 rounded-3 py-2 px-3 small align-items-center gap-2" role="alert">
                            <i class="bi bi-exclamation-circle-fill"></i>
                            <span id="delete-order-error-text">Failed to delete customer order.</span>
                        </div>
                    </div>
                    <div class="modal-footer border-top-0 pt-0 px-4 pb-4">
                        <button type="button" class="btn btn-light border rounded-3 px-3" data-bs-dismiss="modal" id="btn-cancel-delete">Cancel</button>
                        <button type="button" class="btn btn-danger rounded-3 px-4 fw-semibold d-inline-flex align-items-center gap-2" id="btn-confirm-delete-order">
                            <i class="bi bi-trash-fill"></i>
                            <span id="btn-confirm-delete-order-text">Delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }
}

/**
 * Initializes DOM events for search, reset, filters, pagination, export and delete
 */
function initCustomerOrdersEvents() {
    const filterForm = document.getElementById('orders-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const btnReset = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const btnRetryApi = document.getElementById('btn-retry-api');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');

    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            currentPage = 1;
            applyFilters();
            loadCustomerOrders();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                currentPage = 1;
                applyFilters();
                loadCustomerOrders();
            }, 400);
        });
    }

    if (fromDateInput) {
        fromDateInput.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
            loadCustomerOrders();
        });
    }

    if (toDateInput) {
        toDateInput.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
            loadCustomerOrders();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            if (pageSizeSelect) pageSizeSelect.value = '10';

            currentPage = 1;
            pageSize = 10;
            searchTerm = '';
            fromDate = '';
            toDate = '';

            loadCustomerOrders();
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            pageSize = parseInt(pageSizeSelect.value, 10) || 10;
            currentPage = 1;
            loadCustomerOrders();
        });
    }

    if (btnRetryApi) {
        btnRetryApi.addEventListener('click', () => {
            loadCustomerOrders();
        });
    }

    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            exportToPdf();
        });
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            exportToExcel();
        });
    }

    // Attach click handler for delete confirmation
    document.addEventListener('click', (e) => {
        const btnConfirm = e.target.closest('#btn-confirm-delete-order');
        if (btnConfirm) {
            e.preventDefault();
            executeDeleteOrder();
        }
    });

    // Cleanup deleteOrderId on modal dismissal
    const delModalEl = document.getElementById('deleteOrderModal');
    if (delModalEl) {
        delModalEl.addEventListener('hidden.bs.modal', () => {
            deleteOrderId = null;
            const btnConfirm = document.getElementById('btn-confirm-delete-order');
            const btnText = document.getElementById('btn-confirm-delete-order-text');
            const errEl = document.getElementById('delete-order-error');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnText) btnText.innerText = 'Delete';
            if (errEl) {
                errEl.classList.add('d-none');
                errEl.classList.remove('d-flex');
            }
        });
    }
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');

    searchTerm = searchInput ? searchInput.value.trim() : '';
    fromDate = fromDateInput ? fromDateInput.value.trim() : '';
    toDate = toDateInput ? toDateInput.value.trim() : '';
}

/**
 * Loads customer orders from the backend API:
 * GET /api/CustomerOrders/GetAll?SearchTerm=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
 */
async function loadCustomerOrders() {
    const tableBody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('orders-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

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
                <div class="text-muted small mt-2">Fetching customer orders...</div>
            </td>
        </tr>
    `;

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

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
    const endpoint = queryString ? `${baseUrl}/CustomerOrders/GetAll?${queryString}` : `${baseUrl}/CustomerOrders/GetAll`;

    try {
        console.log('Fetching Customer Orders from:', endpoint);
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
        console.log('Customer Orders API Response:', result);

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
        renderCustomerOrdersTable(items);
        renderPagination(totalCount, totalPages, currentPage, pageSize);

    } catch (error) {
        console.warn('API returned error or session unauthorized, using sample dataset fallback:', error);
        
        let filteredSample = SAMPLE_CUSTOMER_ORDERS;
        if (searchTerm) {
            const st = searchTerm.toLowerCase();
            filteredSample = filteredSample.filter(o => 
                (o.orderNo && o.orderNo.toLowerCase().includes(st)) ||
                (o.customerName && o.customerName.toLowerCase().includes(st)) ||
                (o.customerShopName && o.customerShopName.toLowerCase().includes(st)) ||
                (o.notes && o.notes.toLowerCase().includes(st))
            );
        }

        ordersList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderCustomerOrdersTable(filteredSample);
        renderPagination(totalCount, totalPages, currentPage, pageSize);

        if (apiErrorAlert && apiErrorMsg) {
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                apiErrorMsg.innerHTML = `<strong>Note:</strong> ${error.message} Showing sample customer orders. <a href="/Account/Login" class="btn btn-sm btn-outline-danger ms-2 py-0 px-2 fw-semibold">Sign In</a>`;
            } else {
                apiErrorMsg.innerHTML = `<strong>Notice:</strong> Could not connect to API server (${error.message}). Displaying sample orders.`;
            }
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }
    }
}

/**
 * Renders customer order items in table body
 */
function renderCustomerOrdersTable(orders) {
    ensureTableStructureAndModal();
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
        const orderNo = order.orderNo || order.OrderNo || `CO-${orderId}`;
        const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
        const customerName = order.customerName || order.CustomerName || order.name || order.Name || 'Unknown Customer';
        const customerShopName = order.customerShopName || order.CustomerShopName || order.shopName || order.ShopName || '';
        const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);

        const details = order.orderDetails || order.OrderDetails || [];
        const itemsCount = Array.isArray(details) ? details.length : 0;

        tr.innerHTML = `
            <td class="ps-4">
                <span class="badge bg-primary-subtle text-primary fw-bold font-monospace px-2.5 py-1 rounded-2">
                    ${escapeHtml(orderNo)}
                </span>
            </td>
            <td style="max-width: 220px;">
                <div class="d-flex align-items-center gap-2">
                    <div class="avatar-circle-sm bg-light text-primary border rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 34px; height: 34px; min-width: 34px; font-size: 0.8rem;">
                        <i class="bi bi-person-fill"></i>
                    </div>
                    <div class="text-truncate">
                        <div class="fw-semibold text-dark text-truncate" title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</div>
                        ${customerShopName ? `<div class="text-muted small d-flex align-items-center gap-1 text-truncate" title="${escapeHtml(customerShopName)}"><i class="bi bi-shop small"></i> ${escapeHtml(customerShopName)}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center gap-1.5 text-dark">
                    <i class="bi bi-calendar3 text-muted small"></i>
                    <span class="fw-medium">${escapeHtml(orderDateFormatted)}</span>
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-light text-dark border px-2.5 py-1 fw-semibold font-monospace" style="font-size: 0.8rem;">
                    <i class="bi bi-box-seam text-secondary me-1"></i>${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}
                </span>
            </td>
            <td class="text-end">
                <div class="fw-bold text-dark fs-6 font-monospace">
                    ৳ ${formatCurrency(totalAmount)}
                </div>
            </td>
            <td class="pe-4 text-end">
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary rounded-2 me-1" onclick="printOrderDetails(${index})" title="Print Order">
                        <i class="bi bi-printer-fill"></i>
                    </button>
                    <button type="button" class="btn btn-outline-info rounded-2 me-1" onclick="viewOrderDetails(${index})" title="View Details">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger rounded-2" onclick="confirmDeleteOrder('${escapeHtml(orderId)}', '${escapeHtml(orderNo)}')" title="Delete Order">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

/**
 * Safely hides delete order confirmation modal
 */
function hideDeleteOrderModal() {
    if (deleteOrderModalInstance) {
        deleteOrderModalInstance.hide();
    }
    const modalEl = document.getElementById('deleteOrderModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) {
            instance.hide();
        }
    }
}

/**
 * Extracts descriptive message from API response object
 */
function extractServerMessage(resData, fallbackMessage = '') {
    if (!resData) return fallbackMessage;
    if (typeof resData === 'string' && resData.trim()) return resData.trim();
    if (typeof resData.message === 'string' && resData.message.trim()) return resData.message.trim();
    if (typeof resData.Message === 'string' && resData.Message.trim()) return resData.Message.trim();

    const messages = resData.messages || resData.Messages;
    if (Array.isArray(messages) && messages.length > 0) {
        const text = messages.filter(m => typeof m === 'string' && m.trim()).join(' ');
        if (text) return text;
    }

    if (resData.errors) {
        if (Array.isArray(resData.errors)) {
            const text = resData.errors.filter(Boolean).join(' ');
            if (text) return text;
        } else if (typeof resData.errors === 'object') {
            const vals = Object.values(resData.errors).flat().filter(Boolean);
            if (vals.length > 0) return vals.join(' ');
        }
    }

    if (typeof resData.title === 'string' && resData.title.trim()) {
        return resData.title.trim();
    }

    return fallbackMessage;
}

/**
 * Opens delete confirmation modal for the selected customer order
 */
window.confirmDeleteOrder = function(id, orderNo) {
    ensureTableStructureAndModal();
    deleteOrderId = id;

    const noEl = document.getElementById('delete-order-no');
    const idEl = document.getElementById('delete-order-id');
    const errEl = document.getElementById('delete-order-error');

    if (noEl) noEl.innerText = orderNo || `CO-${id}`;
    if (idEl) idEl.innerText = id;
    if (errEl) {
        errEl.classList.add('d-none');
        errEl.classList.remove('d-flex');
    }

    const modalEl = document.getElementById('deleteOrderModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        deleteOrderModalInstance = bootstrap.Modal.getOrCreateInstance
            ? bootstrap.Modal.getOrCreateInstance(modalEl)
            : (bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl));
        deleteOrderModalInstance.show();
    }
};

/**
 * Executes delete request to backend API: DELETE /api/CustomerOrders/{id}
 */
async function executeDeleteOrder() {
    if (!deleteOrderId) return;

    const targetOrderId = deleteOrderId;
    const btnConfirm = document.getElementById('btn-confirm-delete-order');
    const btnText = document.getElementById('btn-confirm-delete-order-text');
    const errEl = document.getElementById('delete-order-error');

    if (errEl) {
        errEl.classList.add('d-none');
        errEl.classList.remove('d-flex');
    }

    if (btnConfirm) btnConfirm.disabled = true;
    if (btnText) btnText.innerText = 'Deleting...';

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    const endpoint = `${baseUrl}/CustomerOrders/${targetOrderId}`;

    try {
        console.log('Deleting Customer Order at:', endpoint);
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
            console.log('Delete Customer Order API Response:', resData);
        } catch (_) {
            // Response might not be JSON
        }

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
            } else {
                isDeleted = true;
            }
        }

        if (isDeleted) {
            hideDeleteOrderModal();
            const successMsg = extractServerMessage(resData, `Customer order #${targetOrderId} deleted successfully.`);
            showToast(successMsg, 'success');

            // Optimistic update
            ordersList = ordersList.filter(o => String(o.id || o.Id) !== String(targetOrderId));
            renderCustomerOrdersTable(ordersList);

            // Refetch live orders
            await loadCustomerOrders();
        } else {
            const failMessage = extractServerMessage(resData, `Failed to delete customer order #${targetOrderId} (HTTP ${response.status}).`);
            if (errEl) {
                const errTextEl = document.getElementById('delete-order-error-text');
                if (errTextEl) errTextEl.innerText = failMessage;
                errEl.classList.remove('d-none');
                errEl.classList.add('d-flex');
            }
            showToast(failMessage, 'danger');
            if (btnConfirm) btnConfirm.disabled = false;
            if (btnText) btnText.innerText = 'Delete';
        }

    } catch (err) {
        console.error('Error executing delete order:', err);
        const errMsg = err.message || 'An unexpected error occurred while deleting customer order.';
        if (errEl) {
            const errTextEl = document.getElementById('delete-order-error-text');
            if (errTextEl) errTextEl.innerText = errMsg;
            errEl.classList.remove('d-none');
            errEl.classList.add('d-flex');
        }
        showToast(errMsg, 'danger');
        if (btnConfirm) btnConfirm.disabled = false;
        if (btnText) btnText.innerText = 'Delete';
    }
}

/**
 * Opens modal with comprehensive details about the selected customer order
 */
window.viewOrderDetails = function(orderIndex) {
    const order = ordersList[orderIndex];
    if (!order) return;
    currentSelectedOrder = order;

    const modalTitleNo = document.getElementById('modal-order-no');
    const modalContent = document.getElementById('modal-order-details-content');

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `CO-${orderId}`;
    const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
    const customerName = order.customerName || order.CustomerName || order.name || order.Name || '—';
    const customerShopName = order.customerShopName || order.CustomerShopName || order.shopName || order.ShopName || '—';
    const customerId = order.customerId || order.CustomerId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.customerPreviousBalance !== undefined ? order.customerPreviousBalance : (order.CustomerPreviousBalance !== undefined ? order.CustomerPreviousBalance : 0);
    const newBalance = order.customerNewBalance !== undefined ? order.customerNewBalance : (order.CustomerNewBalance !== undefined ? order.CustomerNewBalance : (Number(prevBalance) + Number(totalAmount)));
    const notes = order.notes || order.Notes || '';
    const details = order.orderDetails || order.OrderDetails || [];

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
            <div class="col-12 col-md-4">
                <div class="p-3 rounded-4 border bg-light h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="rounded-circle bg-primary-subtle text-primary p-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                            <i class="bi bi-person-fill fs-6"></i>
                        </div>
                        <h6 class="mb-0 fw-bold text-dark">Customer</h6>
                    </div>
                    <div class="fw-bold text-dark fs-6">${escapeHtml(customerName)}</div>
                    <div class="text-muted small mb-1">${customerShopName ? `<i class="bi bi-shop me-1"></i>${escapeHtml(customerShopName)}` : ''}</div>
                    <div class="text-muted small">Customer ID: <span class="fw-medium text-dark">#${escapeHtml(customerId)}</span></div>
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

            <!-- Meta & Notes -->
            <div class="col-12 col-md-3">
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
                        <div class="p-1 rounded bg-white border mt-1 text-dark text-break" style="font-size: 0.8rem; max-height: 60px; overflow-y: auto;">
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

    const printBtn = document.querySelector('#orderDetailsModal button[onclick*="print"], #btn-modal-print-order');
    if (printBtn) {
        printBtn.onclick = function(e) {
            e.preventDefault();
            window.printOrderDetails(currentSelectedOrder);
        };
    }

    const modalEl = document.getElementById('orderDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        orderDetailsModalInstance = bootstrap.Modal.getOrCreateInstance
            ? bootstrap.Modal.getOrCreateInstance(modalEl)
            : (bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl));
        orderDetailsModalInstance.show();
    }
};

/**
 * Generates and prints a high-fidelity Customer Order Voucher / Invoice
 */
window.printOrderDetails = function(orderParam) {
    let order = orderParam;
    if (typeof orderParam === 'number') {
        order = ordersList[orderParam];
    }
    order = order || currentSelectedOrder;
    if (!order) {
        showToast('No customer order selected to print.', 'warning');
        return;
    }
    currentSelectedOrder = order;

    const orderId = order.id || order.Id || '—';
    const orderNo = order.orderNo || order.OrderNo || `CO-${orderId}`;
    const orderDateFormatted = formatDate(order.orderDate || order.OrderDate);
    const customerName = order.customerName || order.CustomerName || order.name || order.Name || '—';
    const customerShopName = order.customerShopName || order.CustomerShopName || order.shopName || order.ShopName || '';
    const customerMobile = order.customerMobile || order.CustomerMobile || order.mobile || order.Mobile || '';
    const customerId = order.customerId || order.CustomerId || '—';
    const totalAmount = order.totalAmount !== undefined ? order.totalAmount : (order.TotalAmount !== undefined ? order.TotalAmount : 0);
    const prevBalance = order.customerPreviousBalance !== undefined ? order.customerPreviousBalance : (order.CustomerPreviousBalance !== undefined ? order.CustomerPreviousBalance : 0);
    const newBalance = order.customerNewBalance !== undefined ? order.customerNewBalance : (order.CustomerNewBalance !== undefined ? order.CustomerNewBalance : (Number(prevBalance) + Number(totalAmount)));
    const notes = order.notes || order.Notes || '';
    const details = order.orderDetails || order.OrderDetails || [];

    const printDateTime = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    let itemsRowsHtml = '';
    let totalQty = 0;
    let computedSum = 0;

    if (Array.isArray(details) && details.length > 0) {
        details.forEach((item, index) => {
            const productName = item.productName || item.ProductName || `Product #${item.productId || ''}`;
            const qty = item.quantity !== undefined ? item.quantity : (item.Quantity !== undefined ? item.Quantity : 0);
            const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.UnitPrice !== undefined ? item.UnitPrice : 0);
            const lineTotal = item.lineTotal !== undefined ? item.lineTotal : (item.LineTotal !== undefined ? item.LineTotal : (qty * unitPrice));
            const remarks = item.remarks || item.Remarks || '';

            totalQty += Number(qty);
            computedSum += Number(lineTotal);

            itemsRowsHtml += `
                <tr>
                    <td class="text-center text-muted" style="font-size: 0.85rem;">${index + 1}</td>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(productName)}</div>
                    </td>
                    <td class="small text-muted">${escapeHtml(remarks || '—')}</td>
                    <td class="text-center fw-semibold">${qty}</td>
                    <td class="text-end">৳ ${formatCurrency(unitPrice)}</td>
                    <td class="text-end fw-bold text-dark">৳ ${formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });
    } else {
        itemsRowsHtml = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    No itemized product details found for this order.
                </td>
            </tr>
        `;
    }

    const finalTotal = totalAmount || computedSum;

    const printWindow = window.open('', '_blank', 'width=950,height=900');
    if (!printWindow) {
        window.print();
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Customer Order Voucher - ${escapeHtml(orderNo)}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                body {
                    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #0f172a;
                    background: #f8fafc;
                    padding: 30px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .voucher-box {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 900px;
                    margin: 0 auto;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
                }
                .voucher-header {
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 24px;
                }
                .brand-title {
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: #1e40af;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                }
                .brand-subtitle {
                    font-size: 0.82rem;
                    color: #64748b;
                    font-weight: 500;
                }
                .voucher-badge {
                    background-color: #eff6ff;
                    color: #1d4ed8;
                    font-weight: 700;
                    padding: 6px 16px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: inline-block;
                    border: 1px solid #bfdbfe;
                }
                .meta-card {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    height: 100%;
                }
                .meta-card-title {
                    font-size: 0.78rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #475569;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .items-table th {
                    background-color: #f1f5f9;
                    color: #334155;
                    font-size: 0.78rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 10px 14px;
                    border-bottom: 2px solid #cbd5e1;
                }
                .items-table td {
                    padding: 11px 14px;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.9rem;
                    vertical-align: middle;
                }
                .items-table tbody tr:nth-child(even) {
                    background-color: #fafbfc;
                }
                .items-table tfoot td,
                .items-table .total-row td {
                    padding: 12px 14px;
                    background-color: #f8fafc !important;
                    border-top: 2px solid #cbd5e1;
                    border-bottom: 2px solid #cbd5e1;
                    font-size: 0.95rem;
                }
                .items-table tbody tr.total-row {
                    background-color: #f8fafc !important;
                }
                .items-table .total-row {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .signature-section {
                    margin-top: 60px;
                    padding-top: 15px;
                    display: flex;
                    justify-content: space-between;
                }
                .signature-line {
                    border-top: 1.5px dashed #94a3b8;
                    width: 220px;
                    text-align: center;
                    padding-top: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #475569;
                }
                .footer-notice {
                    margin-top: 35px;
                    padding-top: 15px;
                    border-top: 1px solid #e2e8f0;
                    font-size: 0.78rem;
                    color: #94a3b8;
                    text-align: center;
                }
                @media print {
                    body {
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    .voucher-box {
                        border: 1px solid #cbd5e1 !important;
                        box-shadow: none !important;
                        padding: 25px !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                    }
                    .items-table tfoot {
                        display: none !important;
                    }
                    .items-table .total-row {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .signature-section {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print mb-4 d-flex justify-content-center">
                <button class="btn btn-primary px-4 py-2 fw-semibold rounded-3 shadow-sm me-2" onclick="window.print()">
                    <i class="bi bi-printer me-2"></i> Print Customer Order Voucher
                </button>
                <button class="btn btn-outline-secondary px-4 py-2 fw-semibold rounded-3" onclick="window.close()">
                    Close Window
                </button>
            </div>

            <div class="voucher-box">
                <!-- Header -->
                <div class="voucher-header d-flex justify-content-between align-items-start">
                    <div>
                        <div class="brand-title">BUSINESS SOLUTION</div>
                        <div class="brand-subtitle">Smart Enterprise & Sales Management System</div>
                    </div>
                    <div class="text-end">
                        <div class="voucher-badge mb-1">CUSTOMER SALES ORDER</div>
                        <div class="fw-bold font-monospace fs-5 text-dark">${escapeHtml(orderNo)}</div>
                    </div>
                </div>

                <!-- Metadata Grid -->
                <div class="row g-3 mb-4">
                    <div class="col-4">
                        <div class="meta-card">
                            <div class="meta-card-title"><i class="bi bi-person-fill text-primary"></i> Customer Details</div>
                            <div class="fw-bold text-dark fs-6">${escapeHtml(customerName)}</div>
                            ${customerShopName ? `<div class="text-muted small"><i class="bi bi-shop me-1"></i>${escapeHtml(customerShopName)}</div>` : ''}
                            ${customerMobile ? `<div class="text-muted small"><i class="bi bi-telephone me-1"></i>${escapeHtml(customerMobile)}</div>` : ''}
                            <div class="text-muted small mt-1">Customer ID: <strong class="text-dark">#${escapeHtml(customerId)}</strong></div>
                        </div>
                    </div>

                    <div class="col-4">
                        <div class="meta-card">
                            <div class="meta-card-title"><i class="bi bi-calendar3 text-primary"></i> Order Meta</div>
                            <div class="small mb-1">Order Date: <strong class="text-dark">${escapeHtml(orderDateFormatted)}</strong></div>
                            <div class="small mb-1">Printed On: <span class="text-muted">${escapeHtml(printDateTime)}</span></div>
                            <div class="small">Total Items: <strong class="text-dark">${details.length} Line(s)</strong></div>
                        </div>
                    </div>

                    <div class="col-4">
                        <div class="meta-card">
                            <div class="meta-card-title"><i class="bi bi-wallet2 text-primary"></i> Financial Balance</div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span class="text-muted">Previous Balance:</span>
                                <strong>৳ ${formatCurrency(prevBalance)}</strong>
                            </div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span class="text-muted">Order Total:</span>
                                <strong class="text-primary">৳ ${formatCurrency(finalTotal)}</strong>
                            </div>
                            <div class="d-flex justify-content-between small border-top pt-1 mt-1">
                                <span class="text-muted">New Balance:</span>
                                <strong class="text-success">৳ ${formatCurrency(newBalance)}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Notes if available -->
                ${notes ? `
                    <div class="p-3 mb-3 rounded-3 bg-light border small">
                        <strong>Order Notes:</strong> ${escapeHtml(notes)}
                    </div>
                ` : ''}

                <!-- Itemized Lines Table -->
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 45px;">#</th>
                            <th>Product Description</th>
                            <th style="width: 25%;">Remarks</th>
                            <th class="text-center" style="width: 80px;">Qty</th>
                            <th class="text-end" style="width: 120px;">Unit Price</th>
                            <th class="text-end" style="width: 130px;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRowsHtml}
                        <tr class="total-row">
                            <td colspan="3" class="text-end fw-bold text-dark">Grand Total:</td>
                            <td class="text-center fw-bold text-dark">${totalQty}</td>
                            <td></td>
                            <td class="text-end fw-bold text-primary fs-6">৳ ${formatCurrency(finalTotal)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Signatures -->
                <div class="signature-section">
                    <div class="signature-line">Customer Signature</div>
                    <div class="signature-line">Authorized By</div>
                </div>

                <!-- Footer notice -->
                <div class="footer-notice">
                    This is an electronically generated sales order voucher from Business Solution. System Record ID: #${escapeHtml(orderId)}
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 400);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

/**
 * Render pagination controls
 */
function renderPagination(total, pages, current, size) {
    const infoEl = document.getElementById('pagination-info');
    const listEl = document.getElementById('pagination-list');
    if (!infoEl || !listEl) return;

    if (total === 0) {
        infoEl.innerText = 'Showing 0 to 0 of 0 entries';
        listEl.innerHTML = '';
        return;
    }

    const start = (current - 1) * size + 1;
    const end = Math.min(current * size, total);
    infoEl.innerText = `Showing ${start} to ${end} of ${total} entries`;

    listEl.innerHTML = '';

    // Previous Page Button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current <= 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<button type="button" class="page-link" aria-label="Previous"><i class="bi bi-chevron-left small"></i></button>`;
    if (current > 1) {
        prevLi.addEventListener('click', () => {
            currentPage = current - 1;
            loadCustomerOrders();
        });
    }
    listEl.appendChild(prevLi);

    // Dynamic numeric pages
    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(pages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<button type="button" class="page-link">1</button>`;
        firstLi.addEventListener('click', () => {
            currentPage = 1;
            loadCustomerOrders();
        });
        listEl.appendChild(firstLi);

        if (startPage > 2) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<span class="page-link">…</span>`;
            listEl.appendChild(ellipsisLi);
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${p === current ? 'active' : ''}`;
        pageLi.innerHTML = `<button type="button" class="page-link">${p}</button>`;
        if (p !== current) {
            pageLi.addEventListener('click', () => {
                currentPage = p;
                loadCustomerOrders();
            });
        }
        listEl.appendChild(pageLi);
    }

    if (endPage < pages) {
        if (endPage < pages - 1) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<span class="page-link">…</span>`;
            listEl.appendChild(ellipsisLi);
        }

        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<button type="button" class="page-link">${pages}</button>`;
        lastLi.addEventListener('click', () => {
            currentPage = pages;
            loadCustomerOrders();
        });
        listEl.appendChild(lastLi);
    }

    // Next Page Button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${current >= pages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<button type="button" class="page-link" aria-label="Next"><i class="bi bi-chevron-right small"></i></button>`;
    if (current < pages) {
        nextLi.addEventListener('click', () => {
            currentPage = current + 1;
            loadCustomerOrders();
        });
    }
    listEl.appendChild(nextLi);
}

/**
 * Export table data to PDF using jsPDF
 */
function exportToPdf() {
    if (!ordersList || ordersList.length === 0) {
        showToast('No customer orders available to export.', 'warning');
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
        doc.text('Business Solution - Customer Orders Report', 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Orders: ${ordersList.length}`, 14, 22);

        const totalSum = ordersList.reduce((sum, o) => {
            const amount = Number(o.totalAmount !== undefined ? o.totalAmount : (o.TotalAmount !== undefined ? o.TotalAmount : 0));
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        const tableHeaders = [['CO Number', 'Customer', 'Shop', 'Order Date', 'Items', 'Total Amount']];
        const tableRows = ordersList.map(o => [
            o.orderNo || o.OrderNo || `CO-${o.id}`,
            o.customerName || o.CustomerName || o.name || '',
            o.customerShopName || o.CustomerShopName || o.shopName || '',
            formatDate(o.orderDate || o.OrderDate),
            `${(o.orderDetails || o.OrderDetails || []).length} items`,
            `BDT ${formatCurrency(o.totalAmount !== undefined ? o.totalAmount : o.TotalAmount)}`
        ]);

        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            foot: [[
                { content: 'Total Amount', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `BDT ${formatCurrency(totalSum)}`, styles: { halign: 'left', fontStyle: 'bold' } }
            ]],
            showFoot: 'lastPage',
            startY: 28,
            theme: 'grid',
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            footStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontStyle: 'bold',
                fontSize: 9.5
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            }
        });

        doc.save(`Customer_Orders_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        showToast('No customer orders available to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel exporter library is loading. Please try again.', 'warning');
        return;
    }

    try {
        const totalSum = ordersList.reduce((sum, o) => {
            const amount = Number(o.totalAmount !== undefined ? o.totalAmount : (o.TotalAmount !== undefined ? o.TotalAmount : 0));
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        const rows = ordersList.map(o => ({
            'CO Number': o.orderNo || o.OrderNo || `CO-${o.id}`,
            'Customer Name': o.customerName || o.CustomerName || o.name || '',
            'Shop Name': o.customerShopName || o.CustomerShopName || o.shopName || '',
            'Order Date': formatDate(o.orderDate || o.OrderDate),
            'Items': `${(o.orderDetails || o.OrderDetails || []).length} items`,
            'Total Amount': Number(o.totalAmount !== undefined ? o.totalAmount : (o.TotalAmount || 0)),
            'Notes': o.notes || o.Notes || ''
        }));

        rows.push({
            'CO Number': 'Total Amount',
            'Customer Name': '',
            'Shop Name': '',
            'Order Date': '',
            'Items': '',
            'Total Amount': totalSum,
            'Notes': ''
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        ws['!cols'] = [
            { wch: 18 }, // CO Number
            { wch: 22 }, // Customer Name
            { wch: 22 }, // Shop Name
            { wch: 15 }, // Order Date
            { wch: 12 }, // Items
            { wch: 16 }, // Total Amount
            { wch: 25 }  // Notes
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'CustomerOrders');

        XLSX.writeFile(wb, `Customer_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel sheet downloaded successfully.', 'success');
    } catch (err) {
        console.error('Excel export failed:', err);
        showToast('Failed to export Excel: ' + err.message, 'danger');
    }
}

