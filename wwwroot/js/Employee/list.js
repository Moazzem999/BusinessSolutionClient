/* ==========================================================================
   Business Solution Client - Employee List Page JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let totalPages = 1;
let currentEmployeesList = [];

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
                    <button type="button" class="btn btn-sm btn-outline-primary rounded-3 px-3 fw-medium" onclick="openEmployeeModal(${emp.id})">
                        <i class="bi bi-eye me-1"></i> Details
                    </button>
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
    const religionStr = emp.religion === 1 ? 'Islam' : (emp.religion === 2 ? 'Hinduism' : (emp.religion === 3 ? 'Buddhism' : 'Christianity / Other'));
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
