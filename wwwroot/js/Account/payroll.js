/* ==========================================================================
   Business Solution Client - Employee Salaries / Payroll JavaScript
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let selectedEmployeeId = '';
let totalPages = 1;
let currentSalariesList = [];
let employeeMap = {};
let allEmployeesList = [];
let salaryToDeleteId = null;
let deleteModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initPayrollPage();
});

function initPayrollPage() {
    const searchForm = document.getElementById('salary-search-form');
    const resetBtn = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const employeeFilterSelect = document.getElementById('employee-filter-select');
    const pdfBtn = document.getElementById('btn-export-pdf');
    const excelBtn = document.getElementById('btn-export-excel');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchTerm = document.getElementById('search-input').value.trim();
            selectedEmployeeId = employeeFilterSelect ? employeeFilterSelect.value : '';
            currentPage = 1;
            fetchSalaries();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            if (employeeFilterSelect) employeeFilterSelect.value = '';
            searchTerm = '';
            selectedEmployeeId = '';
            currentPage = 1;
            fetchSalaries();
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            fetchSalaries();
        });
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', exportToPDF);
    }

    if (excelBtn) {
        excelBtn.addEventListener('click', exportToExcel);
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDeleteSalary);
    }

    // Attach auto-calculation handlers for Create & Edit forms
    initTotalCalculation();

    // Initialize Employee Autocomplete for Create and Update Modals
    initEmployeeAutocomplete('create');
    initEmployeeAutocomplete('update');

    // Initialize Form Submissions
    initCreateModalAndForm();
    initUpdateModalAndForm();

    // Preload Employee Dataset
    preloadEmployeeMap();

    // Initial load of salaries
    fetchSalaries();
}

/**
 * Live auto-calculation for Net Total Salary: Salary - AdvancePayment + BonusPayment + OthersBill
 */
function initTotalCalculation() {
    const createInputs = document.querySelectorAll('.calc-trigger');
    createInputs.forEach(input => {
        input.addEventListener('input', calculateCreateTotal);
    });

    const updateInputs = document.querySelectorAll('.calc-trigger-update');
    updateInputs.forEach(input => {
        input.addEventListener('input', calculateUpdateTotal);
    });
}

function calculateCreateTotal() {
    const salary = parseFloat(document.getElementById('create-salary').value) || 0;
    const advance = parseFloat(document.getElementById('create-advance-payment').value) || 0;
    const bonus = parseFloat(document.getElementById('create-bonus-payment').value) || 0;
    const others = parseFloat(document.getElementById('create-others-bill').value) || 0;

    const total = salary - advance + bonus + others;
    document.getElementById('create-total').value = total.toFixed(2);
    document.getElementById('create-total-display').textContent = `৳ ${total.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateUpdateTotal() {
    const salary = parseFloat(document.getElementById('update-salary').value) || 0;
    const advance = parseFloat(document.getElementById('update-advance-payment').value) || 0;
    const bonus = parseFloat(document.getElementById('update-bonus-payment').value) || 0;
    const others = parseFloat(document.getElementById('update-others-bill').value) || 0;

    const total = salary - advance + bonus + others;
    document.getElementById('update-total').value = total.toFixed(2);
    document.getElementById('update-total-display').textContent = `৳ ${total.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Preloads employee map for images, names, and filter dropdown
 */
async function preloadEmployeeMap() {
    const token = getAuthToken();
    const baseUrl = getBaseApiUrl();
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
                allEmployeesList = resData.data.items;
                const filterSelect = document.getElementById('employee-filter-select');
                
                allEmployeesList.forEach(emp => {
                    employeeMap[emp.id] = emp;
                    if (filterSelect) {
                        const opt = document.createElement('option');
                        opt.value = emp.id;
                        opt.textContent = `${emp.name || emp.firstName + ' ' + emp.lastName} (#${emp.id})`;
                        filterSelect.appendChild(opt);
                    }
                });

                if (currentSalariesList && currentSalariesList.length > 0) {
                    renderSalaryRows(currentSalariesList);
                }
            }
        }
    } catch (e) {
        console.warn('Could not preload employee map:', e);
    }
}

