/* ==========================================================================
   Business Solution Client - Supplier List Page JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let totalCount = 0;
let totalPages = 1;
let suppliersList = [];
let deleteSupplierId = null;

document.addEventListener('DOMContentLoaded', () => {
    initSupplierListEvents();
    loadSuppliers();
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
 * Converts image paths (relative or absolute) to full accessible URLs
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
 * Main function to load suppliers list from API
 */
async function loadSuppliers() {
    const tableBody = document.getElementById('supplier-table-body');
    const loadingRow = document.getElementById('supplier-loading-row');
    const emptyState = document.getElementById('supplier-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Show loading state
    apiErrorAlert.classList.add('d-none');
    emptyState.classList.add('d-none');
    tableBody.innerHTML = `
        <tr id="supplier-loading-row">
            <td colspan="5" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching suppliers list...</div>
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
    const endpoint = `${baseUrl}/Suppliers/GetAll?${queryParams.toString()}`;

    try {
        console.log('Fetching Suppliers from:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, { method: 'GET', headers: headers });

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const result = await response.json();
        console.log('Suppliers API Response:', result);

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

        suppliersList = items;

        if (suppliersList.length === 0) {
            tableBody.innerHTML = '';
            emptyState.classList.remove('d-none');
            renderPaginationInfo(0, 0, 0);
            renderPaginationControls(1, 1);
            return;
        }

        renderSupplierTable(suppliersList);
        renderPaginationInfo(suppliersList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);

    } catch (err) {
        console.error('Failed to load suppliers:', err);
        tableBody.innerHTML = '';
        apiErrorMsg.innerText = `Could not connect to Supplier API (${err.message}). Make sure the backend service is running.`;
        apiErrorAlert.classList.remove('d-none');
        renderPaginationInfo(0, 0, 0);
        renderPaginationControls(1, 1);
    }
}

/**
 * Render supplier list into DOM table
 */
function renderSupplierTable(data) {
    const tableBody = document.getElementById('supplier-table-body');
    if (!tableBody) return;

    let html = '';
    data.forEach(item => {
        const id = item.id || item.Id || 0;
        const shopName = item.shopName || item.ShopName || 'N/A';
        const name = item.name || item.Name || 'N/A';
        const mobile = item.mobile || item.Mobile || 'N/A';
        const email = item.email || item.Email || 'N/A';
        const nidNo = item.nidNo || item.NidNo || 'N/A';
        const currentBalance = item.currentBalance !== undefined && item.currentBalance !== null ? item.currentBalance : (item.CurrentBalance || 0);
        const presentAddress = item.presentAddress || item.PresentAddress || 'N/A';
        const rawImage = item.imagePath || item.ImagePath || item.image || item.Image || item.supplierImage || item.SupplierImage || '';
        const imageUrl = resolveImageUrl(rawImage);

        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SP';
        const formattedBalance = Number(currentBalance).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        html += `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        ${imageUrl ? `
                            <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" title="Click to view full image in new tab">
                                <img src="${imageUrl}" alt="${name}" class="rounded-circle border shadow-sm" style="width: 42px; height: 42px; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.parentElement.outerHTML='<div class=\'avatar-circle-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold\' style=\'width:42px;height:42px;font-size:14px;\'>${initials}</div>';">
                            </a>
                        ` : `
                            <div class="avatar-circle-sm bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 42px; height: 42px; font-size: 14px;">
                                ${initials}
                            </div>
                        `}
                        <div>
                            <div class="fw-bold text-dark mb-0">${escapeHtml(name)}</div>
                            <span class="badge bg-light text-secondary border fw-medium rounded-pill px-2 py-1 small">
                                <i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}
                            </span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex flex-column">
                        <span class="text-dark small fw-medium"><i class="bi bi-telephone text-muted me-1"></i>${escapeHtml(mobile)}</span>
                        <span class="text-muted small"><i class="bi bi-envelope text-muted me-1"></i>${escapeHtml(email)}</span>
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
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-info rounded-2 me-1 btn-view-supplier" data-id="${id}" title="View Details">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary rounded-2 me-1 btn-edit-supplier" data-id="${id}" title="Edit Supplier">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger rounded-2 btn-delete-supplier" data-id="${id}" data-name="${escapeHtml(name)}" title="Delete Supplier">
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
 * Render pagination buttons
 */
function renderPaginationControls(current, total) {
    const paginationList = document.getElementById('pagination-list');
    if (!paginationList) return;

    let html = '';

    // Previous Button
    html += `
        <li class="page-item ${current <= 1 ? 'disabled' : ''}">
            <button class="page-link rounded-2" href="#" data-page="${current - 1}" ${current <= 1 ? 'tabindex="-1" aria-disabled="true"' : ''}>
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
 * Initialize event handlers
 */
function initSupplierListEvents() {
    // Search form submit
    const searchForm = document.getElementById('supplier-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchTerm = document.getElementById('search-input').value.trim();
            currentPage = 1;
            loadSuppliers();
        });
    }

    // Reset button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            searchTerm = '';
            currentPage = 1;
            loadSuppliers();
        });
    }

    // Rows per page selector
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadSuppliers();
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
                    loadSuppliers();
                }
            }
        });
    }

    // Table action buttons delegation
    const tableBody = document.getElementById('supplier-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.btn-view-supplier');
            if (viewBtn) {
                const id = viewBtn.getAttribute('data-id');
                openViewModal(id);
                return;
            }

            const editBtn = e.target.closest('.btn-edit-supplier');
            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                openEditModal(id);
                return;
            }

            const deleteBtn = e.target.closest('.btn-delete-supplier');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                const name = deleteBtn.getAttribute('data-name');
                openDeleteModal(id, name);
                return;
            }
        });
    }

    // Submit Edit Supplier Form
    const updateForm = document.getElementById('update-supplier-form');
    if (updateForm) {
        updateForm.addEventListener('submit', handleUpdateSupplier);
    }

    // Confirm Delete Supplier
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', handleConfirmDelete);
    }

    // Export PDF & Excel
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportToPDF);
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }
}

/**
 * Open Supplier Details Modal
 */
async function openViewModal(id) {
    const modalEl = document.getElementById('supplierDetailsModal');
    const modalContent = document.getElementById('modal-supplier-content');
    if (!modalEl || !modalContent) return;

    modalContent.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading supplier profile...</span>
            </div>
        </div>
    `;

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    try {
        const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
        const token = getAuthToken();
        const endpoint = `${baseUrl}/Suppliers/GetById/${id}`;
        
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, { headers: headers });
        let supplierData = null;

        if (response.ok) {
            const res = await response.json();
            supplierData = res.data || res;
        } else {
            // fallback to local state array if API endpoint single call fails
            supplierData = suppliersList.find(s => (s.id || s.Id) == id);
        }

        if (!supplierData) {
            modalContent.innerHTML = `<div class="alert alert-danger mb-0">Supplier details could not be loaded.</div>`;
            return;
        }

        const shopName = supplierData.shopName || supplierData.ShopName || 'N/A';
        const name = supplierData.name || supplierData.Name || 'N/A';
        const mobile = supplierData.mobile || supplierData.Mobile || 'N/A';
        const email = supplierData.email || supplierData.Email || 'N/A';
        const nidNo = supplierData.nidNo || supplierData.NidNo || 'N/A';
        const currentBalance = supplierData.currentBalance !== undefined ? supplierData.currentBalance : (supplierData.CurrentBalance || 0);
        const presentAddress = supplierData.presentAddress || supplierData.PresentAddress || 'N/A';
        const permanentAddress = supplierData.permanentAddress || supplierData.PermanentAddress || 'N/A';
        const additionalDetails = supplierData.additionalDetails || supplierData.AdditionalDetails || 'N/A';

        const rawImage = supplierData.imagePath || supplierData.ImagePath || supplierData.image || supplierData.Image || supplierData.supplierImage || supplierData.SupplierImage || '';
        const rawNidImage = supplierData.nidImagePath || supplierData.NidImagePath || supplierData.nidImage || supplierData.NidImage || '';
        const rawChequeImage = supplierData.chequeImagePath || supplierData.ChequeImagePath || supplierData.chequeImage || supplierData.ChequeImage || '';

        const image = resolveImageUrl(rawImage);
        const nidImage = resolveImageUrl(rawNidImage);
        const chequeImage = resolveImageUrl(rawChequeImage);

        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SP';
        const formattedBalance = Number(currentBalance).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        modalContent.innerHTML = `
            <div class="row g-4">
                <!-- Header Banner -->
                <div class="col-12">
                    <div class="p-3 bg-light rounded-3 d-flex align-items-center gap-3 border">
                        ${image ? `
                            <a href="${image}" target="_blank" rel="noopener noreferrer" title="Click to view full image in new tab">
                                <img src="${image}" alt="${name}" class="rounded-circle border shadow-sm" style="width: 64px; height: 64px; object-fit: cover; cursor: pointer;">
                            </a>
                        ` : `
                            <div class="avatar-circle bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold fs-4" style="width: 64px; height: 64px;">
                                ${initials}
                            </div>
                        `}
                        <div>
                            <h4 class="fw-bold text-dark mb-1">${escapeHtml(name)}</h4>
                            <span class="badge bg-primary rounded-pill px-3 py-1">
                                <i class="bi bi-shop me-1"></i>${escapeHtml(shopName)}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Info Grid -->
                <div class="col-md-6">
                    <div class="card border-0 bg-light p-3 rounded-3 h-100">
                        <h6 class="fw-bold text-primary mb-3"><i class="bi bi-telephone-fill me-2"></i>Contact Details</h6>
                        <div class="mb-2"><span class="text-muted small">Mobile:</span> <strong class="text-dark ms-1">${escapeHtml(mobile)}</strong></div>
                        <div class="mb-2"><span class="text-muted small">Email:</span> <strong class="text-dark ms-1">${escapeHtml(email)}</strong></div>
                        <div class="mb-0"><span class="text-muted small">NID Number:</span> <strong class="text-dark ms-1">${escapeHtml(nidNo)}</strong></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card border-0 bg-light p-3 rounded-3 h-100">
                        <h6 class="fw-bold text-primary mb-3"><i class="bi bi-wallet2 me-2"></i>Financial & Status</h6>
                        <div class="mb-2"><span class="text-muted small">Current Balance:</span> <strong class="fs-5 ${currentBalance >= 0 ? 'text-success' : 'text-danger'} ms-1">৳ ${formattedBalance}</strong></div>
                        <div class="mb-0"><span class="text-muted small">Supplier ID:</span> <span class="badge bg-secondary ms-1">#${id}</span></div>
                    </div>
                </div>

                <!-- Address Information -->
                <div class="col-12">
                    <div class="card border-0 bg-light p-3 rounded-3">
                        <h6 class="fw-bold text-primary mb-3"><i class="bi bi-geo-alt-fill me-2"></i>Address Information</h6>
                        <div class="row g-3">
                            <div class="col-md-6">
                                <span class="text-muted small d-block">Present Address:</span>
                                <p class="text-dark mb-0 small fw-medium">${escapeHtml(presentAddress)}</p>
                            </div>
                            <div class="col-md-6">
                                <span class="text-muted small d-block">Permanent Address:</span>
                                <p class="text-dark mb-0 small fw-medium">${escapeHtml(permanentAddress)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Additional Details -->
                <div class="col-12">
                    <div class="card border-0 bg-light p-3 rounded-3">
                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-card-text me-2"></i>Additional Notes</h6>
                        <p class="text-dark mb-0 small">${escapeHtml(additionalDetails)}</p>
                    </div>
                </div>

                <!-- Documents Preview -->
                <div class="col-12">
                    <h6 class="fw-bold text-primary mb-3"><i class="bi bi-images me-2"></i>Attached Documents</h6>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <div class="border rounded-3 p-2 text-center bg-white shadow-sm">
                                <div class="small fw-semibold text-muted mb-2">Profile Photo</div>
                                ${image ? `
                                    <a href="${image}" target="_blank" rel="noopener noreferrer" title="Click to open full photo in new tab">
                                        <img src="${image}" class="img-fluid rounded border shadow-sm" style="max-height: 130px; object-fit: contain; cursor: pointer;">
                                    </a>
                                ` : `<div class="text-muted py-3 small">No image uploaded</div>`}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="border rounded-3 p-2 text-center bg-white shadow-sm">
                                <div class="small fw-semibold text-muted mb-2">NID Document</div>
                                ${nidImage ? `
                                    <a href="${nidImage}" target="_blank" rel="noopener noreferrer" title="Click to open full NID in new tab">
                                        <img src="${nidImage}" class="img-fluid rounded border shadow-sm" style="max-height: 130px; object-fit: contain; cursor: pointer;">
                                    </a>
                                ` : `<div class="text-muted py-3 small">No NID document uploaded</div>`}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="border rounded-3 p-2 text-center bg-white shadow-sm">
                                <div class="small fw-semibold text-muted mb-2">Bank Cheque Image</div>
                                ${chequeImage ? `
                                    <a href="${chequeImage}" target="_blank" rel="noopener noreferrer" title="Click to open full Cheque in new tab">
                                        <img src="${chequeImage}" class="img-fluid rounded border shadow-sm" style="max-height: 130px; object-fit: contain; cursor: pointer;">
                                    </a>
                                ` : `<div class="text-muted py-3 small">No cheque image uploaded</div>`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('Error viewing supplier details:', e);
        modalContent.innerHTML = `<div class="alert alert-danger mb-0">Error fetching supplier details.</div>`;
    }
}

/**
 * Open Edit Supplier Modal & populate fields
 */
async function openEditModal(id) {
    const modalEl = document.getElementById('updateSupplierModal');
    const errorAlert = document.getElementById('update-error-alert');
    if (!modalEl) return;

    errorAlert.classList.add('d-none');

    // Find in current array or fetch from API
    let supplier = suppliersList.find(s => (s.id || s.Id) == id);
    
    if (!supplier) {
        try {
            const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
            const token = getAuthToken();
            const response = await fetch(`${baseUrl}/Suppliers/GetById/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const res = await response.json();
                supplier = res.data || res;
            }
        } catch (e) {
            console.warn('Could not fetch supplier details for edit:', e);
        }
    }

    if (!supplier) {
        showToast('Supplier data not found', 'danger');
        return;
    }

    document.getElementById('update-Id').value = id;
    document.getElementById('update-ShopName').value = supplier.shopName || supplier.ShopName || '';
    document.getElementById('update-Name').value = supplier.name || supplier.Name || '';
    document.getElementById('update-Mobile').value = supplier.mobile || supplier.Mobile || '';
    document.getElementById('update-Email').value = supplier.email || supplier.Email || '';
    document.getElementById('update-CurrentBalance').value = supplier.currentBalance !== undefined ? supplier.currentBalance : (supplier.CurrentBalance || 0);
    document.getElementById('update-NidNo').value = supplier.nidNo || supplier.NidNo || '';
    document.getElementById('update-PresentAddress').value = supplier.presentAddress || supplier.PresentAddress || '';
    document.getElementById('update-PermanentAddress').value = supplier.permanentAddress || supplier.PermanentAddress || '';
    document.getElementById('update-AdditionalDetails').value = supplier.additionalDetails || supplier.AdditionalDetails || '';

    // Image previews for current files
    const currentImg = resolveImageUrl(supplier.imagePath || supplier.ImagePath || supplier.image || supplier.Image || supplier.supplierImage || supplier.SupplierImage);
    const currentNid = resolveImageUrl(supplier.nidImagePath || supplier.NidImagePath || supplier.nidImage || supplier.NidImage);
    const currentCheque = resolveImageUrl(supplier.chequeImagePath || supplier.ChequeImagePath || supplier.chequeImage || supplier.ChequeImage);

    const imgPreviewEl = document.getElementById('update-image-preview');
    if (imgPreviewEl) {
        imgPreviewEl.innerHTML = currentImg ? `
            <div class="d-flex align-items-center gap-2 mt-1">
                <a href="${currentImg}" target="_blank" rel="noopener noreferrer" title="Click to view full photo in new tab">
                    <img src="${currentImg}" class="rounded border shadow-sm" style="height: 42px; width: 42px; object-fit: cover; cursor: pointer;">
                </a>
                <span class="text-muted small">Current Photo <i class="bi bi-box-arrow-up-right ms-1"></i></span>
            </div>` : '';
    }

    const nidPreviewEl = document.getElementById('update-nid-preview');
    if (nidPreviewEl) {
        nidPreviewEl.innerHTML = currentNid ? `
            <div class="d-flex align-items-center gap-2 mt-1">
                <a href="${currentNid}" target="_blank" rel="noopener noreferrer" title="Click to view full NID in new tab">
                    <img src="${currentNid}" class="rounded border shadow-sm" style="height: 42px; width: 42px; object-fit: cover; cursor: pointer;">
                </a>
                <span class="text-muted small">Current NID <i class="bi bi-box-arrow-up-right ms-1"></i></span>
            </div>` : '';
    }

    const chequePreviewEl = document.getElementById('update-cheque-preview');
    if (chequePreviewEl) {
        chequePreviewEl.innerHTML = currentCheque ? `
            <div class="d-flex align-items-center gap-2 mt-1">
                <a href="${currentCheque}" target="_blank" rel="noopener noreferrer" title="Click to view full Cheque in new tab">
                    <img src="${currentCheque}" class="rounded border shadow-sm" style="height: 42px; width: 42px; object-fit: cover; cursor: pointer;">
                </a>
                <span class="text-muted small">Current Cheque <i class="bi bi-box-arrow-up-right ms-1"></i></span>
            </div>` : '';
    }

    // Clear file inputs
    document.getElementById('update-Image').value = '';
    document.getElementById('update-NidImage').value = '';
    document.getElementById('update-ChequeImage').value = '';

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

