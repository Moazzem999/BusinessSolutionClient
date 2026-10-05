/* ==========================================================================
   Business Solution Client - Employee Advance Payment JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let fromDate = '';
let toDate = '';
let totalPages = 1;
let currentPaymentsList = [];
let employeeMap = {};
let paymentToDeleteId = null;
let deleteModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initAdvancePaymentPage();
});

function initAdvancePaymentPage() {
    const searchForm = document.getElementById('advance-payment-search-form');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchTerm = document.getElementById('search-input').value.trim();
            fromDate = document.getElementById('from-date-input').value;
            toDate = document.getElementById('to-date-input').value;
            currentPage = 1;
            fetchAdvancePayments();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            document.getElementById('from-date-input').value = '';
            document.getElementById('to-date-input').value = '';
            searchTerm = '';
            fromDate = '';
            toDate = '';
            currentPage = 1;
            fetchAdvancePayments();
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            fetchAdvancePayments();
        });
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            exportToPDF();
        });
    }

    if (excelBtn) {
        excelBtn.addEventListener('click', () => {
            exportToExcel();
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteAdvancePayment);
    }

    // Initialize Create Modal & Form
    initCreateModalAndForm();

    // Load initial employee dataset for image map
    preloadEmployeeMap();

    // Initial load of advance payments
    fetchAdvancePayments();
}

/**
 * Preloads employee map silently for image resolution
 */
async function preloadEmployeeMap() {
    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetAll?PageNumber=1&PageSize=1000`;

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const resData = await response.json();
            if (resData && resData.succeeded && resData.data && Array.isArray(resData.data.items)) {
                resData.data.items.forEach(emp => {
                    employeeMap[emp.id] = emp;
                });
                if (currentPaymentsList && currentPaymentsList.length > 0) {
                    renderPaymentRows(currentPaymentsList);
                }
            }
        }
    } catch (e) {
        console.warn('Could not preload employee map:', e);
    }
}

/**
 * Fetches advance payments from API endpoint EmployeeAdvancePayments/GetAll
 */
async function fetchAdvancePayments() {
    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');

    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize
    });

    if (searchTerm) {
        queryParams.append('SearchTerm', searchTerm);
    }
    if (fromDate) {
        queryParams.append('FromDate', fromDate);
    }
    if (toDate) {
        queryParams.append('ToDate', toDate);
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/EmployeeAdvancePayments/GetAll?${queryParams.toString()}`;

    const tbody = document.getElementById('payment-table-body');
    const emptyState = document.getElementById('payment-empty-state');
    const errorAlert = document.getElementById('api-error-alert');

    // Show loading skeleton inside table
    tbody.innerHTML = `
        <tr id="payment-loading-row">
            <td colspan="6" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Loading advance payment records...</div>
            </td>
        </tr>
    `;
    emptyState.classList.add('d-none');
    errorAlert.classList.add('d-none');

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const resData = await response.json();
        console.log('Employee Advance Payments API Response:', resData);

        if (resData && resData.succeeded && resData.data) {
            const dataObj = resData.data;
            const items = dataObj.items || [];
            currentPaymentsList = items;

            totalPages = dataObj.totalPages || 1;
            const totalCount = dataObj.totalCount || items.length;

            if (items.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('d-none');
                updatePaginationInfo(0, 0, 0);
                renderPaginationButtons(1, 1);
                return;
            }

            renderPaymentRows(items);

            const startIdx = ((currentPage - 1) * pageSize) + 1;
            const endIdx = Math.min(currentPage * pageSize, totalCount);
            updatePaginationInfo(startIdx, endIdx, totalCount);
            renderPaginationButtons(currentPage, totalPages);

        } else {
            showApiError(resData.message || 'Failed to retrieve employee advance payments.');
        }

    } catch (error) {
        console.error('Error fetching advance payments list:', error);
        showApiError('Could not connect to backend server at ' + endpoint + '. Ensure the API server is running.');
        tbody.innerHTML = '';
        emptyState.classList.remove('d-none');
        updatePaginationInfo(0, 0, 0);
        renderPaginationButtons(1, 1);
    }
}

/**
 * Renders table rows for advance payments with Employee Image & Details
 */
