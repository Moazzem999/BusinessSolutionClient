/* ==========================================================================
   Business Solution Client - Customer Create Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initCreateCustomerPage();
});

function initCreateCustomerPage() {
    const createForm = document.getElementById('create-customer-form');
    if (!createForm) return;

    // Elements
    const isSpecialCheckbox = document.getElementById('IsSpecial');
    const currentBalanceInput = document.getElementById('CurrentBalance');
    const balanceBadge = document.getElementById('balance-badge');
    const specialStatusText = document.getElementById('special-status-text');
    const balanceHelpText = document.getElementById('balance-help-text');

    const nameInput = document.getElementById('Name');
    const mobileInput = document.getElementById('Mobile');
    const shopNameInput = document.getElementById('ShopName');
    const emailInput = document.getElementById('Email');
    const nidNoInput = document.getElementById('NidNo');
    const presentAddressInput = document.getElementById('PresentAddress');
    const permanentAddressInput = document.getElementById('PermanentAddress');
    const additionalDetailsInput = document.getElementById('AdditionalDetails');

    const imageInput = document.getElementById('Image');
    const nidImageInput = document.getElementById('NidImage');
    const chequeImageInput = document.getElementById('ChequeImage');

    const btnSave = document.getElementById('btn-save-customer');
    const btnText = document.getElementById('btn-save-text');
    const btnSpinner = document.getElementById('save-spinner');
    const errorAlert = document.getElementById('create-error-alert');
    const errorMsg = document.getElementById('create-error-message');
    const successAlert = document.getElementById('create-success-alert');

    // 1. Setup IsSpecial toggle behavior
    function updateIsSpecialState() {
        if (!isSpecialCheckbox || !currentBalanceInput) return;

        const isSpecial = isSpecialCheckbox.checked;
        currentBalanceInput.disabled = !isSpecial;

        if (isSpecial) {
            currentBalanceInput.classList.remove('bg-light');
            if (balanceBadge) {
                balanceBadge.className = 'badge bg-warning-subtle text-warning-emphasis small fw-medium';
                balanceBadge.innerHTML = '<i class="bi bi-star-fill me-1"></i>Special (Editable)';
            }
            if (specialStatusText) {
                specialStatusText.textContent = 'Special customer (initial balance enabled)';
            }
            if (balanceHelpText) {
                balanceHelpText.textContent = 'Enter initial current balance for this special customer.';
            }
            currentBalanceInput.focus();
        } else {
            currentBalanceInput.classList.add('bg-light');
            currentBalanceInput.value = '0';
            if (balanceBadge) {
                balanceBadge.className = 'badge bg-secondary-subtle text-secondary small fw-normal';
                balanceBadge.textContent = 'Locked (0.00)';
            }
            if (specialStatusText) {
                specialStatusText.textContent = 'Regular customer (initial balance locked)';
            }
            if (balanceHelpText) {
                balanceHelpText.textContent = 'Enable "Special Customer" to set initial balance.';
            }
        }
    }

    if (isSpecialCheckbox) {
        isSpecialCheckbox.addEventListener('change', updateIsSpecialState);
        // Ensure initial state
        updateIsSpecialState();
    }

    // 2. Setup Image File Previews
    setupImagePreview('Image', 'image-preview', 'image-preview-container');
    setupImagePreview('NidImage', 'nid-preview', 'nid-preview-container');
    setupImagePreview('ChequeImage', 'cheque-preview', 'cheque-preview-container');

    function setupImagePreview(inputId, imgId, containerId) {
        const input = document.getElementById(inputId);
        const img = document.getElementById(imgId);
        const container = document.getElementById(containerId);

        if (!input || !img || !container) return;

        input.addEventListener('change', () => {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                if (file.type && !file.type.startsWith('image/')) {
                    container.classList.add('d-none');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                    container.classList.remove('d-none');
                };
                reader.readAsDataURL(file);
            } else {
                img.src = '#';
                container.classList.add('d-none');
            }
        });
    }

    // 3. Clear validation errors on typing
    if (nameInput) {
        nameInput.addEventListener('input', () => nameInput.classList.remove('is-invalid'));
    }
    if (mobileInput) {
        mobileInput.addEventListener('input', () => mobileInput.classList.remove('is-invalid'));
    }

    // 4. Form Submission
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset alerts
        errorAlert.classList.add('d-none');
        successAlert.classList.add('d-none');

        const name = nameInput ? nameInput.value.trim() : '';
        const mobile = mobileInput ? mobileInput.value.trim() : '';

        // Validate required fields
        let hasError = false;
        if (!name) {
            nameInput.classList.add('is-invalid');
            hasError = true;
        }
        if (!mobile) {
            mobileInput.classList.add('is-invalid');
            hasError = true;
        }

        if (hasError) {
            errorMsg.innerText = 'Please provide both Customer Name and Mobile Number.';
            errorAlert.classList.remove('d-none');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Show loading state
        btnSave.disabled = true;
        btnText.innerText = 'Saving Customer...';
        btnSpinner.classList.remove('d-none');

        const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : (localStorage.getItem('bs_token') || '');
        const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/Customers`;

        const isSpecial = isSpecialCheckbox ? isSpecialCheckbox.checked : false;
        const currentBalance = isSpecial && currentBalanceInput ? (parseFloat(currentBalanceInput.value) || 0) : 0;

        const formData = new FormData();
        formData.append('Id', 0);
        formData.append('Name', name);
        formData.append('Mobile', mobile);
        formData.append('ShopName', shopNameInput ? shopNameInput.value.trim() : '');
        formData.append('Email', emailInput ? emailInput.value.trim() : '');
        formData.append('IsSpecial', isSpecial ? 'true' : 'false');
        formData.append('CurrentBalance', currentBalance);
        formData.append('NidNo', nidNoInput ? nidNoInput.value.trim() : '');
        formData.append('PresentAddress', presentAddressInput ? presentAddressInput.value.trim() : '');
        formData.append('PermanentAddress', permanentAddressInput ? permanentAddressInput.value.trim() : '');
        formData.append('AdditionalDetails', additionalDetailsInput ? additionalDetailsInput.value.trim() : '');

        if (imageInput && imageInput.files && imageInput.files.length > 0) {
            formData.append('Image', imageInput.files[0]);
        }
        if (nidImageInput && nidImageInput.files && nidImageInput.files.length > 0) {
            formData.append('NidImage', nidImageInput.files[0]);
        }
        if (chequeImageInput && chequeImageInput.files && chequeImageInput.files.length > 0) {
            formData.append('ChequeImage', chequeImageInput.files[0]);
        }

        try {
            console.log('Posting Create Customer to:', endpoint);

            const headers = {
                'accept': '*/*'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            let resData = null;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                resData = await response.json();
            } else {
                const text = await response.text();
                try {
                    resData = JSON.parse(text);
                } catch {
                    resData = { message: text };
                }
            }
            console.log('Create Customer API Response:', resData);

            if (response.ok && (!resData || resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201 || resData.id || resData.data)) {
                successAlert.classList.remove('d-none');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => {
                    window.location.href = '/Customer/List';
                }, 800);
            } else {
                let message = `Failed to create customer (Status ${response.status})`;
                if (resData) {
                    if (resData.message) {
                        message = resData.message;
                    } else if (resData.errors && typeof resData.errors === 'object') {
                        const errorList = Object.values(resData.errors).flat().join(', ');
                        if (errorList) message = errorList;
                    } else if (resData.title) {
                        message = resData.title;
                    }
                }
                errorMsg.innerText = message;
                errorAlert.classList.remove('d-none');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Error creating customer:', err);
            errorMsg.innerText = 'Could not connect to API at ' + endpoint + '. Ensure backend server is active.';
            errorAlert.classList.remove('d-none');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            btnSave.disabled = false;
            btnText.innerText = 'Save';
            btnSpinner.classList.add('d-none');
        }
    });
}