/**
 * Fetches employee salaries from API: GET /api/EmployeeSalaries/GetAll
 */
async function fetchSalaries() {
    const token = getAuthToken();
    const baseUrl = getBaseApiUrl();

    const queryParams = new URLSearchParams({
        PageNumber: currentPage,
        PageSize: pageSize
    });

    if (searchTerm) {
        queryParams.append('SearchTerm', searchTerm);
    }
    if (selectedEmployeeId) {
        queryParams.append('EmployeeId', selectedEmployeeId);
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries/GetAll?${queryParams.toString()}`;

    const tbody = document.getElementById('salary-table-body');
    const emptyState = document.getElementById('salary-empty-state');
    const errorAlert = document.getElementById('api-error-alert');

    tbody.innerHTML = `
        <tr id="salary-loading-row">
            <td colspan="8" class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted small mt-2">Loading salary records...</div>
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

        if (resData && resData.succeeded && resData.data) {
            const dataObj = resData.data;
            const items = dataObj.items || [];
            currentSalariesList = items;

            totalPages = dataObj.totalPages || 1;
            const totalCount = dataObj.totalCount || items.length;

            if (items.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('d-none');
                updatePaginationInfo(0, 0, 0);
                renderPaginationButtons(1, 1);
                return;
            }

            renderSalaryRows(items);

            const startIdx = ((currentPage - 1) * pageSize) + 1;
            const endIdx = Math.min(currentPage * pageSize, totalCount);
            updatePaginationInfo(startIdx, endIdx, totalCount);
            renderPaginationButtons(currentPage, totalPages);

        } else {
            showApiError(resData.message || 'Failed to retrieve employee salary records.');
        }

    } catch (error) {
        console.error('Error fetching salary records:', error);
        showApiError('Could not connect to backend server at ' + endpoint);
        tbody.innerHTML = '';
        emptyState.classList.remove('d-none');
        updatePaginationInfo(0, 0, 0);
        renderPaginationButtons(1, 1);
    }
}

/**
 * Renders table rows for salary records
 */
