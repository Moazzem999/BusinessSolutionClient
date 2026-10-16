/* ==========================================================================
   Business Solution Client - Product List Page JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let statusFilter = '';
let totalCount = 0;
let totalPages = 1;
let productsList = [];
let deleteProductId = null;
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initProductListEvents();
    loadProducts();
});

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
 * Returns stored auth token if available
 */
function getAuthToken() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getStoredToken === 'function') {
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
 * Formats ISO date string to user-friendly readable date
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
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
 * Loads products from API endpoint:
 * https://localhost:7148/api/Products/GetAll?SearchTerm=h&PageNumber=1&PageSize=10
 */
async function loadProducts() {
    const tableBody = document.getElementById('product-table-body');
    const emptyState = document.getElementById('product-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (!tableBody) return;

    // Show loading row
    apiErrorAlert.classList.add('d-none');
    apiErrorAlert.classList.remove('d-flex');
    emptyState.classList.add('d-none');
    tableBody.innerHTML = `
        <tr id="product-loading-row">
            <td colspan="5" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Fetching products from server...</div>
            </td>
        </tr>
    `;

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize
    });
    if (searchTerm && searchTerm.trim() !== '') {
        queryParams.append('SearchTerm', searchTerm.trim());
    }

    const endpoint = `${baseUrl}/Products/GetAll?${queryParams.toString()}`;

    try {
        console.log('Fetching Products from:', endpoint);
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
        console.log('Products API Response:', result);

        let items = [];
        totalCount = 0;
        totalPages = 1;

        if (result) {
            // Expected format: { data: { items: [...], totalCount: 1, totalPages: 1, pageNumber: 1, pageSize: 10 } }
            if (result.data) {
                if (Array.isArray(result.data.items || result.data.Items)) {
                    items = result.data.items || result.data.Items;
                    totalCount = result.data.totalCount ?? result.data.TotalCount ?? items.length;
                    totalPages = result.data.totalPages ?? result.data.TotalPages ?? Math.ceil(totalCount / pageSize) ?? 1;
                    if (result.data.pageNumber || result.data.PageNumber) {
                        currentPage = result.data.pageNumber || result.data.PageNumber;
                    }
                } else if (Array.isArray(result.data)) {
                    items = result.data;
                    totalCount = result.totalRecords || result.totalCount || items.length;
                    totalPages = result.totalPages || Math.ceil(totalCount / pageSize) || 1;
                }
            } else if (Array.isArray(result.items || result.Items)) {
                items = result.items || result.Items;
                totalCount = result.totalCount ?? items.length;
                totalPages = result.totalPages ?? Math.ceil(totalCount / pageSize) ?? 1;
            } else if (Array.isArray(result)) {
                items = result;
                totalCount = items.length;
                totalPages = Math.ceil(totalCount / pageSize) || 1;
            }
        }

        productsList = items;

        // Apply client-side status filter if selected
        let displayList = productsList;
        if (statusFilter !== '') {
            displayList = displayList.filter(item => String(item.status) === statusFilter);
        }

        if (displayList.length === 0) {
            tableBody.innerHTML = '';
            emptyState.classList.remove('d-none');
            renderPaginationInfo(0, 0, currentPage);
            renderPaginationControls(1, 1);
            return;
        }

        renderProductTable(displayList);
        renderPaginationInfo(displayList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);

    } catch (err) {
        console.error('Failed to load products:', err);
        tableBody.innerHTML = '';
        apiErrorMsg.innerText = `Could not connect to Products API (${err.message}). Verify backend service is running at ${baseUrl}.`;
        apiErrorAlert.classList.remove('d-none');
        apiErrorAlert.classList.add('d-flex');
        renderPaginationInfo(0, 0, 0);
        renderPaginationControls(1, 1);
    }
}

/**
 * Render list of products into table DOM
 */