/**
 * Handle update form submission
 */
async function handleUpdateSupplier(e) {
    e.preventDefault();

    const btnUpdate = document.getElementById('btn-update-supplier');
    const btnText = document.getElementById('btn-update-text');
    const btnSpinner = document.getElementById('update-spinner');
    const errorAlert = document.getElementById('update-error-alert');
    const errorMsg = document.getElementById('update-error-message');

    errorAlert.classList.add('d-none');
    btnUpdate.disabled = true;
    btnText.innerText = 'Updating...';
    btnSpinner.classList.remove('d-none');

    const id = document.getElementById('update-Id').value;
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Suppliers`;

    const formData = new FormData();
    formData.append('Id', id);
    formData.append('ShopName', document.getElementById('update-ShopName').value.trim());
    formData.append('Name', document.getElementById('update-Name').value.trim());
    formData.append('Mobile', document.getElementById('update-Mobile').value.trim());
    formData.append('Email', document.getElementById('update-Email').value.trim());
    formData.append('CurrentBalance', parseFloat(document.getElementById('update-CurrentBalance').value) || 0);
    formData.append('NidNo', document.getElementById('update-NidNo').value.trim());
    formData.append('PresentAddress', document.getElementById('update-PresentAddress').value.trim());
    formData.append('PermanentAddress', document.getElementById('update-PermanentAddress').value.trim());
    formData.append('AdditionalDetails', document.getElementById('update-AdditionalDetails').value.trim());

    const imageInput = document.getElementById('update-Image');
    if (imageInput && imageInput.files.length > 0) {
        formData.append('Image', imageInput.files[0]);
    }

    const nidImageInput = document.getElementById('update-NidImage');
    if (nidImageInput && nidImageInput.files.length > 0) {
        formData.append('NidImage', nidImageInput.files[0]);
    }

    const chequeImageInput = document.getElementById('update-ChequeImage');
    if (chequeImageInput && chequeImageInput.files.length > 0) {
        formData.append('ChequeImage', chequeImageInput.files[0]);
    }

    try {
        console.log('Sending PUT Supplier Update to:', endpoint);

        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: formData
        });

        const resData = await response.json();
        console.log('Update Supplier API Response:', resData);

        if (response.ok && resData && (resData.succeeded === true || resData.statusCode === 200)) {
            const modalEl = document.getElementById('updateSupplierModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            showToast('Supplier updated successfully!', 'success');
            loadSuppliers();
        } else {
            const message = (resData && resData.message) ? resData.message : `Failed to update supplier (Status ${response.status})`;
            errorMsg.innerText = message;
            errorAlert.classList.remove('d-none');
        }
    } catch (err) {
        console.error('Error updating supplier:', err);
        errorMsg.innerText = 'Network error or backend connection failed.';
        errorAlert.classList.remove('d-none');
    } finally {
        btnUpdate.disabled = false;
        btnText.innerText = 'Update';
        btnSpinner.classList.add('d-none');
    }
}

/**
 * Open Delete Confirmation Modal
 */
function openDeleteModal(id, name) {
    deleteSupplierId = id;
    const modalEl = document.getElementById('deleteConfirmationModal');
    const deleteNameEl = document.getElementById('delete-supplier-name');
    const deleteErrorEl = document.getElementById('delete-modal-error');

    if (!modalEl) return;

    if (deleteNameEl) deleteNameEl.innerText = name;
    if (deleteErrorEl) deleteErrorEl.classList.add('d-none');

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

/**
 * Handle confirm delete action
 */
async function handleConfirmDelete() {
    if (!deleteSupplierId) return;

    const btnConfirm = document.getElementById('btn-confirm-delete');
    const btnConfirmText = document.getElementById('btn-confirm-delete-text');
    const deleteErrorEl = document.getElementById('delete-modal-error');
    const deleteErrorText = document.getElementById('delete-modal-error-text');

    btnConfirm.disabled = true;
    btnConfirmText.innerText = 'Deleting...';
    if (deleteErrorEl) deleteErrorEl.classList.add('d-none');

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Suppliers/${deleteSupplierId}`;

    try {
        console.log('Deleting Supplier:', endpoint);
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

        if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200)) {
            const modalEl = document.getElementById('deleteConfirmationModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            showToast('Supplier deleted successfully!', 'success');
            loadSuppliers();
        } else {
            const msg = (resData && resData.message) ? resData.message : `Delete failed (Status ${response.status})`;
            if (deleteErrorText) deleteErrorText.innerText = msg;
            if (deleteErrorEl) deleteErrorEl.classList.remove('d-none');
        }
    } catch (err) {
        console.error('Error deleting supplier:', err);
        if (deleteErrorText) deleteErrorText.innerText = 'Network connection error while deleting.';
        if (deleteErrorEl) deleteErrorEl.classList.remove('d-none');
    } finally {
        btnConfirm.disabled = false;
        btnConfirmText.innerText = 'Delete';
    }
}

