/* ==========================================================================
   Business Solution Client - Employee Create Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initCreateEmployeePage();
    loadMaritalStatusDropdown();
    loadReligionDropdown();
});

/**
 * Fetches Marital Status options dynamically from API: /api/Dropdown/GetAllMaritalStatus
 */
async function loadMaritalStatusDropdown() {
    const selectEl = document.getElementById('MaritalStatus');
    if (!selectEl) return;

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Dropdown/GetAllMaritalStatus`;

    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const res = await response.json();
            if (res && res.succeeded && Array.isArray(res.data) && res.data.length > 0) {
                selectEl.innerHTML = res.data.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
                return;
            }
        }
    } catch (e) {
        console.warn('Could not load Marital Status dropdown from API:', e);
    }

    // Fallback options matching API schema if offline
    selectEl.innerHTML = `
        <option value="1">Single</option>
        <option value="2">Married</option>
        <option value="3">Divorced</option>
    `;
}

/**
 * Fetches Religion options dynamically from API: /api/Dropdown/GetAllReligion
 */
async function loadReligionDropdown() {
    const selectEl = document.getElementById('Religion');
    if (!selectEl) return;

    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Dropdown/GetAllReligion`;

    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const res = await response.json();
            if (res && res.succeeded && Array.isArray(res.data) && res.data.length > 0) {
                selectEl.innerHTML = res.data.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
                return;
            }
        }
    } catch (e) {
        console.warn('Could not load Religion dropdown from API:', e);
    }

    // Fallback options matching API schema if offline
    selectEl.innerHTML = `
        <option value="1">Islam</option>
        <option value="2">Hinduism</option>
        <option value="3">Christianity</option>
        <option value="4">Buddhism</option>
        <option value="5">Others</option>
    `;
}

function initCreateEmployeePage() {
    const createForm = document.getElementById('create-employee-form');
    if (!createForm) return;

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btn-save-employee');
        const btnText = document.getElementById('btn-save-text');
        const btnSpinner = document.getElementById('save-spinner');
        const errorAlert = document.getElementById('create-error-alert');
        const errorMsg = document.getElementById('create-error-message');
        const successAlert = document.getElementById('create-success-alert');

        errorAlert.classList.add('d-none');
        successAlert.classList.add('d-none');
        btnSave.disabled = true;
        btnText.innerText = 'Saving Employee...';
        btnSpinner.classList.remove('d-none');

        const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
        const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees`;

        const formData = new FormData();
        formData.append('Id', 0);
        formData.append('Name', document.getElementById('Name').value.trim());
        formData.append('FatherName', document.getElementById('FatherName').value.trim());
        formData.append('Email', document.getElementById('Email').value.trim());
        formData.append('Mobile', document.getElementById('Mobile').value.trim());
        formData.append('NidNo', document.getElementById('NidNo').value.trim());

        const dobInput = document.getElementById('DateOfBirth').value;
        if (dobInput) {
            formData.append('DateOfBirth', new Date(dobInput).toISOString());
        }

        formData.append('MaritalStatus', parseInt(document.getElementById('MaritalStatus').value, 10) || 1);
        formData.append('Religion', parseInt(document.getElementById('Religion').value, 10) || 1);
        formData.append('Designation', document.getElementById('Designation').value.trim());
        formData.append('AcademicQualification', document.getElementById('AcademicQualification').value.trim());

        const joiningInput = document.getElementById('JoiningDate').value;
        if (joiningInput) {
            formData.append('JoiningDate', new Date(joiningInput).toISOString());
        }

        formData.append('Salary', parseFloat(document.getElementById('Salary').value) || 0);
        formData.append('PresentAddress', document.getElementById('PresentAddress').value.trim());
        formData.append('PermanentAddress', document.getElementById('PermanentAddress').value.trim());

        const imageInput = document.getElementById('Image');
        if (imageInput && imageInput.files.length > 0) {
            formData.append('Image', imageInput.files[0]);
        }

        const nidImageInput = document.getElementById('NidImage');
        if (nidImageInput && nidImageInput.files.length > 0) {
            formData.append('NidImage', nidImageInput.files[0]);
        }

        try {
            console.log('Posting Create Employee to:', endpoint);

            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const resData = await response.json();
            console.log('Create Employee API Response:', resData);

            if (response.ok && resData && (resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201)) {
                successAlert.classList.remove('d-none');
                setTimeout(() => {
                    window.location.href = '/Employee/List';
                }, 800);
            } else {
                const message = (resData && resData.message) ? resData.message : `Failed to create employee (Status ${response.status})`;
                errorMsg.innerText = message;
                errorAlert.classList.remove('d-none');
            }
        } catch (err) {
            console.error('Error creating employee:', err);
            errorMsg.innerText = 'Could not connect to API at ' + endpoint + '. Ensure backend server is active.';
            errorAlert.classList.remove('d-none');
        } finally {
            btnSave.disabled = false;
            btnText.innerText = 'Save Employee';
            btnSpinner.classList.add('d-none');
        }
    });
}