function renderSalaryRows(items) {
    const tbody = document.getElementById('salary-table-body');
    const baseUrl = getBaseApiUrl();
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    tbody.innerHTML = items.map(item => {
        const empFromMap = employeeMap[item.employeeId] || {};
        const employeeName = item.employeeName || empFromMap.name || empFromMap.firstName ? `${empFromMap.firstName} ${empFromMap.lastName}` : `Employee #${item.employeeId}`;
        const imagePath = item.imagePath || item.employeeImagePath || empFromMap.imagePath;

        const initials = employeeName ? employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
        
        let imgTag = `<div class="emp-initials-avatar fs-6 fw-bold">${initials}</div>`;
        if (imagePath && imagePath.trim() !== '') {
            const fullImgUrl = imagePath.startsWith('http') ? imagePath : `${rootUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
            imgTag = `<img src="${fullImgUrl}" alt="${employeeName}" class="rounded-circle object-fit-cover shadow-sm" style="width: 42px; height: 42px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\'>${initials}</div>';">`;
        }

        const formatCurrency = (val) => `৳ ${Number(val || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        ${imgTag}
                        <div>
                            <div class="fw-semibold text-dark">${escapeHtml(employeeName)}</div>
                            <div class="text-muted small">Emp ID: #${item.employeeId}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border px-2 py-1 fw-semibold rounded-2">${escapeHtml(item.paySlipFor || 'N/A')}</span>
                </td>
                <td class="fw-medium text-dark">${formatCurrency(item.salary)}</td>
                <td class="text-danger">${formatCurrency(item.advancePayment)}</td>
                <td class="text-success">${formatCurrency(item.bonusPayment)}</td>
                <td class="text-info-emphasis">${formatCurrency(item.othersBill)}</td>
                <td class="fw-bold text-primary fs-6">${formatCurrency(item.total)}</td>
                <td class="pe-4 text-end">
                    <div class="d-flex align-items-center justify-content-end gap-1">
                        <button type="button" class="btn btn-sm btn-outline-info rounded-2 px-2 py-1" onclick="openDetailsModal(${item.id})" title="View Payslip">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-warning rounded-2 px-2 py-1" onclick="openUpdateModal(${item.id})" title="Edit Record">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-2 px-2 py-1" onclick="confirmDeleteSalary(${item.id}, '${escapeHtml(employeeName)}', '${escapeHtml(item.paySlipFor || '')}')" title="Delete Record">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Autocomplete for Employee Selection in Modals (min 3 chars trigger + keyboard navigation)
 */
let searchDebounceTimers = {};
let currentFocusedSuggestionIndex = -1;

function initEmployeeAutocomplete(prefix) {
    const searchInput = document.getElementById(`${prefix}-employee-search-input`);
    const hiddenInput = document.getElementById(`${prefix}-employee-id`);
    const clearBtn = document.getElementById(`${prefix}-btn-clear-employee`);
    const menu = document.getElementById(`${prefix}-employee-suggestions-menu`);
    const container = document.getElementById(`${prefix}-employee-search-container`);

    if (!searchInput || !menu) return;

    // Handle Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        const list = document.getElementById(`${prefix}-employee-suggestions-list`);
        if (!list) return;

        const items = list.querySelectorAll(`.${prefix}-employee-suggestion-item`);
        if (!items || items.length === 0 || menu.classList.contains('d-none') || menu.style.display === 'none') {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocusedSuggestionIndex++;
            if (currentFocusedSuggestionIndex >= items.length) {
                currentFocusedSuggestionIndex = 0;
            }
            updateSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocusedSuggestionIndex--;
            if (currentFocusedSuggestionIndex < 0) {
                currentFocusedSuggestionIndex = items.length - 1;
            }
            updateSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (currentFocusedSuggestionIndex >= 0 && currentFocusedSuggestionIndex < items.length) {
                e.preventDefault();
                const selectedBtn = items[currentFocusedSuggestionIndex];
                const empId = selectedBtn.getAttribute('data-id');
                const empName = selectedBtn.getAttribute('data-name');
                selectModalEmployee(prefix, empId, empName);
            }
        } else if (e.key === 'Escape') {
            menu.classList.add('d-none');
            menu.style.display = 'none';
            currentFocusedSuggestionIndex = -1;
        }
    });

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        currentFocusedSuggestionIndex = -1;

        if (hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            if (clearBtn) clearBtn.classList.add('d-none');
        }

        if (val.length < 3) {
            menu.classList.add('d-none');
            menu.style.display = 'none';
            if (val.length === 0) {
                hiddenInput.value = '';
                if (clearBtn) clearBtn.classList.add('d-none');
            }
            return;
        }

        clearTimeout(searchDebounceTimers[prefix]);
        searchDebounceTimers[prefix] = setTimeout(() => {
            searchModalEmployees(prefix, val);
        }, 300);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            hiddenInput.value = '';
            searchInput.removeAttribute('data-selected-name');
            clearBtn.classList.add('d-none');
            menu.classList.add('d-none');
            menu.style.display = 'none';
            currentFocusedSuggestionIndex = -1;
        });
    }

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            menu.classList.add('d-none');
            menu.style.display = 'none';
            currentFocusedSuggestionIndex = -1;
        }
    });
}

function updateSuggestionFocus(items) {
    items.forEach((item, index) => {
        const empNameDiv = item.querySelector('.fw-semibold');
        const badgeSpan = item.querySelector('.badge');

        if (index === currentFocusedSuggestionIndex) {
            item.classList.add('active', 'bg-primary', 'text-white');
            item.classList.remove('bg-white');
            if (empNameDiv) empNameDiv.classList.add('text-white');
            if (badgeSpan) badgeSpan.classList.add('bg-white', 'text-primary');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('active', 'bg-primary', 'text-white');
            if (empNameDiv) empNameDiv.classList.remove('text-white');
            if (badgeSpan) badgeSpan.classList.remove('bg-white', 'text-primary');
        }
    });
}

