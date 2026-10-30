/* ==========================================================================
   Business Solution Client - Customer List Page JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let isSpecialFilter = '';
let totalCount = 0;
let totalPages = 1;
let customersList = [];
let customerDetailsModalInstance = null;
let deleteCustomerId = null;

// Sample fallback customers matching API schema
const SAMPLE_CUSTOMERS = [
    {
        id: 1,
        name: "test",
        shopName: "Makka Fashion",
        nidNo: "1994827361920",
        email: "string@aa.com",
        mobile: "2323232",
        isSpecial: false,
        additionalDetails: "Customer registered during October promotion.",
        presentAddress: "House 12, Road 4, Sector 7, Uttara, Dhaka",
        permanentAddress: "Vill: Alampur, Post: Alampur, Kushtia",
        currentBalance: 0,
        imagePath: "/Uploads/Customers/BBB_29-Oct-2026_20_10_57_PM.png",
        nidImagePath: "/Uploads/Customers/SampleNID_29-Oct-2026_20_10_57_PM.jpg",
        chequeImagePath: "/Uploads/Customers/dbbl_29-Oct-2026_20_10_57_PM.png",
        createdOn: "2026-10-29T20:10:57.6550291",
        updatedOn: "2026-10-29T20:10:57.6559418",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 2,
        name: "Md Faruk Ahmed",
        shopName: "Ahmed Fabrics & Traders",
        nidNo: "1987541298456",
        email: "faruk.ahmed@example.com",
        mobile: "01711223344",
        isSpecial: true,
        additionalDetails: "VIP corporate wholesale client. Priority dispatch requested.",
        presentAddress: "Shop 14-16, 2nd Floor, Islampur Cloth Market, Dhaka",
        permanentAddress: "Chandpur Sadar, Chandpur",
        currentBalance: 32500,
        imagePath: "",
        nidImagePath: "",
        chequeImagePath: "",
        createdOn: "2026-10-28T16:30:00.0000000",
        updatedOn: "2026-10-28T16:30:00.0000000",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        id: 3,
        name: "Nasir Uddin",
        shopName: "Nasir Departmental",
        nidNo: "1991876543210",
        email: "nasir.uddin@example.com",
        mobile: "01855667788",
        isSpecial: false,
        additionalDetails: "Regular monthly account.",
        presentAddress: "Road 2, Mirpur 10, Dhaka",
        permanentAddress: "Noakhali Sadar, Noakhali",
        currentBalance: -5200,
        imagePath: "",
        nidImagePath: "",
        chequeImagePath: "",
        createdOn: "2026-10-27T11:15:20.0000000",
        updatedOn: "2026-10-27T11:15:20.0000000",
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initCustomerListEvents();
    loadCustomers();
});

function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined') {
        return BSApp.getApiBaseUrl();
    }
    if (typeof API_BASE_URL !== 'undefined') {
        return API_BASE_URL;
    }
    return 'https://localhost:7148/api';
}

function getAuthToken() {
    if (typeof BSApp !== 'undefined') {
        return BSApp.getStoredToken();
    }
    return localStorage.getItem('bs_token') || '';
}

/**
 * Converts image paths to full accessible URLs
 */