function renderProductTable(items) {
    const tableBody = document.getElementById('product-table-body');
    if (!tableBody) return;

    let html = '';

    items.forEach(product => {
        const id = product.id ?? product.Id ?? 0;
        const name = product.name || product.Name || 'Unnamed Product';
        const details = product.details || product.Details || '';
        const rawImage = product.imagePath || product.ImagePath || product.image || '';
        const imageUrl = resolveImageUrl(rawImage);
        const status = product.status ?? product.Status ?? 1;

        const initials = name.trim().substring(0, 2).toUpperCase() || 'PR';

        // Status badge UI
        let statusBadge = '';
        if (status === 1) {
            statusBadge = `
                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                    <i class="bi bi-check-circle-fill"></i> Active
                </span>
            `;
        } else if (status === 0) {
            statusBadge = `
                <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                    <i class="bi bi-dash-circle-fill"></i> Inactive
                </span>
            `;
        } else {
            statusBadge = `
                <span class="badge bg-light text-dark border rounded-pill px-2.5 py-1 fw-semibold">
                    Status: ${escapeHtml(status)}
                </span>
            `;
        }

        // Details column display
        const detailsDisplay = details && details.trim() !== ''
            ? `<span class="text-secondary small text-break" title="${escapeHtml(details)}">${escapeHtml(details.length > 60 ? details.substring(0, 60) + '...' : details)}</span>`
            : `<span class="text-muted fst-italic small">—</span>`;

        html += `
            <tr data-id="${id}">
                <td class="ps-4">
                    <span class="badge bg-light text-primary font-monospace border px-2 py-1 rounded-2 fw-semibold">#${id}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        ${imageUrl ? `
                            <a href="${imageUrl}" target="_blank" rel="noopener noreferrer" title="View product image">
                                <img src="${imageUrl}" alt="${escapeHtml(name)}" class="rounded-3 border shadow-sm" style="width: 44px; height: 44px; object-fit: cover; cursor: pointer;" onerror="this.onerror=null; this.parentElement.outerHTML='<div class=\'avatar-circle-sm bg-primary-subtle text-primary rounded-3 d-flex align-items-center justify-content-center fw-bold\' style=\'width:44px;height:44px;font-size:14px;\'><i class=\'bi bi-box-seam\'></i></div>';">
                            </a>
                        ` : `
                            <div class="avatar-circle-sm bg-primary-subtle text-primary rounded-3 d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 44px; height: 44px; font-size: 14px;">
                                ${escapeHtml(initials)}
                            </div>
                        `}
                        <div>
                            <span class="fw-bold text-dark">${escapeHtml(name)}</span>
                        </div>
                    </div>
                </td>
                <td>
                    ${detailsDisplay}
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td class="pe-4 text-end">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-info rounded-2 me-1 btn-view-product" data-id="${id}" title="View Details">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary rounded-2 me-1 btn-edit-product" data-id="${id}" title="Edit Product">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger rounded-2 btn-delete-product" data-id="${id}" data-name="${escapeHtml(name)}" title="Delete Product">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Attach click listeners to View buttons
    document.querySelectorAll('.btn-view-product').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.getAttribute('data-id'), 10);
            showProductDetailsModal(id);
        });
    });

    // Attach click listeners to Edit buttons
    document.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            openEditProductModal(id);
        });
    });

    // Attach click listeners to Delete buttons
    document.querySelectorAll('.btn-delete-product').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            openDeleteProductModal(id, name);
        });
    });
}

/**
 * Render pagination summary info text
 */
function renderPaginationInfo(countOnPage, total, page) {
    const info = document.getElementById('pagination-info');
    if (!info) return;

    if (total === 0 || countOnPage === 0) {
        info.innerText = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min((page - 1) * pageSize + countOnPage, total);
    info.innerText = `Showing ${start} to ${end} of ${total} entries`;
}

/**
 * Render pagination control buttons
 */
function renderPaginationControls(current, total) {
    const paginationList = document.getElementById('pagination-list');
    if (!paginationList) return;

    if (total <= 1) {
        paginationList.innerHTML = '';
        return;
    }

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

    // Attach click listeners to pagination buttons
    paginationList.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.getAttribute('data-page'), 10);
            if (targetPage && targetPage >= 1 && targetPage <= total && targetPage !== currentPage) {
                currentPage = targetPage;
                loadProducts();
            }
        });
    });
}

/**
 * Shows Product Details inside modal
 */
function showProductDetailsModal(productId) {
    const product = productsList.find(p => (p.id ?? p.Id) === productId);
    if (!product) return;

    const modalBody = document.getElementById('modal-product-content');
    if (!modalBody) return;

    const name = product.name || product.Name || 'Unnamed Product';
    const details = product.details || product.Details || 'No additional details provided.';
    const rawImage = product.imagePath || product.ImagePath || '';
    const imageUrl = resolveImageUrl(rawImage);
    const status = product.status ?? product.Status ?? 1;

    const initials = name.trim().substring(0, 2).toUpperCase() || 'PR';

    modalBody.innerHTML = `
        <div class="row g-4 align-items-center">
            <div class="col-12 col-md-4 text-center">
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="${escapeHtml(name)}" class="img-fluid rounded-4 border shadow-sm" style="max-height: 180px; width: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'bg-light rounded-4 d-flex align-items-center justify-content-center p-5 text-muted border\'><i class=\'bi bi-box-seam fs-1\'></i></div>';">
                ` : `
                    <div class="bg-primary-subtle text-primary rounded-4 d-flex flex-column align-items-center justify-content-center p-4 border" style="height: 160px;">
                        <i class="bi bi-box-seam fs-1 mb-2"></i>
                        <span class="fw-bold fs-5">${escapeHtml(initials)}</span>
                    </div>
                `}
            </div>
            <div class="col-12 col-md-8">
                <div class="d-flex align-items-center gap-2 mb-2">
                    <span class="badge bg-light text-primary border font-monospace px-2.5 py-1">ID #${product.id ?? product.Id}</span>
                    ${status === 1 ?
                        `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>Active</span>` :
                        `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2.5 py-1 fw-semibold"><i class="bi bi-dash-circle-fill me-1"></i>Inactive</span>`
                    }
                </div>
                <h4 class="fw-bold text-dark mb-2">${escapeHtml(name)}</h4>
                <p class="text-secondary mb-0 text-break">${escapeHtml(details)}</p>
            </div>
        </div>
    `;

    const modalEl = document.getElementById('productDetailsModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

/**
 * Open Delete Product confirmation modal
 */
function openDeleteProductModal(id, name) {
    deleteProductId = id;
    const nameEl = document.getElementById('delete-product-name');
    const idEl = document.getElementById('delete-product-id');
    const errorEl = document.getElementById('delete-product-error');

    if (nameEl) nameEl.innerText = name || 'this product';
    if (idEl) idEl.innerText = id;
    if (errorEl) errorEl.classList.add('d-none');

    const modalEl = document.getElementById('deleteProductModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();
    }
}

/**
 * Confirm delete product API call:
 * DELETE https://localhost:7148/api/Products/{id}
 */
async function handleConfirmDelete() {
    if (!deleteProductId) return;

    const btnConfirm = document.getElementById('btn-confirm-delete');
    const btnConfirmText = document.getElementById('btn-confirm-delete-text');
    const errorEl = document.getElementById('delete-product-error');
    const errorText = document.getElementById('delete-product-error-text');

    if (btnConfirm) btnConfirm.disabled = true;
    if (btnConfirmText) btnConfirmText.innerText = 'Deleting...';
    if (errorEl) errorEl.classList.add('d-none');

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Products/${deleteProductId}`;

    try {
        console.log('Deleting Product:', endpoint);
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

        if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200 || response.status === 204)) {
            const modalEl = document.getElementById('deleteProductModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }

            showToast('Product deleted successfully!', 'success');
            deleteProductId = null;
            loadProducts();
        } else {
            const msg = (resData && resData.message) ? resData.message : `Failed to delete product (Status ${response.status})`;
            if (errorText) errorText.innerText = msg;
            if (errorEl) errorEl.classList.remove('d-none');
        }
    } catch (err) {
        console.error('Error deleting product:', err);
        if (errorText) errorText.innerText = 'Network connection error while deleting product.';
        if (errorEl) errorEl.classList.remove('d-none');
    } finally {
        if (btnConfirm) btnConfirm.disabled = false;
        if (btnConfirmText) btnConfirmText.innerText = 'Delete';
    }
}

