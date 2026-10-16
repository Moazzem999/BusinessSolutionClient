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
            <td colspan="7" class="text-center py-5">
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
        const createdOn = product.createdOn || product.CreatedOn || '';
        const updatedOn = product.updatedOn || product.UpdatedOn || '';

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
                            <div class="fw-bold text-dark mb-0">${escapeHtml(name)}</div>
                            <span class="text-muted small">Catalog item</span>
                        </div>
                    </div>
                </td>
                <td>
                    ${detailsDisplay}
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <span class="text-dark small d-inline-flex align-items-center gap-1">
                        <i class="bi bi-calendar3 text-muted"></i>
                        ${formatDateTime(createdOn)}
                    </span>
                </td>
                <td>
                    <span class="text-muted small d-inline-flex align-items-center gap-1">
                        <i class="bi bi-clock-history text-muted"></i>
                        ${formatDateTime(updatedOn)}
                    </span>
                </td>
                <td class="pe-4 text-end">
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary rounded-2 btn-view-product" data-id="${id}" title="View Details">
                            <i class="bi bi-eye-fill"></i>
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
    const createdOn = product.createdOn || product.CreatedOn || '';
    const updatedOn = product.updatedOn || product.UpdatedOn || '';
    const createdBy = product.createdBy ?? product.CreatedBy ?? '—';
    const updatedBy = product.updatedBy ?? product.UpdatedBy ?? '—';

    const initials = name.trim().substring(0, 2).toUpperCase() || 'PR';

    modalBody.innerHTML = `
        <div class="row g-4 align-items-center mb-4">
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

        <div class="card border bg-light rounded-3 p-3">
            <h6 class="fw-bold text-dark mb-3 d-flex align-items-center gap-2 small text-uppercase" style="letter-spacing: 0.5px;">
                <i class="bi bi-info-circle-fill text-primary"></i> Audit Information
            </h6>
            <div class="row g-3">
                <div class="col-6 col-md-3">
                    <div class="text-muted small">Created Date</div>
                    <div class="fw-semibold text-dark small">${formatDateTime(createdOn)}</div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="text-muted small">Created By</div>
                    <div class="fw-semibold text-dark small">User #${createdBy}</div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="text-muted small">Updated Date</div>
                    <div class="fw-semibold text-dark small">${formatDateTime(updatedOn)}</div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="text-muted small">Updated By</div>
                    <div class="fw-semibold text-dark small">User #${updatedBy}</div>
                </div>
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

        const tableHeaders = [['#ID', 'Product Name', 'Details', 'Status', 'Created On', 'Updated On']];
        const tableRows = productsList.map(p => [
            p.id ?? p.Id ?? '',
            p.name || p.Name || '',
            p.details || p.Details || '',
            (p.status ?? p.Status) === 1 ? 'Active' : 'Inactive',
            formatDateTime(p.createdOn || p.CreatedOn),
            formatDateTime(p.updatedOn || p.UpdatedOn)
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
            'Status': (p.status ?? p.Status) === 1 ? 'Active' : 'Inactive',
            'Created On': formatDateTime(p.createdOn || p.CreatedOn),
            'Updated On': formatDateTime(p.updatedOn || p.UpdatedOn),
            'Created By': p.createdBy ?? p.CreatedBy ?? '',
            'Updated By': p.updatedBy ?? p.UpdatedBy ?? ''
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
    const btnRefresh = document.getElementById('btn-refresh');
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

    // Refresh button
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
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
}