function resolveImageUrl(path) {
    if (!path || typeof path !== 'string' || path.trim() === '') return '';
    path = path.trim();
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    const baseUrl = getApiBaseUrl();
    let host = '';
    try {
        const urlObj = new URL(baseUrl);
        host = urlObj.origin;
    } catch (e) {
        host = baseUrl.replace(/\/api\/?$/i, '');
    }
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${host}${cleanPath}`;
}

/**
 * Main function to load customers list from API
 */
async function loadCustomers() {
    const tableBody = document.getElementById('customer-table-body');
    const emptyState = document.getElementById('customer-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Show loading skeleton
    if (apiErrorAlert) apiErrorAlert.classList.add('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    tableBody.innerHTML = `
        <tr id="customer-loading-row">
            <td colspan="5" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching customers list...</div>
            </td>
        </tr>
    `;

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();
    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize
    });

    if (searchTerm) {
        queryParams.append('SearchTerm', searchTerm);
    }
    if (isSpecialFilter !== '') {
        queryParams.append('IsSpecial', isSpecialFilter);
    }

    const endpoint = `${baseUrl}/Customers/GetAll?${queryParams.toString()}`;

    try {
        console.log('Fetching Customers from:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, { method: 'GET', headers: headers });

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const result = await response.json();
        console.log('Customers API Response:', result);

        // Normalize response data structure
        let items = [];
        if (result) {
            if (Array.isArray(result)) {
                items = result;
                totalCount = items.length;
                totalPages = Math.ceil(totalCount / pageSize) || 1;
            } else if (result.data) {
                if (Array.isArray(result.data)) {
                    items = result.data;
                    totalCount = result.totalRecords || result.totalCount || items.length;
                    totalPages = result.totalPages || Math.ceil(totalCount / pageSize) || 1;
                } else if (Array.isArray(result.data.items || result.data.data)) {
                    items = result.data.items || result.data.data;
                    totalCount = result.data.totalCount || result.data.totalRecords || items.length;
                    totalPages = result.data.totalPages || Math.ceil(totalCount / pageSize) || 1;
                }
            } else if (Array.isArray(result.items)) {
                items = result.items;
                totalCount = result.totalCount || items.length;
                totalPages = result.totalPages || Math.ceil(totalCount / pageSize) || 1;
            }
        }

        customersList = items;

        if (customersList.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('d-none');
            renderPaginationInfo(0, 0, 0);
            renderPaginationControls(1, 1);
            return;
        }

        renderCustomerTable(customersList);
        renderPaginationInfo(customersList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);

    } catch (err) {
        console.warn('API call failed, evaluating sample fallback:', err);

        // Fallback to sample customer data when offline or 401
        let filteredSample = SAMPLE_CUSTOMERS.filter(c => {
            let matchesSearch = true;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                matchesSearch = (c.name && c.name.toLowerCase().includes(term)) ||
                                (c.shopName && c.shopName.toLowerCase().includes(term)) ||
                                (c.mobile && c.mobile.toLowerCase().includes(term)) ||
                                (c.email && c.email.toLowerCase().includes(term)) ||
                                (c.nidNo && c.nidNo.toLowerCase().includes(term));
            }

            let matchesSpecial = true;
            if (isSpecialFilter === 'true') {
                matchesSpecial = c.isSpecial === true;
            } else if (isSpecialFilter === 'false') {
                matchesSpecial = c.isSpecial === false;
            }

            return matchesSearch && matchesSpecial;
        });

        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;
        const startIndex = (currentPage - 1) * pageSize;
        customersList = filteredSample.slice(startIndex, startIndex + pageSize);

        if (customersList.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('d-none');
            renderPaginationInfo(0, 0, 0);
            renderPaginationControls(1, 1);
            return;
        }

        renderCustomerTable(customersList);
        renderPaginationInfo(customersList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);

        if (apiErrorAlert && apiErrorMsg && !err.message.includes('401')) {
            apiErrorMsg.innerText = `Connected in offline preview mode: ${err.message}`;
            apiErrorAlert.classList.remove('d-none');
        }
    }
}

/**
 * Render customer list into DOM table
 */
function renderCustomerTable(data) {
    const tableBody = document.getElementById('customer-table-body');
    if (!tableBody) return;

    let html = '';
    data.forEach(item => {
        const id = item.id || item.Id || 0;
        const name = item.name || item.Name || 'N/A';
        const shopName = item.shopName || item.ShopName || 'N/A';
        const mobile = item.mobile || item.Mobile || 'N/A';
        const email = item.email || item.Email || 'N/A';
        const nidNo = item.nidNo || item.NidNo || 'N/A';
        const isSpecial = item.isSpecial === true || item.IsSpecial === true;
        const currentBalance = item.currentBalance !== undefined && item.currentBalance !== null ? Number(item.currentBalance) : (Number(item.CurrentBalance) || 0);
        const rawImage = item.imagePath || item.ImagePath || '';
        const imageUrl = resolveImageUrl(rawImage);

        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CU';
        const formattedBalance = Number(currentBalance).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        html += `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        ${imageUrl ? `
                            <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" title="Click to view full photo">
                                <img src="${imageUrl}" alt="${escapeHtml(name)}" class="rounded-circle border shadow-sm" style="width: 42px; height: 42px; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.parentElement.outerHTML='<div class=\\'avatar-circle-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold\\' style=\\'width:42px;height:42px;font-size:14px;\\'>${initials}</div>';">
                            </a>
                        ` : `
                            <div class="avatar-circle-sm bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 42px; height: 42px; font-size: 14px;">
                                ${initials}
                            </div>
                        `}
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-0">
                                <span class="fw-bold text-dark">${escapeHtml(name)}</span>
                                ${isSpecial ? `
                                    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0" title="Special Customer">
                                        <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.7rem;"></i>Special
                                    </span>
                                ` : ''}
                            </div>
                            <span class="badge bg-light text-secondary border fw-medium rounded-pill px-2 py-1 small">
                                <i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}
                            </span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex flex-column">
                        <span class="text-dark small fw-medium">
                            <i class="bi bi-telephone text-muted me-1"></i>${escapeHtml(mobile)}
                        </span>
                        <span class="text-muted small">
                            <i class="bi bi-envelope text-muted me-1"></i>${escapeHtml(email)}
                        </span>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border font-monospace px-2 py-1">${escapeHtml(nidNo)}</span>
                </td>
                <td>
                    <span class="fw-semibold ${currentBalance > 0 ? 'text-success' : (currentBalance < 0 ? 'text-danger' : 'text-dark')}">
                        ৳ ${formattedBalance}
                    </span>
                </td>
                <td class="pe-4 text-end">
                    <div class="d-inline-flex align-items-center gap-1">
                        <button type="button" class="btn btn-outline-info rounded-2 btn-view-customer px-2 py-1" data-id="${id}" title="View Details">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger rounded-2 btn-delete-customer px-2 py-1" data-id="${id}" data-name="${escapeHtml(name)}" title="Delete Customer">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

