/* ==========================================================================
   Business Solution Client - Employee List Page JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let totalPages = 1;
let currentEmployeesList = [];
let employeeToDeleteId = null;
let deleteModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initEmployeeListPage();
});

function initEmployeeListPage() {
    const searchForm = document.getElementById('employee-search-form');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = document.getElementById('search-input').value.trim();
            searchTerm = inputVal;
            currentPage = 1;
            fetchEmployees();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            searchTerm = '';
            currentPage = 1;
            fetchEmployees();
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            fetchEmployees();
        });
    }

    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');

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

    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteEmployee);
    }

    // Initial load
    fetchEmployees();
}

/**
 * Fetches employees from the API with pagination and search parameters
 */
async function fetchEmployees() {
    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    
    // Construct root domain for relative images (e.g., https://localhost:7148)
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize
    });
    if (searchTerm) {
        queryParams.append('SearchTerm', searchTerm);
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetAll?${queryParams.toString()}`;

    const tbody = document.getElementById('emp-table-body');
    const emptyState = document.getElementById('emp-empty-state');
    const errorAlert = document.getElementById('api-error-alert');

    // Show loading skeleton inside table
    tbody.innerHTML = `
        <tr id="emp-loading-row">
            <td colspan="6" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Loading employee data...</div>
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
        console.log('Employee List API Response:', resData);

        if (resData && resData.succeeded && resData.data) {
            const dataObj = resData.data;
            const items = dataObj.items || [];
            currentEmployeesList = items;

            totalPages = dataObj.totalPages || 1;
            const totalCount = dataObj.totalCount || items.length;

            if (items.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('d-none');
                updatePaginationInfo(0, 0, 0);
                renderPaginationButtons(1, 1);
                return;
            }

            renderEmployeeRows(items, rootUrl);

            const startIdx = ((currentPage - 1) * pageSize) + 1;
            const endIdx = Math.min(currentPage * pageSize, totalCount);
            updatePaginationInfo(startIdx, endIdx, totalCount);
            renderPaginationButtons(currentPage, totalPages);

        } else {
            showApiError(resData.message || 'Failed to retrieve employees data.');
        }

    } catch (error) {
        console.error('Error fetching employee list:', error);
        showApiError('Could not connect to backend server at ' + endpoint + '. Ensure the API server is running.');
        tbody.innerHTML = '';
        emptyState.classList.remove('d-none');
        updatePaginationInfo(0, 0, 0);
        renderPaginationButtons(1, 1);
    }
}

/**
 * Renders employee table rows
 */