function renderPaymentRows(items) {
    const tbody = document.getElementById('payment-table-body');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    tbody.innerHTML = items.map(item => {
        const empFromMap = employeeMap[item.employeeId] || {};
        const employeeName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;
        const imagePath = item.imagePath || item.employeeImagePath || item.employeeImage || empFromMap.imagePath;

        const initials = employeeName ? employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
        
        let imgTag = `<div class="emp-initials-avatar fs-6 fw-bold">${initials}</div>`;
        if (imagePath && imagePath.trim() !== '') {
            const fullImgUrl = imagePath.startsWith('http') ? imagePath : `${rootUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
            imgTag = `<img src="${fullImgUrl}" alt="${employeeName}" class="rounded-circle object-fit-cover shadow-sm" style="width: 42px; height: 42px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\'>${initials}</div>';">`;
        }

        const formattedAmount = item.amount ? `৳ ${Number(item.amount).toLocaleString('en-BD', { minimumFractionDigits: 2 })}` : '৳ 0.00';
        const formattedPaymentDate = item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        const formattedCreatedOn = item.createdOn ? new Date(item.createdOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        ${imgTag}
                        <div>
                            <div class="fw-semibold text-dark">${employeeName}</div>
                            <div class="text-muted small">Emp ID: #${item.employeeId}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="fw-bold text-success fs-6">${formattedAmount}</div>
                </td>
                <td>
                    <div class="fw-medium text-dark"><i class="bi bi-calendar-event me-1 text-muted"></i>${formattedPaymentDate}</div>
                </td>
                <td>
                    <div class="text-muted small text-truncate" style="max-width: 250px;" title="${item.description || ''}">
                        ${item.description || 'No description'}
                    </div>
                </td>
                <td>
                    <div class="text-muted small"><i class="bi bi-clock me-1"></i>${formattedCreatedOn}</div>
                </td>
                <td class="pe-4 text-end">
                    <div class="d-inline-flex gap-1 justify-content-end">
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-3 px-2.5 py-1.5" onclick="openPaymentDetailsModal(${item.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-3 px-2.5 py-1.5" onclick="confirmDeleteAdvancePayment(${item.id})" title="Delete Advance Payment">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Opens details modal for a single advance payment record
 */
function openPaymentDetailsModal(paymentId) {
    const item = currentPaymentsList.find(p => p.id === paymentId);
    if (!item) return;

    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    const empFromMap = employeeMap[item.employeeId] || {};
    const employeeName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;
    const imagePath = item.imagePath || item.employeeImagePath || item.employeeImage || empFromMap.imagePath;
    const initials = employeeName ? employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';

    let modalImgHtml = `<div class="emp-initials-avatar fs-5 fw-bold" style="width: 54px; height: 54px;">${initials}</div>`;
    if (imagePath && imagePath.trim() !== '') {
        const fullImgUrl = imagePath.startsWith('http') ? imagePath : `${rootUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
        modalImgHtml = `<img src="${fullImgUrl}" alt="${employeeName}" class="rounded-circle object-fit-cover shadow" style="width: 54px; height: 54px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-5 fw-bold\\' style=\\'width: 54px; height: 54px;\\'>${initials}</div>';">`;
    }

    const formattedAmount = item.amount ? `৳ ${Number(item.amount).toLocaleString('en-BD', { minimumFractionDigits: 2 })}` : '৳ 0.00';
    const formattedPaymentDate = item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    const formattedCreatedOn = item.createdOn ? new Date(item.createdOn).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const formattedUpdatedOn = item.updatedOn ? new Date(item.updatedOn).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

    const modalContent = document.getElementById('modal-payment-content');
    modalContent.innerHTML = `
        <div class="d-flex align-items-center gap-3 p-3 rounded-3 bg-light border mb-3">
            ${modalImgHtml}
            <div>
                <h5 class="fw-bold text-dark mb-1">${employeeName}</h5>
                <div class="badge bg-primary rounded-pill px-3">Emp ID: #${item.employeeId}</div>
            </div>
        </div>

        <div class="row g-3">
            <div class="col-6">
                <div class="p-3 rounded-3 bg-success-subtle border border-success-subtle h-100">
                    <div class="text-success small fw-semibold text-uppercase">Advance Amount</div>
                    <div class="fs-4 fw-bold text-success mt-1">${formattedAmount}</div>
                </div>
            </div>

            <div class="col-6">
                <div class="p-3 rounded-3 bg-light border h-100">
                    <div class="text-muted small fw-semibold text-uppercase">Payment Date</div>
                    <div class="fw-semibold text-dark mt-1">${formattedPaymentDate}</div>
                </div>
            </div>

            <div class="col-12">
                <div class="p-3 rounded-3 bg-light border">
                    <div class="text-muted small fw-semibold text-uppercase mb-1">Reason / Description</div>
                    <div class="text-dark small lh-base">${item.description || 'No description provided.'}</div>
                </div>
            </div>
        </div>
    `;

    const modalEl = document.getElementById('advancePaymentDetailsModal');
    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
}

/**
 * Updates pagination entries info label
 */
function updatePaginationInfo(start, end, total) {
    const infoEl = document.getElementById('pagination-info');
    if (infoEl) {
        infoEl.innerText = `Showing ${start} to ${end} of ${total} entries`;
    }
}

/**
 * Renders pagination buttons
 */
function renderPaginationButtons(current, total) {
    const paginationList = document.getElementById('pagination-list');
    if (!paginationList) return;

    let html = '';

    // Prev Button
    const prevDisabled = current <= 1 ? 'disabled' : '';
    html += `
        <li class="page-item ${prevDisabled}">
            <button class="page-item-link btn btn-sm btn-outline-secondary rounded-2 px-2 py-1 me-1" onclick="changePage(${current - 1})" ${prevDisabled}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    // Page Numbers
    for (let i = 1; i <= total; i++) {
        if (i === current) {
            html += `
                <li class="page-item active">
                    <button class="btn btn-sm btn-primary rounded-2 px-3 py-1 me-1">${i}</button>
                </li>
            `;
        } else {
            html += `
                <li class="page-item">
                    <button class="btn btn-sm btn-outline-secondary rounded-2 px-3 py-1 me-1" onclick="changePage(${i})">${i}</button>
                </li>
            `;
        }
    }

    // Next Button
    const nextDisabled = current >= total ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <button class="page-item-link btn btn-sm btn-outline-secondary rounded-2 px-2 py-1" onclick="changePage(${current + 1})" ${nextDisabled}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    paginationList.innerHTML = html;
}

/**
 * Changes active page and fetches data
 */
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    fetchAdvancePayments();
}

function showApiError(msg) {
    const errorAlert = document.getElementById('api-error-alert');
    const errorMsg = document.getElementById('api-error-message');
    if (errorAlert && errorMsg) {
        errorMsg.innerText = msg;
        errorAlert.classList.remove('d-none');
    }
}

/**
 * Exports advance payments records to Excel (.xlsx) file
 */
function exportToExcel() {
    if (!currentPaymentsList || currentPaymentsList.length === 0) {
        alert('No advance payment data available to export.');
        return;
    }

    const exportData = currentPaymentsList.map((item, index) => ({
        "SL": index + 1,
        "Employee Name": item.employeeName || '',
        "Employee ID": item.employeeId || '',
        "Amount (BDT)": item.amount || 0,
        "Payment Date": item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('en-GB') : '',
        "Description": item.description || '',
        "Created On": item.createdOn ? new Date(item.createdOn).toLocaleDateString('en-GB') : ''
    }));

    if (typeof XLSX !== 'undefined') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0]).map(key => ({
            wch: Math.max(key.length + 3, 14)
        }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Advance Payments");

        const fileName = `Employee_Advance_Payments_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    } else {
        alert('Excel library is loading. Please try again.');
    }
}

/**
 * Exports advance payments records to PDF report
 */
function exportToPDF() {
    if (!currentPaymentsList || currentPaymentsList.length === 0) {
        alert('No advance payment data available to export.');
        return;
    }

    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("Business Solution - Employee Advance Payments Report", 40, 40);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Records: ${currentPaymentsList.length}`, 40, 56);

        const tableColumn = ["SL", "Employee Name", "Amount (BDT)", "Payment Date", "Description"];
        const tableRows = currentPaymentsList.map((item, index) => [
            index + 1,
            item.employeeName || 'N/A',
            item.amount ? Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00',
            item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('en-GB') : 'N/A',
            item.description || 'N/A'
        ]);

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 70,
            theme: 'grid',
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: [30, 41, 59]
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 40, right: 40 }
        });

        const fileName = `Employee_Advance_Payments_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
    } else {
        window.print();
    }
}

/**
 * Opens confirmation modal for deleting an advance payment
 */
function confirmDeleteAdvancePayment(paymentId) {
    const item = currentPaymentsList.find(p => p.id === paymentId);
    if (!item) return;

    paymentToDeleteId = paymentId;
    const empFromMap = employeeMap[item.employeeId] || {};
    const employeeName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;

    const nameEl = document.getElementById('delete-employee-name');
    if (nameEl) {
        nameEl.innerText = `${employeeName} (Record #${paymentId})`;
    }

    const errorAlert = document.getElementById('delete-modal-error');
    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }

    // Reset button state
    const confirmBtn = document.getElementById('btn-confirm-delete');
    const confirmBtnText = document.getElementById('btn-confirm-delete-text');
    const cancelBtn = document.getElementById('btn-cancel-delete');
    if (confirmBtn && confirmBtnText) {
        confirmBtn.disabled = false;
        confirmBtnText.innerText = 'Delete';
    }
    if (cancelBtn) {
        cancelBtn.disabled = false;
    }

    const modalEl = document.getElementById('deleteConfirmationModal');
    if (modalEl) {
        deleteModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        deleteModalInstance.show();
    }
}