/**
 * Toast notification popup helper
 */
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMsg || !toastIcon) return;

    toastMsg.innerText = message;
    toastEl.className = `toast align-items-center text-white border-0 rounded-3 shadow-lg bg-${type === 'success' ? 'success' : 'danger'}`;
    toastIcon.className = `bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`;

    const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
    bsToast.show();
}

/**
 * Utility: Export Supplier List to PDF
 */
function exportToPDF() {
    if (!suppliersList || suppliersList.length === 0) {
        showToast('No supplier data available to export.', 'danger');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(16);
        doc.text('Supplier Directory Report', 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Suppliers: ${suppliersList.length}`, 14, 22);

        const tableColumn = ["ID", "Shop Name", "Supplier Name", "Mobile", "Email", "NID No", "Current Balance (BDT)", "Present Address"];
        const tableRows = [];

        suppliersList.forEach(item => {
            const rowData = [
                item.id || item.Id || '',
                item.shopName || item.ShopName || '',
                item.name || item.Name || '',
                item.mobile || item.Mobile || '',
                item.email || item.Email || '',
                item.nidNo || item.NidNo || '',
                Number(item.currentBalance || item.CurrentBalance || 0).toFixed(2),
                item.presentAddress || item.PresentAddress || ''
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

        doc.save(`Suppliers_List_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF report downloaded successfully!', 'success');
    } catch (e) {
        console.error('PDF export error:', e);
        showToast('Failed to generate PDF document.', 'danger');
    }
}

/**
 * Utility: Export Supplier List to Excel
 */
function exportToExcel() {
    if (!suppliersList || suppliersList.length === 0) {
        showToast('No supplier data available to export.', 'danger');
        return;
    }

    try {
        const excelData = suppliersList.map(item => ({
            "ID": item.id || item.Id || '',
            "Shop Name": item.shopName || item.ShopName || '',
            "Supplier Name": item.name || item.Name || '',
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
        XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");

        XLSX.writeFile(workbook, `Suppliers_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel report downloaded successfully!', 'success');
    } catch (e) {
        console.error('Excel export error:', e);
        showToast('Failed to generate Excel file.', 'danger');
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