/**
 * Export product table data to PDF using jsPDF
 */
function exportToPdf() {
    if (!productsList || productsList.length === 0) {
        showToast('No product data available to export.', 'warning');
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
        doc.text('Business Solution - Product Catalog Report', 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Items: ${productsList.length}`, 14, 22);

        const tableHeaders = [['#ID', 'Product Name', 'Details', 'Status']];
        const tableRows = productsList.map(p => [
            p.id ?? p.Id ?? '',
            p.name || p.Name || '',
            p.details || p.Details || '',
            (p.status ?? p.Status) === 1 ? 'Active' : 'Inactive'
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

        doc.save(`Products_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF downloaded successfully.', 'success');
    } catch (err) {
        console.error('PDF export failed:', err);
        showToast('Failed to export PDF: ' + err.message, 'danger');
    }
}

/**
 * Export product table data to Excel (.xlsx) using SheetJS
 */
function exportToExcel() {
    if (!productsList || productsList.length === 0) {
        showToast('No product data available to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel export library is loading. Please try again.', 'warning');
        return;
    }

    try {
        const exportData = productsList.map(p => ({
            'ID': p.id ?? p.Id ?? '',
            'Product Name': p.name || p.Name || '',
            'Details': p.details || p.Details || '',
            'Status': (p.status ?? p.Status) === 1 ? 'Active' : 'Inactive'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');

        XLSX.writeFile(wb, `Products_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel file downloaded successfully.', 'success');
    } catch (err) {
        console.error('Excel export failed:', err);
        showToast('Failed to export Excel: ' + err.message, 'danger');
    }
}

/**
 * Display toast notification
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMessage) {
        alert(message);
        return;
    }

    toastEl.className = 'toast align-items-center text-white border-0 rounded-3 shadow-lg';
    if (type === 'success') {
        toastEl.classList.add('bg-success');
        if (toastIcon) toastIcon.className = 'bi bi-check-circle-fill fs-5';
    } else if (type === 'danger') {
        toastEl.classList.add('bg-danger');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-triangle-fill fs-5';
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning', 'text-dark');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-circle-fill fs-5 text-dark';
    } else {
        toastEl.classList.add('bg-primary');
        if (toastIcon) toastIcon.className = 'bi bi-info-circle-fill fs-5';
    }

    toastMessage.innerText = message;

    if (typeof bootstrap !== 'undefined') {
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
        toast.show();
    }
}

/**
 * Initialize event listeners
 */
function initProductListEvents() {
    // Search form submit
    const searchForm = document.getElementById('product-search-form');
    const searchInput = document.getElementById('search-input');
    const statusSelect = document.getElementById('status-filter');
    const pageSizeSelect = document.getElementById('page-size-select');
    const btnReset = document.getElementById('btn-reset');
    const btnRetry = document.getElementById('btn-retry-api');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchTerm = searchInput ? searchInput.value.trim() : '';
            currentPage = 1;
            loadProducts();
        });
    }

    // Debounced search on typing
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchTerm = searchInput.value.trim();
                currentPage = 1;
                loadProducts();
            }, 400);
        });
    }

    // Status filter
    if (statusSelect) {
        statusSelect.addEventListener('change', () => {
            statusFilter = statusSelect.value;
            currentPage = 1;
            loadProducts();
        });
    }

    // Page size change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            pageSize = parseInt(pageSizeSelect.value, 10) || 10;
            currentPage = 1;
            loadProducts();
        });
    }

    // Reset button
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (statusSelect) statusSelect.value = '';
            searchTerm = '';
            statusFilter = '';
            currentPage = 1;
            loadProducts();
        });
    }

    // Retry API button
    if (btnRetry) {
        btnRetry.addEventListener('click', () => {
            loadProducts();
        });
    }

    // PDF export
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportToPdf);
    }

    // Excel export
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }

    // Confirm Delete button
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', handleConfirmDelete);
    }

    // Create form submit
    const createForm = document.getElementById('create-product-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateProductSubmit);
    }

    // Create image preview
    const createImgInput = document.getElementById('create-product-image');
    const createImgPreview = document.getElementById('create-image-preview');
    const createImgContainer = document.getElementById('create-image-preview-container');
    const btnRemoveCreateImg = document.getElementById('btn-remove-create-image');

    if (createImgInput && createImgPreview && createImgContainer) {
        createImgInput.addEventListener('change', () => {
            if (createImgInput.files && createImgInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    createImgPreview.src = e.target.result;
                    createImgContainer.classList.remove('d-none');
                };
                reader.readAsDataURL(createImgInput.files[0]);
            } else {
                createImgContainer.classList.add('d-none');
            }
        });
    }

    if (btnRemoveCreateImg && createImgInput && createImgContainer) {
        btnRemoveCreateImg.addEventListener('click', () => {
            createImgInput.value = '';
            createImgContainer.classList.add('d-none');
        });
    }

    // Update form submit
    const updateForm = document.getElementById('update-product-form');
    if (updateForm) {
        updateForm.addEventListener('submit', handleUpdateProductSubmit);
    }

    // Update image preview
    const updateImgInput = document.getElementById('update-product-image');
    const updateImgPreview = document.getElementById('update-image-preview');
    const updateImgContainer = document.getElementById('update-image-preview-container');
    const updateImgStatus = document.getElementById('update-image-status');

    if (updateImgInput && updateImgPreview && updateImgContainer) {
        updateImgInput.addEventListener('change', () => {
            if (updateImgInput.files && updateImgInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    updateImgPreview.src = e.target.result;
                    if (updateImgStatus) updateImgStatus.innerText = '(New selected image)';
                    updateImgContainer.classList.remove('d-none');
                };
                reader.readAsDataURL(updateImgInput.files[0]);
            }
        });
    }
}

/**
 * Handle Create Product form submission:
 * POST https://localhost:7148/api/Products
 * Content-Type: multipart/form-data
 * Fields: Id=0, Name, Details, Image
 */
async function handleCreateProductSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('create-product-name');
    const detailsInput = document.getElementById('create-product-details');
    const imageInput = document.getElementById('create-product-image');
    const btnSubmit = document.getElementById('btn-submit-create');
    const btnText = document.getElementById('btn-submit-create-text');
    const spinner = document.getElementById('create-spinner');
    const errorAlert = document.getElementById('create-product-error');
    const errorText = document.getElementById('create-product-error-text');

    const nameVal = nameInput ? nameInput.value.trim() : '';
    if (!nameVal) {
        if (errorText) errorText.innerText = 'Product Name is required.';
        if (errorAlert) {
            errorAlert.classList.remove('d-none');
            errorAlert.classList.add('d-flex');
        }
        return;
    }

    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.innerText = 'Creating...';
    if (spinner) spinner.classList.remove('d-none');

    const formData = new FormData();
    formData.append('Id', '0');
    formData.append('Name', nameVal);
    formData.append('Details', detailsInput ? detailsInput.value.trim() : '');

    if (imageInput && imageInput.files && imageInput.files.length > 0) {
        formData.append('Image', imageInput.files[0]);
    }

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Products`;

    try {
        console.log('Sending POST to create product:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        let resData = null;
        try {
            resData = await response.json();
        } catch (e) { }

        if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201 || response.status === 200 || response.status === 201)) {
            // Reset form
            const form = document.getElementById('create-product-form');
            if (form) form.reset();
            const previewContainer = document.getElementById('create-image-preview-container');
            if (previewContainer) previewContainer.classList.add('d-none');

            // Close modal
            const modalEl = document.getElementById('createProductModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }

            showToast('Product created successfully!', 'success');
            // Reload table to show newly added product
            currentPage = 1;
            loadProducts();
        } else {
            const msg = (resData && resData.message) ? resData.message : `Failed to create product (Status ${response.status})`;
            if (errorText) errorText.innerText = msg;
            if (errorAlert) {
                errorAlert.classList.remove('d-none');
                errorAlert.classList.add('d-flex');
            }
        }
    } catch (err) {
        console.error('Error creating product:', err);
        if (errorText) errorText.innerText = 'Network connection error while creating product.';
        if (errorAlert) {
            errorAlert.classList.remove('d-none');
            errorAlert.classList.add('d-flex');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.innerText = 'Create Product';
        if (spinner) spinner.classList.add('d-none');
    }
}

/**
 * Open Update Product modal and populate current values
 */
function openEditProductModal(id) {
    const product = productsList.find(p => (p.id ?? p.Id) == id);
    if (!product) return;

    const idInput = document.getElementById('update-product-id');
    const nameInput = document.getElementById('update-product-name');
    const detailsInput = document.getElementById('update-product-details');
    const imageInput = document.getElementById('update-product-image');
    const previewContainer = document.getElementById('update-image-preview-container');
    const imagePreview = document.getElementById('update-image-preview');
    const imageStatus = document.getElementById('update-image-status');
    const errorAlert = document.getElementById('update-product-error');

    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }

    if (idInput) idInput.value = product.id ?? product.Id ?? id;
    if (nameInput) nameInput.value = product.name || product.Name || '';
    if (detailsInput) detailsInput.value = product.details || product.Details || '';
    if (imageInput) imageInput.value = '';

    const rawImage = product.imagePath || product.ImagePath || '';
    const imageUrl = resolveImageUrl(rawImage);

    if (imageUrl && previewContainer && imagePreview) {
        imagePreview.src = imageUrl;
        if (imageStatus) imageStatus.innerText = '(Current image)';
        previewContainer.classList.remove('d-none');
    } else if (previewContainer) {
        previewContainer.classList.add('d-none');
    }

    const modalEl = document.getElementById('updateProductModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();
    }
}

/**
 * Handle Update Product form submission:
 * PUT https://localhost:7148/api/Products
 * Content-Type: multipart/form-data
 * Fields: Id=44, Name=dfds, Details=sdfsd, Image=@...
 */
async function handleUpdateProductSubmit(e) {
    e.preventDefault();

    const idInput = document.getElementById('update-product-id');
    const nameInput = document.getElementById('update-product-name');
    const detailsInput = document.getElementById('update-product-details');
    const imageInput = document.getElementById('update-product-image');

    const btnSubmit = document.getElementById('btn-submit-update');
    const btnText = document.getElementById('btn-submit-update-text');
    const spinner = document.getElementById('update-spinner');
    const errorAlert = document.getElementById('update-product-error');
    const errorText = document.getElementById('update-product-error-text');

    const idVal = idInput ? idInput.value : '';
    const nameVal = nameInput ? nameInput.value.trim() : '';

    if (!nameVal) {
        if (errorText) errorText.innerText = 'Product Name is required.';
        if (errorAlert) {
            errorAlert.classList.remove('d-none');
            errorAlert.classList.add('d-flex');
        }
        return;
    }

    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }

    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.innerText = 'Updating...';
    if (spinner) spinner.classList.remove('d-none');

    const formData = new FormData();
    formData.append('Id', idVal);
    formData.append('Name', nameVal);
    formData.append('Details', detailsInput ? detailsInput.value.trim() : '');

    if (imageInput && imageInput.files && imageInput.files.length > 0) {
        formData.append('Image', imageInput.files[0]);
    }

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Products`;

    try {
        console.log('Sending PUT to update product:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: formData
        });

        let resData = null;
        try {
            resData = await response.json();
        } catch (e) { }

        if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200 || response.status === 200 || response.status === 204)) {
            // Close modal
            const modalEl = document.getElementById('updateProductModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();
            }

            showToast('Product updated successfully!', 'success');
            loadProducts();
        } else {
            const msg = (resData && resData.message) ? resData.message : `Failed to update product (Status ${response.status})`;
            if (errorText) errorText.innerText = msg;
            if (errorAlert) {
                errorAlert.classList.remove('d-none');
                errorAlert.classList.add('d-flex');
            }
        }
    } catch (err) {
        console.error('Error updating product:', err);
        if (errorText) errorText.innerText = 'Network connection error while updating product.';
        if (errorAlert) {
            errorAlert.classList.remove('d-none');
            errorAlert.classList.add('d-flex');
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.innerText = 'Update';
        if (spinner) spinner.classList.add('d-none');
    }
}