/**
 * Sends DELETE request to API endpoint https://localhost:7148/api/EmployeeAdvancePayments/{id}
 */
async function executeDeleteAdvancePayment() {
    if (!paymentToDeleteId) return;

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/EmployeeAdvancePayments/${paymentToDeleteId}`;

    const confirmBtn = document.getElementById('btn-confirm-delete');
    const confirmBtnText = document.getElementById('btn-confirm-delete-text');
    const cancelBtn = document.getElementById('btn-cancel-delete');
    const errorAlert = document.getElementById('delete-modal-error');
    const errorText = document.getElementById('delete-modal-error-text');

    // UI Loading state
    if (confirmBtn && confirmBtnText) {
        confirmBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        confirmBtnText.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Deleting...`;
    }
    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const resData = await response.json();
        console.log('Delete Advance Payment API Response:', resData);

        if (response.ok && resData && resData.succeeded) {
            // Hide delete modal
            if (deleteModalInstance) {
                deleteModalInstance.hide();
            }

            // Show Toast notification
            showToast(resData.message || 'Employee advance payment successfully deleted.', 'success');

            // If last record on current page was deleted and page > 1, go back 1 page
            if (currentPaymentsList.length === 1 && currentPage > 1) {
                currentPage--;
            }

            paymentToDeleteId = null;
            // Refresh table
            fetchAdvancePayments();
        } else {
            const errorMsg = resData?.message || 'Failed to delete advance payment.';
            if (errorAlert && errorText) {
                errorText.innerText = errorMsg;
                errorAlert.classList.remove('d-none');
                errorAlert.classList.add('d-flex');
            }
            if (confirmBtn && confirmBtnText) {
                confirmBtn.disabled = false;
                if (cancelBtn) cancelBtn.disabled = false;
                confirmBtnText.innerText = 'Delete';
            }
        }
    } catch (error) {
        console.error('Error deleting advance payment:', error);
        if (errorAlert && errorText) {
            errorText.innerText = 'Network error: Unable to connect to server.';
            errorAlert.classList.remove('d-none');
            errorAlert.classList.add('d-flex');
        }
        if (confirmBtn && confirmBtnText) {
            confirmBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            confirmBtnText.innerText = 'Delete';
        }
    }
}

