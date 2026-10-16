/* ==========================================================================
   Business Solution Client - Product Create Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initProductCreateEvents();
});

function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getApiBaseUrl === 'function') {
        return BSApp.getApiBaseUrl();
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL.replace(/\/+$/, '');
    }
    return 'https://localhost:7148/api';
}

function getAuthToken() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getStoredToken === 'function') {
        return BSApp.getStoredToken();
    }
    return localStorage.getItem('bs_token') || '';
}

function initProductCreateEvents() {
    const form = document.getElementById('create-product-form');
    const imageInput = document.getElementById('Image');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const btnRemoveImage = document.getElementById('btn-remove-image');

    // Image preview handler
    if (imageInput && imagePreview && previewContainer) {
        imageInput.addEventListener('change', () => {
            if (imageInput.files && imageInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    previewContainer.classList.remove('d-none');
                };
                reader.readAsDataURL(imageInput.files[0]);
            } else {
                previewContainer.classList.add('d-none');
            }
        });
    }

    if (btnRemoveImage && imageInput && previewContainer) {
        btnRemoveImage.addEventListener('click', () => {
            imageInput.value = '';
            previewContainer.classList.add('d-none');
        });
    }

    // Form submit handler
    if (form) {
        form.addEventListener('submit', handleProductCreate);
    }
}

async function handleProductCreate(e) {
    e.preventDefault();

    const nameInput = document.getElementById('Name');
    const detailsInput = document.getElementById('Details');
    const imageInput = document.getElementById('Image');

    const btnSave = document.getElementById('btn-save-product');
    const btnText = document.getElementById('btn-save-text');
    const spinner = document.getElementById('save-spinner');

    const errorAlert = document.getElementById('create-error-alert');
    const errorMsg = document.getElementById('create-error-message');
    const successAlert = document.getElementById('create-success-alert');

    if (!nameInput || !nameInput.value.trim()) {
        if (errorMsg) errorMsg.innerText = 'Product Name is required.';
        if (errorAlert) errorAlert.classList.remove('d-none');
        return;
    }

    if (errorAlert) errorAlert.classList.add('d-none');
    if (successAlert) successAlert.classList.add('d-none');

    if (btnSave) btnSave.disabled = true;
    if (btnText) btnText.innerText = 'Saving...';
    if (spinner) spinner.classList.remove('d-none');

    const formData = new FormData();
    formData.append('Id', '0');
    formData.append('Name', nameInput.value.trim());
    formData.append('Details', detailsInput ? detailsInput.value.trim() : '');

    if (imageInput && imageInput.files && imageInput.files.length > 0) {
        formData.append('Image', imageInput.files[0]);
    }

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Products`;

    try {
        console.log('Posting new product to:', endpoint);
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
            if (successAlert) successAlert.classList.remove('d-none');
            setTimeout(() => {
                window.location.href = '/Product/List';
            }, 1000);
        } else {
            const msg = (resData && resData.message) ? resData.message : `Failed to save product (Status ${response.status})`;
            if (errorMsg) errorMsg.innerText = msg;
            if (errorAlert) errorAlert.classList.remove('d-none');
            if (btnSave) btnSave.disabled = false;
            if (btnText) btnText.innerText = 'Save';
            if (spinner) spinner.classList.add('d-none');
        }
    } catch (err) {
        console.error('Error creating product:', err);
        if (errorMsg) errorMsg.innerText = 'Network error while saving product. Ensure backend API is active.';
        if (errorAlert) errorAlert.classList.remove('d-none');
        if (btnSave) btnSave.disabled = false;
        if (btnText) btnText.innerText = 'Save';
        if (spinner) spinner.classList.add('d-none');
    }
}