async function searchModalEmployees(prefix, nameQuery) {
    const list = document.getElementById(`${prefix}-employee-suggestions-list`);
    const menu = document.getElementById(`${prefix}-employee-suggestions-menu`);
    if (!list || !menu) return;

    currentFocusedSuggestionIndex = -1;
    const token = getAuthToken();
    const baseUrl = getBaseApiUrl();
    const rootUrl = baseUrl.replace(/\/api\/?$/, '');

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetByName/${encodeURIComponent(nameQuery)}`;

    list.innerHTML = `
        <div class="p-3 text-center text-muted small">
            <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span> Searching employees...
        </div>
    `;
    menu.classList.remove('d-none');
    menu.style.display = 'block';

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
                    <button type="button" class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 ${prefix}-employee-suggestion-item" data-id="${emp.id}" data-name="${emp.name}">
                        <div class="d-flex align-items-center gap-2 overflow-hidden">
                            ${imgHtml}
                            <div class="text-truncate">
                                <div class="fw-semibold text-dark text-truncate small mb-0">${escapeHtml(emp.name)}</div>
                                <div class="text-muted small text-truncate" style="font-size: 0.725rem;">${escapeHtml(emp.designation || 'Employee')}</div>
                            </div>
                        </div>
                        <span class="badge bg-light text-secondary border ms-2">ID #${emp.id}</span>
                    </button>
                `;
            }).join('');

            list.querySelectorAll(`.${prefix}-employee-suggestion-item`).forEach(btn => {
                const handleSelection = (e) => {
                    e.preventDefault();
                    const empId = btn.getAttribute('data-id');
                    const empName = btn.getAttribute('data-name');
                    selectModalEmployee(prefix, empId, empName);
                };
                btn.addEventListener('mousedown', handleSelection);
                btn.addEventListener('click', handleSelection);
            });

        } else {
            list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData.message || 'Failed to load employees.')}</div>`;
        }

    } catch (err) {
        console.error('Error searching employees by name:', err);
        list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to API.</div>`;
    }
}

function selectModalEmployee(prefix, empId, empName) {
    const searchInput = document.getElementById(`${prefix}-employee-search-input`);
    const hiddenInput = document.getElementById(`${prefix}-employee-id`);
    const clearBtn = document.getElementById(`${prefix}-btn-clear-employee`);
    const menu = document.getElementById(`${prefix}-employee-suggestions-menu`);

    if (searchInput) {
        searchInput.value = empName;
        searchInput.setAttribute('data-selected-name', empName);
    }
    if (hiddenInput) {
        hiddenInput.value = empId;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    if (menu) {
        menu.classList.add('d-none');
        menu.style.display = 'none';
    }
    currentFocusedSuggestionIndex = -1;
}

/**
 * Form Submission for Creating Salary
 */
function initCreateModalAndForm() {
    const form = document.getElementById('create-salary-form');
    const paySlipForInput = document.getElementById('create-pay-slip-for');
    const createModalEl = document.getElementById('createSalaryModal');

    if (paySlipForInput && !paySlipForInput.value) {
        paySlipForInput.value = toMonthInputFormat('');
    }

    if (createModalEl) {
        createModalEl.addEventListener('show.bs.modal', () => {
            if (paySlipForInput && !paySlipForInput.value) {
                paySlipForInput.value = toMonthInputFormat('');
            }
        });
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const employeeId = document.getElementById('create-employee-id').value;
        if (!employeeId) {
            showCreateModalError('Please select a valid employee from the suggestions list.');
            return;
        }

        const salary = parseFloat(document.getElementById('create-salary').value) || 0;
        const advancePayment = parseFloat(document.getElementById('create-advance-payment').value) || 0;
        const bonusPayment = parseFloat(document.getElementById('create-bonus-payment').value) || 0;
        const othersBill = parseFloat(document.getElementById('create-others-bill').value) || 0;
        const total = parseFloat(document.getElementById('create-total').value) || (salary - advancePayment + bonusPayment + othersBill);
        const rawPaySlipFor = document.getElementById('create-pay-slip-for').value;
        const paySlipFor = formatMonthYear(rawPaySlipFor);
        const remarks = document.getElementById('create-remarks').value.trim();

        const payload = {
            id: 0,
            employeeId: parseInt(employeeId, 10),
            salary: salary,
            advancePayment: advancePayment,
            bonusPayment: bonusPayment,
            othersBill: othersBill,
            total: total,
            paySlipFor: paySlipFor,
            remarks: remarks
        };

        setButtonLoading('btn-save-salary', 'btn-save-text', 'save-spinner', true);
        hideCreateModalError();

        try {
            const token = getAuthToken();
            const baseUrl = getBaseApiUrl();
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resData = await response.json();

            if (response.ok && resData && resData.succeeded) {
                showToast('Salary record created successfully!', 'success');
                const modalEl = document.getElementById('createSalaryModal');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
                resetCreateForm();
                fetchSalaries();
            } else {
                showCreateModalError(resData.message || 'Failed to create salary record.');
            }
        } catch (err) {
            console.error('Create salary error:', err);
            showCreateModalError('Server communication error. Please try again.');
        } finally {
            setButtonLoading('btn-save-salary', 'btn-save-text', 'save-spinner', false);
        }
    });
}