/**
 * Displays Toast notification
 */
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('app-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMessage || !toastIcon) return;

    toastMessage.innerText = message;
    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');
    toastIcon.className = 'bi fs-5';

    if (type === 'success') {
        toastEl.classList.add('bg-success');
        toastIcon.classList.add('bi-check-circle-fill');
    } else if (type === 'danger' || type === 'error') {
        toastEl.classList.add('bg-danger');
        toastIcon.classList.add('bi-x-circle-fill');
    } else {
        toastEl.classList.add('bg-primary');
        toastIcon.classList.add('bi-info-circle-fill');
    }

    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 });
    toast.show();
}

let createSearchDebounceTimer = null;

/**
 * Initializes Create Advance Payment Modal & Form Handlers
 */
function initCreateModalAndForm() {
    const createForm = document.getElementById('create-advance-payment-form');
    const paymentDateInput = document.getElementById('create-payment-date');
    const createModalEl = document.getElementById('createAdvancePaymentModal');

    // Default payment date to today
    if (paymentDateInput && !paymentDateInput.value) {
        paymentDateInput.value = new Date().toISOString().substring(0, 10);
    }

    if (createForm) {
        createForm.addEventListener('submit', executeCreateAdvancePayment);
    }

    // Reset create modal when opened
    if (createModalEl) {
        createModalEl.addEventListener('show.bs.modal', () => {
            const errorAlert = document.getElementById('create-modal-error');
            if (errorAlert) {
                errorAlert.classList.add('d-none');
                errorAlert.classList.remove('d-flex');
            }
            if (paymentDateInput && !paymentDateInput.value) {
                paymentDateInput.value = new Date().toISOString().substring(0, 10);
            }
        });
    }

    initCreateEmployeeAutocomplete();
}