/**
 * Render pagination text summary
 */
function renderPaginationInfo(countOnPage, total, page) {
    const paginationInfo = document.getElementById('pagination-info');
    if (!paginationInfo) return;

    if (total === 0) {
        paginationInfo.innerText = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    paginationInfo.innerText = `Showing ${start} to ${end} of ${total} entries`;
}

/**
 * Render pagination controls
 */
function renderPaginationControls(current, total) {
    const paginationList = document.getElementById('pagination-list');
    if (!paginationList) return;

    let html = '';

    // Previous Button
    html += `
        <li class="page-item ${current <= 1 ? 'disabled' : ''}">
            <button class="page-link rounded-2" data-page="${current - 1}" ${current <= 1 ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
            html += `
                <li class="page-item ${i === current ? 'active' : ''}">
                    <button class="page-link rounded-2" data-page="${i}">${i}</button>
                </li>
            `;
        } else if (i === current - 2 || i === current + 2) {
            html += `<li class="page-item disabled"><span class="page-link rounded-2">...</span></li>`;
        }
    }

    // Next Button
    html += `
        <li class="page-item ${current >= total ? 'disabled' : ''}">
            <button class="page-link rounded-2" data-page="${current + 1}" ${current >= total ? 'tabindex="-1" aria-disabled="true"' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    paginationList.innerHTML = html;
}

/**
 * Initialize event listeners
 */
function initCustomerListEvents() {
    // Search form submit
    const searchForm = document.getElementById('customer-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchTerm = document.getElementById('search-input')?.value.trim() || '';
            const specialSelect = document.getElementById('filter-is-special');
            isSpecialFilter = specialSelect ? specialSelect.value : '';
            currentPage = 1;
            loadCustomers();
        });
    }

    // Special customer dropdown change
    const specialSelect = document.getElementById('filter-is-special');
    if (specialSelect) {
        specialSelect.addEventListener('change', () => {
            isSpecialFilter = specialSelect.value;
            currentPage = 1;
            loadCustomers();
        });
    }

    // Reset button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            if (specialSelect) specialSelect.value = '';
            searchTerm = '';
            isSpecialFilter = '';
            currentPage = 1;
            loadCustomers();
        });
    }

    // Rows per page selector
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadCustomers();
        });
    }

    // Pagination links click
    const paginationList = document.getElementById('pagination-list');
    if (paginationList) {
        paginationList.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-page]');
            if (btn && !btn.parentElement.classList.contains('disabled')) {
                e.preventDefault();
                const targetPage = parseInt(btn.getAttribute('data-page'), 10);
                if (targetPage && targetPage !== currentPage) {
                    currentPage = targetPage;
                    loadCustomers();
                }
            }
        });
    }

    // Table action buttons delegation
    const tableBody = document.getElementById('customer-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.btn-view-customer');
            if (viewBtn) {
                const id = viewBtn.getAttribute('data-id');
                openCustomerViewModal(id);
                return;
            }

            const deleteBtn = e.target.closest('.btn-delete-customer');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                const name = deleteBtn.getAttribute('data-name');
                openDeleteCustomerModal(id, name);
                return;
            }
        });
    }

    // Confirm Delete Customer Button
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', handleConfirmDelete);
    }

    // Export PDF & Excel
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportCustomersToPDF);
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportCustomersToExcel);
    }
}