/**
 * Open Update Modal and fill fields
 */
async function openUpdateModal(id) {
    let item = currentSalariesList.find(s => s.id === id);
    
    // If not in current page list, fetch by ID
    if (!item) {
        try {
            const token = getAuthToken();
            const baseUrl = getBaseApiUrl();
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries/GetById/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const resData = await response.json();
                if (resData && resData.succeeded && resData.data) {
                    item = resData.data;
                }
            }
        } catch (e) {
            console.error('GetById error:', e);
        }
    }

    if (!item) {
        showToast('Could not fetch salary details to edit.', 'danger');
        return;
    }

    document.getElementById('update-id').value = item.id;
    const empFromMap = employeeMap[item.employeeId] || {};
    const empName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;

    selectModalEmployee('update', item.employeeId, empName);

    document.getElementById('update-pay-slip-for').value = toMonthInputFormat(item.paySlipFor);
    document.getElementById('update-salary').value = item.salary || 0;
    document.getElementById('update-advance-payment').value = item.advancePayment || 0;
    document.getElementById('update-bonus-payment').value = item.bonusPayment || 0;
    document.getElementById('update-others-bill').value = item.othersBill || 0;
    document.getElementById('update-remarks').value = item.remarks || '';

    calculateUpdateTotal();

    const modal = new bootstrap.Modal(document.getElementById('updateSalaryModal'));
    modal.show();
}

/**
 * Form Submission for Updating Salary
 */
function initUpdateModalAndForm() {
    const form = document.getElementById('update-salary-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = parseInt(document.getElementById('update-id').value, 10);
        const employeeId = parseInt(document.getElementById('update-employee-id').value, 10);
        const salary = parseFloat(document.getElementById('update-salary').value) || 0;
        const advancePayment = parseFloat(document.getElementById('update-advance-payment').value) || 0;
        const bonusPayment = parseFloat(document.getElementById('update-bonus-payment').value) || 0;
        const othersBill = parseFloat(document.getElementById('update-others-bill').value) || 0;
        const total = parseFloat(document.getElementById('update-total').value) || (salary - advancePayment + bonusPayment + othersBill);
        const rawPaySlipFor = document.getElementById('update-pay-slip-for').value;
        const paySlipFor = formatMonthYear(rawPaySlipFor);
        const remarks = document.getElementById('update-remarks').value.trim();

        const payload = {
            id: id,
            employeeId: employeeId,
            salary: salary,
            advancePayment: advancePayment,
            bonusPayment: bonusPayment,
            othersBill: othersBill,
            total: total,
            paySlipFor: paySlipFor,
            remarks: remarks
        };

        setButtonLoading('btn-update-salary', 'btn-update-text', 'update-spinner', true);
        hideUpdateModalError();

        try {
            const token = getAuthToken();
            const baseUrl = getBaseApiUrl();
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resData = await response.json();

            if (response.ok && resData && resData.succeeded) {
                showToast('Salary record updated successfully!', 'success');
                const modalEl = document.getElementById('updateSalaryModal');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
                fetchSalaries();
            } else {
                showUpdateModalError(resData.message || 'Failed to update salary record.');
            }
        } catch (err) {
            console.error('Update salary error:', err);
            showUpdateModalError('Server communication error. Please try again.');
        } finally {
            setButtonLoading('btn-update-salary', 'btn-update-text', 'update-spinner', false);
        }
    });
}