/**
 * Initializes Employee Searchable Combobox inside Create Modal (min 3 chars trigger)
 */
function initCreateEmployeeAutocomplete() {
    const searchInput = document.getElementById('create-employee-search-input');
    const hiddenInput = document.getElementById('create-employee-id');
    const clearBtn = document.getElementById('create-btn-clear-employee');
    const menu = document.getElementById('create-employee-suggestions-menu');

    if (!searchInput || !menu) return;

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();

        // If user changed input, reset hidden ID unless matches selected
        if (hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            if (clearBtn) clearBtn.classList.add('d-none');
        }

        if (val.length < 3) {
            menu.classList.add('d-none');
            if (val.length === 0) {
                hiddenInput.value = '';
                if (clearBtn) clearBtn.classList.add('d-none');
            }
            return;
        }

        clearTimeout(createSearchDebounceTimer);
        createSearchDebounceTimer = setTimeout(() => {
            searchCreateModalEmployees(val);
        }, 300);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            hiddenInput.value = '';
            searchInput.removeAttribute('data-selected-name');
            clearBtn.classList.add('d-none');
            menu.classList.add('d-none');
        });
    }

    // Hide dropdown when clicking outside create search container
    document.addEventListener('click', (e) => {
        const container = document.getElementById('create-employee-search-container');
        if (container && !container.contains(e.target)) {
            menu.classList.add('d-none');
        }
    });
}

/**
 * Calls API GET Employees/GetByName/{query} for Create Modal Autocomplete
 */
async function searchCreateModalEmployees(nameQuery) {
    const list = document.getElementById('create-employee-suggestions-list');
    const menu = document.getElementById('create-employee-suggestions-menu');
    if (!list || !menu) return;

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetByName/${encodeURIComponent(nameQuery)}`;

    list.innerHTML = `
        <div class="p-3 text-center text-muted small">
            <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span> Searching employees...
        </div>
    `;
    menu.classList.remove('d-none');

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const resData = await response.json();
        console.log('Create Modal Employees GetByName API Response:', resData);

        if (resData && resData.succeeded && Array.isArray(resData.data)) {
            const employees = resData.data;

            if (employees.length === 0) {
                list.innerHTML = `<div class="p-3 text-center text-muted small"><i class="bi bi-info-circle me-1"></i>No employees found for "${nameQuery}".</div>`;
                return;
            }

            list.innerHTML = employees.map(emp => {
                employeeMap[emp.id] = emp;
                const initials = emp.name ? emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
                let imgHtml = `<div class="emp-initials-avatar fs-6 fw-bold" style="width:32px;height:32px;">${initials}</div>`;
                if (emp.imagePath && emp.imagePath.trim() !== '') {
                    const fullImgUrl = emp.imagePath.startsWith('http') ? emp.imagePath : `${rootUrl}${emp.imagePath.startsWith('/') ? '' : '/'}${emp.imagePath}`;
                    imgHtml = `<img src="${fullImgUrl}" alt="${emp.name}" class="rounded-circle object-fit-cover shadow-sm" style="width: 32px; height: 32px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\' style=\\'width:32px;height:32px;\\'>${initials}</div>';">`;
                }

                return `
                    <button type="button" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 create-employee-suggestion-item" data-id="${emp.id}" data-name="${emp.name}">
                        <div class="d-flex align-items-center gap-2 overflow-hidden">
                            ${imgHtml}
                            <div class="text-truncate">
                                <div class="fw-semibold text-dark text-truncate small mb-0">${emp.name}</div>
                                <div class="text-muted small text-truncate" style="font-size: 0.725rem;">${emp.designation || 'Employee'}</div>
                            </div>
                        </div>
                        <span class="badge bg-light text-secondary border ms-2">ID #${emp.id}</span>
                    </button>
                `;
            }).join('');

            list.querySelectorAll('.create-employee-suggestion-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const empId = btn.getAttribute('data-id');
                    const empName = btn.getAttribute('data-name');
                    selectCreateModalEmployee(empId, empName);
                });
            });

        } else {
            list.innerHTML = `<div class="p-3 text-center text-muted small">${resData.message || 'Failed to load employees.'}</div>`;
        }

    } catch (err) {
        console.error('Error searching employees by name for create modal:', err);
        list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to API.</div>`;
    }
}