function renderEmployeeRows(items, rootUrl) {
    const tbody = document.getElementById('emp-table-body');
    
    tbody.innerHTML = items.map(emp => {
        const initials = emp.name ? emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
        
        // Full Image URL logic
        let imgTag = `<div class="emp-initials-avatar fs-6 fw-bold">${initials}</div>`;
        if (emp.imagePath && emp.imagePath.trim() !== '') {
            const fullImgUrl = emp.imagePath.startsWith('http') ? emp.imagePath : `${rootUrl}${emp.imagePath.startsWith('/') ? '' : '/'}${emp.imagePath}`;
            imgTag = `<img src="${fullImgUrl}" alt="${emp.name}" class="rounded-circle object-fit-cover shadow-sm" style="width: 42px; height: 42px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\'>${initials}</div>';">`;
        }

        const formattedSalary = emp.salary ? `৳ ${Number(emp.salary).toLocaleString('en-BD')}` : 'N/A';
        const formattedJoining = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        ${imgTag}
                        <div>
                            <div class="fw-semibold text-dark">${emp.name || 'Unnamed'}</div>
                            <div class="text-muted small">${emp.email || 'No email'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="fw-medium text-dark"><i class="bi bi-telephone me-1 text-muted"></i>${emp.mobile || 'N/A'}</div>
                    <div class="text-muted small"><i class="bi bi-card-heading me-1 text-muted"></i>NID: ${emp.nidNo || 'N/A'}</div>
                </td>
                <td>
                    <span class="badge bg-primary-subtle text-primary fw-medium px-2.5 py-1 rounded-2">${emp.designation || 'General Employee'}</span>
                    <div class="text-muted small mt-1"><i class="bi bi-mortarboard me-1"></i>${emp.academicQualification || 'N/A'}</div>
                </td>
                <td>
                    <div class="fw-semibold text-success">${formattedSalary}</div>
                    <div class="text-muted small"><i class="bi bi-calendar-event me-1"></i>${formattedJoining}</div>
                </td>
                <td>
                    <div class="text-muted small text-truncate" style="max-width: 220px;" title="${emp.presentAddress || ''}">
                        <i class="bi bi-geo-alt me-1"></i>${emp.presentAddress || 'N/A'}
                    </div>
                </td>
                <td class="pe-4 text-end">
                    <div class="d-inline-flex gap-1 justify-content-end">
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-3 px-2.5 py-1.5" onclick="openEmployeeModal(${emp.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-3 px-2.5 py-1.5" onclick="confirmDeleteEmployee(${emp.id})" title="Delete Employee">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Displays detailed information of an employee in a Bootstrap modal
 */
function openEmployeeModal(empId) {
    if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, behavior: 'instant' });
    }
    const emp = currentEmployeesList.find(e => e.id === empId);
    if (!emp) return;

    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    const initials = emp.name ? emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
    let profileImgHtml = `<div class="emp-initials-avatar fs-2 fw-bold" style="width: 80px; height: 80px;">${initials}</div>`;
    if (emp.imagePath && emp.imagePath.trim() !== '') {
        const fullImgUrl = emp.imagePath.startsWith('http') ? emp.imagePath : `${rootUrl}${emp.imagePath.startsWith('/') ? '' : '/'}${emp.imagePath}`;
        profileImgHtml = `<img src="${fullImgUrl}" alt="${emp.name}" class="rounded-circle object-fit-cover shadow" style="width: 80px; height: 80px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-2 fw-bold\\' style=\\'width: 80px; height: 80px;\\'>${initials}</div>';">`;
    }

    let nidImgHtml = '<span class="text-muted small">No NID Image Available</span>';
    if (emp.nidImagePath && emp.nidImagePath.trim() !== '') {
        const fullNidUrl = emp.nidImagePath.startsWith('http') ? emp.nidImagePath : `${rootUrl}${emp.nidImagePath.startsWith('/') ? '' : '/'}${emp.nidImagePath}`;
        nidImgHtml = `<a href="${fullNidUrl}" target="_blank" class="d-inline-block border rounded-3 p-1 bg-light"><img src="${fullNidUrl}" alt="NID Document" class="img-fluid rounded-2" style="max-height: 120px;" onerror="this.parentNode.innerHTML='<span class=\\'text-muted small\\'>Image Unavailable</span>';"></a>`;
    }

    const maritalStatusStr = emp.maritalStatus === 1 ? 'Single' : (emp.maritalStatus === 2 ? 'Married' : 'Other');
    const religionStr = emp.religion === 1 ? 'Islam' : (emp.religion === 2 ? 'Hinduism' : (emp.religion === 3 ? 'Christianity' : (emp.religion === 4 ? 'Buddhism' : 'Others')));
    const formattedDob = emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    const formattedJoining = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    const formattedSalary = emp.salary ? `৳ ${Number(emp.salary).toLocaleString('en-BD')}` : 'N/A';

    const modalContent = document.getElementById('modal-employee-content');
    modalContent.innerHTML = `
        <div class="d-flex align-items-center gap-4 mb-4 pb-3 border-bottom">
            ${profileImgHtml}
            <div>
                <h4 class="fw-bold mb-1 text-dark">${emp.name || 'Unnamed Employee'}</h4>
                <div class="badge bg-primary text-white mb-2 px-3 py-1 rounded-pill">${emp.designation || 'Employee'}</div>
                <div class="text-muted small"><i class="bi bi-envelope me-1"></i>${emp.email || 'N/A'} | <i class="bi bi-telephone me-1"></i>${emp.mobile || 'N/A'}</div>
            </div>
        </div>

        <div class="row g-3">
            <div class="col-md-6">
                <div class="p-3 rounded-3 bg-light border-0">
                    <div class="text-muted small fw-semibold text-uppercase mb-2">Personal Information</div>
                    <ul class="list-unstyled mb-0 small lh-lg text-dark">
                        <li><strong>Father's Name:</strong> ${emp.fatherName || 'N/A'}</li>
                        <li><strong>NID Number:</strong> ${emp.nidNo || 'N/A'}</li>
                        <li><strong>Date of Birth:</strong> ${formattedDob}</li>
                        <li><strong>Marital Status:</strong> ${maritalStatusStr}</li>
                        <li><strong>Religion:</strong> ${religionStr}</li>
                    </ul>
                </div>
            </div>

            <div class="col-md-6">
                <div class="p-3 rounded-3 bg-light border-0">
                    <div class="text-muted small fw-semibold text-uppercase mb-2">Job & Salary Details</div>
                    <ul class="list-unstyled mb-0 small lh-lg text-dark">
                        <li><strong>Designation:</strong> ${emp.designation || 'N/A'}</li>
                        <li><strong>Academic Qual.:</strong> ${emp.academicQualification || 'N/A'}</li>
                        <li><strong>Joining Date:</strong> ${formattedJoining}</li>
                        <li><strong>Salary:</strong> <span class="text-success fw-bold">${formattedSalary}</span></li>
                        <li><strong>Employee ID:</strong> #${emp.id}</li>
                    </ul>
                </div>
            </div>

            <div class="col-12">
                <div class="p-3 rounded-3 bg-light border-0">
                    <div class="text-muted small fw-semibold text-uppercase mb-2">Address Information</div>
                    <div class="row g-2 small text-dark">
                        <div class="col-md-6">
                            <strong>Present Address:</strong><br>
                            <span class="text-muted">${emp.presentAddress || 'N/A'}</span>
                        </div>
                        <div class="col-md-6">
                            <strong>Permanent Address:</strong><br>
                            <span class="text-muted">${emp.permanentAddress || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="p-3 rounded-3 bg-light border-0">
                    <div class="text-muted small fw-semibold text-uppercase mb-2">NID Document</div>
                    ${nidImgHtml}
                </div>
            </div>
        </div>
    `;

    const modalEl = document.getElementById('employeeDetailsModal');
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
    fetchEmployees();
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
 * Exports currently loaded employee records to an Excel (.xlsx) file
 */
function exportToExcel() {
    if (!currentEmployeesList || currentEmployeesList.length === 0) {
        alert('No employee data available to export.');
        return;
    }

    const exportData = currentEmployeesList.map((emp, index) => {
        const maritalStatusStr = emp.maritalStatus === 1 ? 'Single' : (emp.maritalStatus === 2 ? 'Married' : 'Other');
        const religionStr = emp.religion === 1 ? 'Islam' : (emp.religion === 2 ? 'Hinduism' : (emp.religion === 3 ? 'Christianity' : (emp.religion === 4 ? 'Buddhism' : 'Others')));
        const formattedDob = emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString('en-GB') : '';
        const formattedJoining = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB') : '';

        return {
            "SL": index + 1,
            "Employee Name": emp.name || '',
            "Father Name": emp.fatherName || '',
            "Email": emp.email || '',
            "Mobile": emp.mobile || '',
            "NID Number": emp.nidNo || '',
            "Designation": emp.designation || '',
            "Academic Qualification": emp.academicQualification || '',
            "Date of Birth": formattedDob,
            "Marital Status": maritalStatusStr,
            "Religion": religionStr,
            "Joining Date": formattedJoining,
            "Salary (BDT)": emp.salary || 0,
            "Present Address": emp.presentAddress || '',
            "Permanent Address": emp.permanentAddress || ''
        };
    });

    if (typeof XLSX !== 'undefined') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Set column widths
        const colWidths = Object.keys(exportData[0]).map(key => ({
            wch: Math.max(key.length + 3, 14)
        }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Directory");

        const fileName = `Employee_List_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    } else {
        alert('Excel library is loading. Please try again.');
    }
}

/**
 * Exports currently loaded employee records to a PDF report
 */
function exportToPDF() {
    if (!currentEmployeesList || currentEmployeesList.length === 0) {
        alert('No employee data available to export.');
        return;
    }

    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

        // Header Title & Meta Info
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235); // Primary blue
        doc.text("Business Solution - Employee Directory Report", 40, 40);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // Muted gray
        doc.text(`Generated on: ${new Date().toLocaleString()} | Total Records: ${currentEmployeesList.length}`, 40, 56);

        const tableColumn = ["SL", "Name", "Designation", "Email", "Mobile", "NID No", "Salary (BDT)", "Joining Date"];
        const tableRows = currentEmployeesList.map((emp, index) => [
            index + 1,
            emp.name || 'N/A',
            emp.designation || 'N/A',
            emp.email || 'N/A',
            emp.mobile || 'N/A',
            emp.nidNo || 'N/A',
            emp.salary ? Number(emp.salary).toLocaleString('en-US') : 'N/A',
            emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB') : 'N/A'
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

        const fileName = `Employee_List_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
    } else {
        window.print();
    }
}

/**
 * Opens confirmation modal for deleting an employee
 */
function confirmDeleteEmployee(empId) {
    const emp = currentEmployeesList.find(e => e.id === empId);
    if (!emp) return;

    employeeToDeleteId = empId;
    const nameEl = document.getElementById('delete-employee-name');
    if (nameEl) {
        nameEl.innerText = emp.name || `ID #${empId}`;
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
 * Sends DELETE request to API endpoint https://localhost:7148/api/Employees/{id}
 */
async function executeDeleteEmployee() {
    if (!employeeToDeleteId) return;

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/${employeeToDeleteId}`;

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
        console.log('Delete Employee API Response:', resData);

        if (response.ok && resData && resData.succeeded) {
            // Hide delete modal
            if (deleteModalInstance) {
                deleteModalInstance.hide();
            }

            // Show Toast notification
            showToast(resData.message || 'Employee successfully deleted.', 'success');

            // If last record on current page was deleted and page > 1, go back 1 page
            if (currentEmployeesList.length === 1 && currentPage > 1) {
                currentPage--;
            }

            employeeToDeleteId = null;
            // Refresh employee table
            fetchEmployees();
        } else {
            const errorMsg = resData?.message || 'Failed to delete employee.';
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
        console.error('Error deleting employee:', error);
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
 * Displays a modern Toast notification
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