/**
 * Open Details Modal
 */
async function openDetailsModal(id) {
    let item = currentSalariesList.find(s => s.id === id);

    if (!item) {
        try {
            const token = getAuthToken();
            const baseUrl = getBaseApiUrl();
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries/GetById/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const resData = await response.json();
                if (resData && resData.succeeded && resData.data) {
                    item = resData.data;
                }
            }
        } catch (e) {
            console.error('Details fetch error:', e);
        }
    }

    if (!item) {
        showToast('Could not load salary details.', 'danger');
        return;
    }

    const empFromMap = employeeMap[item.employeeId] || {};
    const empName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;
    const formatCurrency = (v) => `৳ ${Number(v || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;

    const content = `
        <div class="p-3 bg-light rounded-3 mb-3 text-center border">
            <h6 class="text-uppercase fw-bold text-muted extra-small mb-1">Monthly Pay Slip</h6>
            <h4 class="fw-bold text-dark mb-0">${escapeHtml(item.paySlipFor || 'Salary Slip')}</h4>
            <div class="badge bg-primary mt-2 px-3 py-1">Employee: ${escapeHtml(empName)}</div>
        </div>

        <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle mb-3">
                <tbody>
                    <tr>
                        <td class="bg-light fw-semibold text-secondary w-50">Employee ID</td>
                        <td class="fw-bold text-dark">#${item.employeeId}</td>
                    </tr>
                    <tr>
                        <td class="bg-light fw-semibold text-secondary">Basic Salary</td>
                        <td class="fw-semibold text-dark">${formatCurrency(item.salary)}</td>
                    </tr>
                    <tr>
                        <td class="bg-light fw-semibold text-secondary">Advance Deducted</td>
                        <td class="text-danger fw-semibold">-${formatCurrency(item.advancePayment)}</td>
                    </tr>
                    <tr>
                        <td class="bg-light fw-semibold text-secondary">Bonus Added</td>
                        <td class="text-success fw-semibold">+${formatCurrency(item.bonusPayment)}</td>
                    </tr>
                    <tr>
                        <td class="bg-light fw-semibold text-secondary">Others Bill / Allowances</td>
                        <td class="text-info-emphasis fw-semibold">+${formatCurrency(item.othersBill)}</td>
                    </tr>
                    <tr class="table-primary">
                        <td class="fw-bold text-primary fs-6">Net Payable Total</td>
                        <td class="fw-bold text-primary fs-5">${formatCurrency(item.total)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${item.remarks ? `
            <div class="p-3 bg-light rounded-3 border">
                <small class="fw-semibold text-muted d-block mb-1">Remarks:</small>
                <div class="small text-dark">${escapeHtml(item.remarks)}</div>
            </div>
        ` : ''}
    `;

    document.getElementById('modal-salary-content').innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('salaryDetailsModal'));
    modal.show();
}

/**
 * Delete Confirmation Trigger & Handler
 */
function confirmDeleteSalary(id, empName, paySlipFor) {
    salaryToDeleteId = id;
    document.getElementById('delete-employee-name').textContent = empName;
    document.getElementById('delete-pay-slip-for').textContent = paySlipFor || 'Payslip';
    document.getElementById('delete-modal-error').classList.add('d-none');

    deleteModalInstance = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
    deleteModalInstance.show();
}

async function executeDeleteSalary() {
    if (!salaryToDeleteId) return;

    const btn = document.getElementById('btn-confirm-delete');
    const btnText = document.getElementById('btn-confirm-delete-text');

    btn.disabled = true;
    btnText.textContent = 'Deleting...';

    try {
        const token = getAuthToken();
        const baseUrl = getBaseApiUrl();
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/EmployeeSalaries/${salaryToDeleteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const resData = await response.json();

        if (response.ok && resData && resData.succeeded) {
            showToast('Salary record deleted successfully!', 'success');
            if (deleteModalInstance) deleteModalInstance.hide();
            fetchSalaries();
        } else {
            showDeleteModalError(resData.message || 'Failed to delete salary record.');
        }
    } catch (e) {
        console.error('Delete error:', e);
        showDeleteModalError('Server communication error.');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Delete';
    }
}

/**
 * PDF Export using jsPDF & AutoTable
 */
function exportToPDF() {
    if (!currentSalariesList || currentSalariesList.length === 0) {
        showToast('No data available to export to PDF.', 'warning');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        doc.setFontSize(16);
        doc.text("Business Solution - Employee Salary / Payroll Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

        const tableColumn = ["#", "Employee ID", "Employee Name", "Pay Slip For", "Basic Salary", "Advance", "Bonus", "Others", "Net Total"];
        const tableRows = [];

        currentSalariesList.forEach((item, index) => {
            const empFromMap = employeeMap[item.employeeId] || {};
            const empName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;

            const rowData = [
                index + 1,
                item.employeeId,
                empName,
                item.paySlipFor || 'N/A',
                item.salary ? item.salary.toFixed(2) : '0.00',
                item.advancePayment ? item.advancePayment.toFixed(2) : '0.00',
                item.bonusPayment ? item.bonusPayment.toFixed(2) : '0.00',
                item.othersBill ? item.othersBill.toFixed(2) : '0.00',
                item.total ? item.total.toFixed(2) : '0.00'
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9 }
        });

        doc.save(`Payroll_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF exported successfully!', 'success');
    } catch (e) {
        console.error('Export PDF error:', e);
        showToast('Failed to export PDF file.', 'danger');
    }
}