/**
 * Handles selecting an employee from suggestion list in Create Modal
 */
function selectCreateModalEmployee(empId, empName) {
    const searchInput = document.getElementById('create-employee-search-input');
    const hiddenInput = document.getElementById('create-employee-id');
    const clearBtn = document.getElementById('create-btn-clear-employee');
    const menu = document.getElementById('create-employee-suggestions-menu');

    if (searchInput) {
        searchInput.value = empName;
        searchInput.setAttribute('data-selected-name', empName);
    }
    if (hiddenInput) {
        hiddenInput.value = empId;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    if (menu) menu.classList.add('d-none');
}

/**
 * Sends POST request to https://localhost:7148/api/EmployeeAdvancePayments
 */
async function executeCreateAdvancePayment(e) {
    e.preventDefault();

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/EmployeeAdvancePayments`;

    const employeeIdVal = document.getElementById('create-employee-id').value;
    const amountVal = document.getElementById('create-amount').value;
    const paymentDateVal = document.getElementById('create-payment-date').value;
    const descriptionVal = document.getElementById('create-description').value.trim();

    const errorAlert = document.getElementById('create-modal-error');

    if (!employeeIdVal || isNaN(parseInt(employeeIdVal, 10))) {
        showCreateModalError('Please search and select a valid employee from the dropdown list.');
        return;
    }

    const employeeId = parseInt(employeeIdVal, 10);
    const amount = parseFloat(amountVal);

    if (isNaN(amount) || amount <= 0) {
        showCreateModalError('Please enter a valid positive payment amount.');
        return;
    }

    if (!paymentDateVal) {
        showCreateModalError('Please select a payment date.');
        return;
    }

    const paymentDateObj = new Date(paymentDateVal);
    const paymentDateIso = paymentDateObj.toISOString();

    const payload = {
        id: 0,
        employeeId: employeeId,
        amount: amount,
        paymentDate: paymentDateIso,
        description: descriptionVal
    };

    console.log('Sending Create Advance Payment Payload:', payload);

    const saveBtn = document.getElementById('btn-save-advance-payment');
    const saveBtnText = document.getElementById('btn-save-text');
    const saveSpinner = document.getElementById('save-spinner');

    if (saveBtn && saveBtnText && saveSpinner) {
        saveBtn.disabled = true;
        saveBtnText.innerText = 'Saving...';
        saveSpinner.classList.remove('d-none');
    }
    if (errorAlert) {
        errorAlert.classList.add('d-none');
        errorAlert.classList.remove('d-flex');
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        console.log('Create Advance Payment API Response:', resData);

        if (response.ok && resData && resData.succeeded) {
            // Close modal
            const createModalEl = document.getElementById('createAdvancePaymentModal');
            if (createModalEl) {
                const modalInstance = bootstrap.Modal.getInstance(createModalEl);
                if (modalInstance) modalInstance.hide();
            }

            // Reset form
            document.getElementById('create-advance-payment-form').reset();
            document.getElementById('create-employee-id').value = '';
            document.getElementById('create-payment-date').value = new Date().toISOString().substring(0, 10);
            const clearBtn = document.getElementById('create-btn-clear-employee');
            if (clearBtn) clearBtn.classList.add('d-none');

            // Show Toast notification
            showToast(resData.message || 'Employee advance payment successfully created.', 'success');

            // Reset pagination and refresh list
            currentPage = 1;
            fetchAdvancePayments();
        } else {
            const errorMsg = resData?.message || 'Failed to create advance payment record.';
            showCreateModalError(errorMsg);
        }
    } catch (err) {
        console.error('Error creating advance payment:', err);
        showCreateModalError('Network error: Unable to connect to server.');
    } finally {
        if (saveBtn && saveBtnText && saveSpinner) {
            saveBtn.disabled = false;
            saveBtnText.innerText = 'Save Advance Payment';
            saveSpinner.classList.add('d-none');
        }
    }
}

function showCreateModalError(msg) {
    const errorAlert = document.getElementById('create-modal-error');
    const errorText = document.getElementById('create-modal-error-text');
    if (errorAlert && errorText) {
        errorText.innerText = msg;
        errorAlert.classList.remove('d-none');
        errorAlert.classList.add('d-flex');
    }
}