/**
 * Open Customer Details Profile Modal
 */
async function openCustomerViewModal(id) {
    const modalEl = document.getElementById('customerDetailsModal');
    const modalContent = document.getElementById('modal-customer-content');
    if (!modalEl || !modalContent) return;

    modalContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading customer details...</span>
            </div>
            <div class="text-muted small mt-2">Loading profile details...</div>
        </div>
    `;

    if (!customerDetailsModalInstance && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        customerDetailsModalInstance = new bootstrap.Modal(modalEl);
    }
    if (customerDetailsModalInstance) {
        customerDetailsModalInstance.show();
    }

    try {
        const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
        const token = getAuthToken();
        const endpoint = `${baseUrl}/Customers/GetById/${id}`;

        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let customerData = null;
        try {
            const response = await fetch(endpoint, { headers: headers });
            if (response.ok) {
                const res = await response.json();
                customerData = res.data || res;
            }
        } catch (_) { }

        if (!customerData) {
            customerData = customersList.find(c => String(c.id || c.Id) === String(id)) ||
                           SAMPLE_CUSTOMERS.find(c => String(c.id) === String(id));
        }

        if (!customerData) {
            modalContent.innerHTML = `<div class="alert alert-danger mb-0">Customer profile details could not be found.</div>`;
            return;
        }

        renderCustomerDetailsModal(customerData);

    } catch (err) {
        console.error('Error opening customer modal:', err);
        modalContent.innerHTML = `<div class="alert alert-danger mb-0">Failed to render customer profile.</div>`;
    }
}

/**
 * Render Customer Details inside the modal
 */
function renderCustomerDetailsModal(customer) {
    const modalContent = document.getElementById('modal-customer-content');
    if (!modalContent) return;

    const id = customer.id || customer.Id || '—';
    const name = customer.name || customer.Name || '—';
    const shopName = customer.shopName || customer.ShopName || '—';
    const mobile = customer.mobile || customer.Mobile || '—';
    const email = customer.email || customer.Email || '—';
    const nidNo = customer.nidNo || customer.NidNo || '—';
    const isSpecial = customer.isSpecial === true || customer.IsSpecial === true;
    const currentBalance = customer.currentBalance !== undefined && customer.currentBalance !== null ? Number(customer.currentBalance) : (Number(customer.CurrentBalance) || 0);
    const presentAddress = customer.presentAddress || customer.PresentAddress || '—';
    const permanentAddress = customer.permanentAddress || customer.PermanentAddress || '—';
    const additionalDetails = customer.additionalDetails || customer.AdditionalDetails || '—';

    const rawImage = customer.imagePath || customer.ImagePath || '';
    const rawNidImage = customer.nidImagePath || customer.NidImagePath || '';
    const rawChequeImage = customer.chequeImagePath || customer.ChequeImagePath || '';

    const image = resolveImageUrl(rawImage);
    const nidImage = resolveImageUrl(rawNidImage);
    const chequeImage = resolveImageUrl(rawChequeImage);

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CU';
    const formattedBalance = Number(currentBalance).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    modalContent.innerHTML = `
        <div class="row g-4">
            <!-- Header Banner -->
            <div class="col-12">
                <div class="p-3 bg-light rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-3 border">
                    <div class="d-flex align-items-center gap-3">
                        ${image ? `
                            <a href="${image}" target="_blank" rel="noopener noreferrer" title="Click to view full photo">
                                <img src="${image}" alt="${escapeHtml(name)}" class="rounded-circle border shadow-sm" style="width: 64px; height: 64px; object-fit: cover; cursor: pointer;">
                            </a>
                        ` : `
                            <div class="avatar-circle bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4" style="width: 64px; height: 64px;">
                                ${initials}
                            </div>
                        `}
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h4 class="fw-bold text-dark mb-0">${escapeHtml(name)}</h4>
                                ${isSpecial ? `
                                    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-1">
                                        <i class="bi bi-star-fill text-warning me-1"></i>Special Customer
                                    </span>
                                ` : `
                                    <span class="badge bg-secondary-subtle text-secondary border rounded-pill small px-2 py-1">
                                        Regular Customer
                                    </span>
                                `}
                            </div>
                            <span class="badge bg-primary rounded-pill px-3 py-1">
                                <i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}
                            </span>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="text-muted small d-block">Customer ID</span>
                        <span class="badge bg-dark font-monospace fs-6">#${id}</span>
                    </div>
                </div>
            </div>

            <!-- Contact Details Card -->
            <div class="col-md-6">
                <div class="card border-0 bg-light p-3 rounded-3 h-100">
                    <h6 class="fw-bold text-primary mb-3">
                        <i class="bi bi-telephone-fill me-2"></i>Contact Details
                    </h6>
                    <div class="mb-2">
                        <span class="text-muted small">Mobile:</span>
                        <strong class="text-dark ms-1">${escapeHtml(mobile)}</strong>
                    </div>
                    <div class="mb-2">
                        <span class="text-muted small">Email:</span>
                        <strong class="text-dark ms-1">${escapeHtml(email)}</strong>
                    </div>
                    <div class="mb-0">
                        <span class="text-muted small">NID Number:</span>
                        <strong class="text-dark ms-1 font-monospace">${escapeHtml(nidNo)}</strong>
                    </div>
                </div>
            </div>

            <!-- Financial Card -->
            <div class="col-md-6">
                <div class="card border-0 bg-light p-3 rounded-3 h-100">
                    <h6 class="fw-bold text-primary mb-3">
                        <i class="bi bi-wallet2 me-2"></i>Financial & Balance
                    </h6>
                    <div class="mb-2">
                        <span class="text-muted small">Current Balance:</span>
                        <strong class="fs-5 ${currentBalance >= 0 ? 'text-success' : 'text-danger'} ms-1">
                            ৳ ${formattedBalance}
                        </strong>
                    </div>
                    <div class="mb-0">
                        <span class="text-muted small">Account Type:</span>
                        <span class="ms-1 fw-semibold ${isSpecial ? 'text-warning' : 'text-secondary'}">
                            ${isSpecial ? 'Special Account' : 'Standard Account'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Address Information -->
            <div class="col-12">
                <div class="card border-0 bg-light p-3 rounded-3">
                    <h6 class="fw-bold text-primary mb-3">
                        <i class="bi bi-geo-alt-fill me-2"></i>Address Information
                    </h6>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <span class="text-muted small d-block mb-1">Present Address:</span>
                            <p class="text-dark mb-0 small fw-medium">${escapeHtml(presentAddress)}</p>
                        </div>
                        <div class="col-md-6">
                            <span class="text-muted small d-block mb-1">Permanent Address:</span>
                            <p class="text-dark mb-0 small fw-medium">${escapeHtml(permanentAddress)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Additional Notes -->
            <div class="col-12">
                <div class="card border-0 bg-light p-3 rounded-3">
                    <h6 class="fw-bold text-primary mb-2">
                        <i class="bi bi-card-text me-2"></i>Additional Notes
                    </h6>
                    <p class="text-dark mb-0 small">${escapeHtml(additionalDetails)}</p>
                </div>
            </div>

            <!-- Documents Preview -->
            <div class="col-12">
                <h6 class="fw-bold text-primary mb-3">
                    <i class="bi bi-images me-2"></i>Attached Documents
                </h6>
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="border rounded-3 p-2 text-center bg-white shadow-sm h-100">
                            <div class="small fw-semibold text-muted mb-2">Profile Photo</div>
                            ${image ? `
                                <a href="${image}" target="_blank" rel="noopener noreferrer" title="Click to open full photo">
                                    <img src="${image}" class="img-fluid rounded border shadow-sm" style="max-height: 120px; object-fit: contain; cursor: pointer;">
                                </a>
                            ` : `<div class="text-muted py-4 small">No photo uploaded</div>`}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="border rounded-3 p-2 text-center bg-white shadow-sm h-100">
                            <div class="small fw-semibold text-muted mb-2">NID Document</div>
                            ${nidImage ? `
                                <a href="${nidImage}" target="_blank" rel="noopener noreferrer" title="Click to open full NID">
                                    <img src="${nidImage}" class="img-fluid rounded border shadow-sm" style="max-height: 120px; object-fit: contain; cursor: pointer;">
                                </a>
                            ` : `<div class="text-muted py-4 small">No NID document uploaded</div>`}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="border rounded-3 p-2 text-center bg-white shadow-sm h-100">
                            <div class="small fw-semibold text-muted mb-2">Cheque Document</div>
                            ${chequeImage ? `
                                <a href="${chequeImage}" target="_blank" rel="noopener noreferrer" title="Click to open full cheque">
                                    <img src="${chequeImage}" class="img-fluid rounded border shadow-sm" style="max-height: 120px; object-fit: contain; cursor: pointer;">
                                </a>
                            ` : `<div class="text-muted py-4 small">No cheque document uploaded</div>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Utility: Export Customer List to PDF
 */
function exportCustomersToPDF() {
    if (!customersList || customersList.length === 0) {
        showToast('No customer data available to export.', 'danger');
        return;
    }

    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast('PDF generator library is loading, please try again.', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(16);
        doc.text('Customer Directory Report', 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Customers: ${customersList.length}`, 14, 22);

        const tableColumn = ["ID", "Customer Name", "Shop Name", "Special", "Mobile", "Email", "NID No", "Balance (BDT)"];
        const tableRows = [];

        customersList.forEach(item => {
            const rowData = [
                item.id || item.Id || '',
                item.name || item.Name || '',
                item.shopName || item.ShopName || '',
                (item.isSpecial || item.IsSpecial) ? 'Yes' : 'No',
                item.mobile || item.Mobile || '',
                item.email || item.Email || '',
                item.nidNo || item.NidNo || '',
                Number(item.currentBalance || item.CurrentBalance || 0).toFixed(2)
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        doc.save(`Customers_List_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF report downloaded successfully!', 'success');
    } catch (e) {
        console.error('PDF export error:', e);
        showToast('Failed to generate PDF document.', 'danger');
    }
}

/**
 * Utility: Export Customer List to Excel
 */
function exportCustomersToExcel() {
    if (!customersList || customersList.length === 0) {
        showToast('No customer data available to export.', 'danger');
        return;
    }

    try {
        if (typeof XLSX === 'undefined') {
            showToast('Excel generator library is loading, please try again.', 'warning');
            return;
        }

        const excelData = customersList.map(item => ({
            "ID": item.id || item.Id || '',
            "Customer Name": item.name || item.Name || '',
            "Shop Name": item.shopName || item.ShopName || '',
            "Special Customer": (item.isSpecial || item.IsSpecial) ? 'Yes' : 'No',
            "Mobile": item.mobile || item.Mobile || '',
            "Email": item.email || item.Email || '',
            "NID No": item.nidNo || item.NidNo || '',
            "Current Balance": Number(item.currentBalance || item.CurrentBalance || 0),
            "Present Address": item.presentAddress || item.PresentAddress || '',
            "Permanent Address": item.permanentAddress || item.PermanentAddress || '',
            "Additional Details": item.additionalDetails || item.AdditionalDetails || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

        XLSX.writeFile(workbook, `Customers_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel report downloaded successfully!', 'success');
    } catch (e) {
        console.error('Excel export error:', e);
        showToast('Failed to generate Excel file.', 'danger');
    }
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMessage) return;

    toastEl.className = 'toast align-items-center text-white border-0 rounded-3 shadow-lg';
    if (type === 'success') {
        toastEl.classList.add('bg-success');
        if (toastIcon) toastIcon.className = 'bi bi-check-circle-fill fs-5';
    } else if (type === 'danger' || type === 'error') {
        toastEl.classList.add('bg-danger');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-triangle-fill fs-5';
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning', 'text-dark');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-circle-fill fs-5';
    } else {
        toastEl.classList.add('bg-primary');
        if (toastIcon) toastIcon.className = 'bi bi-info-circle-fill fs-5';
    }

    toastMessage.innerText = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
        bsToast.show();
    }
}

/**
 * Helper: Escape HTML strings to prevent XSS
 */
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Open Delete Customer Confirmation Modal
 */
function openDeleteCustomerModal(id, name) {
    deleteCustomerId = id;
    const modalEl = document.getElementById('deleteConfirmationModal');
    const deleteNameEl = document.getElementById('delete-customer-name');
    const deleteErrorEl = document.getElementById('delete-modal-error');

    if (!modalEl) return;

    if (deleteNameEl) deleteNameEl.innerText = name || 'this customer';
    if (deleteErrorEl) deleteErrorEl.classList.add('d-none');

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

/**
 * Handle confirm delete customer action
 */
async function handleConfirmDelete() {
    if (!deleteCustomerId) return;

    const btnConfirm = document.getElementById('btn-confirm-delete');
    const btnConfirmText = document.getElementById('btn-confirm-delete-text');
    const deleteErrorEl = document.getElementById('delete-modal-error');
    const deleteErrorText = document.getElementById('delete-modal-error-text');

    if (btnConfirm) btnConfirm.disabled = true;
    if (btnConfirmText) btnConfirmText.innerText = 'Deleting...';
    if (deleteErrorEl) deleteErrorEl.classList.add('d-none');

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Customers/${deleteCustomerId}`;

    try {
        console.log('Deleting Customer:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: headers
        });

        let resData = null;
        try {
            resData = await response.json();
        } catch (e) { }

        if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200 || resData.status === 200)) {
            const modalEl = document.getElementById('deleteConfirmationModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            showToast('Customer deleted successfully!', 'success');

            // Also remove from local sample list if active
            const sampleIndex = SAMPLE_CUSTOMERS.findIndex(c => String(c.id) === String(deleteCustomerId));
            if (sampleIndex > -1) {
                SAMPLE_CUSTOMERS.splice(sampleIndex, 1);
            }

            loadCustomers();
        } else {
            let errorMsg = `Failed to delete customer (Status ${response.status})`;
            if (resData) {
                if (resData.message) errorMsg = resData.message;
                else if (resData.title) errorMsg = resData.title;
                else if (resData.errors && typeof resData.errors === 'object') {
                    errorMsg = Object.values(resData.errors).flat().join(', ');
                }
            }
            if (deleteErrorText) deleteErrorText.innerText = errorMsg;
            if (deleteErrorEl) deleteErrorEl.classList.remove('d-none');
        }
    } catch (err) {
        console.error('Delete customer error:', err);
        if (deleteErrorText) deleteErrorText.innerText = 'Network error: Unable to contact server.';
        if (deleteErrorEl) deleteErrorEl.classList.remove('d-none');
    } finally {
        if (btnConfirm) btnConfirm.disabled = false;
        if (btnConfirmText) btnConfirmText.innerText = 'Delete';
    }
}