/**
 * Excel Export using SheetJS (XLSX)
 */
function exportToExcel() {
    if (!currentSalariesList || currentSalariesList.length === 0) {
        showToast('No data available to export to Excel.', 'warning');
        return;
    }

    try {
        const exportData = currentSalariesList.map((item, idx) => {
            const empFromMap = employeeMap[item.employeeId] || {};
            const empName = item.employeeName || empFromMap.name || `Employee #${item.employeeId}`;

            return {
                "SL": idx + 1,
                "Employee ID": item.employeeId,
                "Employee Name": empName,
                "Pay Slip For": item.paySlipFor || '',
                "Basic Salary": item.salary || 0,
                "Advance Payment": item.advancePayment || 0,
                "Bonus Payment": item.bonusPayment || 0,
                "Others Bill": item.othersBill || 0,
                "Net Total": item.total || 0,
                "Remarks": item.remarks || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");

        XLSX.writeFile(workbook, `Payroll_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Excel file exported successfully!', 'success');
    } catch (e) {
        console.error('Export Excel error:', e);
        showToast('Failed to export Excel file.', 'danger');
    }
}

// Helper Utilities
function getAuthToken() {
    return typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : (localStorage.getItem('bs_auth_token') || localStorage.getItem('bs_token'));
}

function getBaseApiUrl() {
    return typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
}

function resetCreateForm() {
    const form = document.getElementById('create-salary-form');
    if (form) form.reset();
    document.getElementById('create-employee-id').value = '';
    const input = document.getElementById('create-employee-search-input');
    if (input) {
        input.value = '';
        input.removeAttribute('data-selected-name');
    }
    const clearBtn = document.getElementById('create-btn-clear-employee');
    if (clearBtn) clearBtn.classList.add('d-none');
    const menu = document.getElementById('create-employee-suggestions-menu');
    if (menu) menu.classList.add('d-none');
    const paySlipForInput = document.getElementById('create-pay-slip-for');
    if (paySlipForInput) paySlipForInput.value = toMonthInputFormat('');
    document.getElementById('create-total-display').textContent = '৳ 0.00';
    document.getElementById('create-total').value = '0';
}

function updatePaginationInfo(start, end, total) {
    const el = document.getElementById('pagination-info');
    if (el) el.textContent = `Showing ${start} to ${end} of ${total} entries`;
}

function renderPaginationButtons(current, total) {
    const list = document.getElementById('pagination-list');
    if (!list) return;

    let html = '';

    // Prev Button
    html += `
        <li class="page-item ${current === 1 ? 'disabled' : ''}">
            <button class="page-link rounded-2" onclick="changePage(${current - 1})" aria-label="Previous">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - 2 && i <= current + 2)) {
            html += `
                <li class="page-item ${i === current ? 'active' : ''}">
                    <button class="page-link rounded-2" onclick="changePage(${i})">${i}</button>
                </li>
            `;
        } else if (i === current - 3 || i === current + 3) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
    }

    // Next Button
    html += `
        <li class="page-item ${current === total || total === 0 ? 'disabled' : ''}">
            <button class="page-link rounded-2" onclick="changePage(${current + 1})" aria-label="Next">
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    list.innerHTML = html;
}

function changePage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    fetchSalaries();
}

function setButtonLoading(btnId, textId, spinnerId, isLoading) {
    const btn = document.getElementById(btnId);
    const text = document.getElementById(textId);
    const spinner = document.getElementById(spinnerId);

    if (btn) btn.disabled = isLoading;
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
}

function showCreateModalError(msg) {
    const box = document.getElementById('create-modal-error');
    const txt = document.getElementById('create-modal-error-text');
    if (txt) txt.textContent = msg;
    if (box) box.classList.remove('d-none');
}

function hideCreateModalError() {
    const box = document.getElementById('create-modal-error');
    if (box) box.classList.add('d-none');
}

function showUpdateModalError(msg) {
    const box = document.getElementById('update-modal-error');
    const txt = document.getElementById('update-modal-error-text');
    if (txt) txt.textContent = msg;
    if (box) box.classList.remove('d-none');
}

function hideUpdateModalError() {
    const box = document.getElementById('update-modal-error');
    if (box) box.classList.add('d-none');
}

function showDeleteModalError(msg) {
    const box = document.getElementById('delete-modal-error');
    const txt = document.getElementById('delete-modal-error-text');
    if (txt) txt.textContent = msg;
    if (box) box.classList.remove('d-none');
}

function showApiError(msg) {
    const alert = document.getElementById('api-error-alert');
    const message = document.getElementById('api-error-message');
    if (message) message.textContent = msg;
    if (alert) alert.classList.remove('d-none');
}

function showToast(message, type = 'success') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl) return;

    toastEl.className = `toast align-items-center text-white border-0 rounded-3 shadow-lg bg-${type === 'danger' ? 'danger' : type === 'warning' ? 'warning text-dark' : 'success'}`;
    toastIcon.className = `bi fs-5 ${type === 'danger' ? 'bi-exclamation-octagon-fill' : type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`;
    toastMsg.textContent = message;

    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Helper: Converts YYYY-MM month input string (e.g. "2026-06") to formatted string (e.g. "June 2026")
 */
function formatMonthYear(ymString) {
    if (!ymString) return '';
    if (ymString.includes('-')) {
        const parts = ymString.split('-');
        if (parts.length >= 2) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            if (!isNaN(year) && !isNaN(month)) {
                const date = new Date(year, month - 1, 1);
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
        }
    }
    return ymString;
}

/**
 * Helper: Converts formatted Month Year string (e.g. "June 2026") to YYYY-MM for <input type="month">
 */
function toMonthInputFormat(str) {
    if (!str) {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    }
    if (/^\d{4}-\d{2}$/.test(str)) return str;
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    }
    return '';
}
