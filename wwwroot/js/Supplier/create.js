/* ==========================================================================
   Business Solution Client - Supplier Create Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initCreateSupplierPage();
});

function initCreateSupplierPage() {
    const createForm = document.getElementById('create-supplier-form');
    if (!createForm) return;

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btn-save-supplier');
        const btnText = document.getElementById('btn-save-text');
        const btnSpinner = document.getElementById('save-spinner');
        const errorAlert = document.getElementById('create-error-alert');
        const errorMsg = document.getElementById('create-error-message');
        const successAlert = document.getElementById('create-success-alert');

        errorAlert.classList.add('d-none');
        successAlert.classList.add('d-none');
        btnSave.disabled = true;
        btnText.innerText = 'Saving Supplier...';
        btnSpinner.classList.remove('d-none');

        const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
        const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/Suppliers`;

        const formData = new FormData();
        formData.append('Id', 0);
        formData.append('ShopName', document.getElementById('ShopName').value.trim());
        formData.append('Name', document.getElementById('Name').value.trim());
        formData.append('Mobile', document.getElementById('Mobile').value.trim());
        formData.append('Email', document.getElementById('Email').value.trim());
        formData.append('CurrentBalance', parseFloat(document.getElementById('CurrentBalance').value) || 0);
        formData.append('NidNo', document.getElementById('NidNo').value.trim());
        formData.append('PresentAddress', document.getElementById('PresentAddress').value.trim());
        formData.append('PermanentAddress', document.getElementById('PermanentAddress').value.trim());
        formData.append('AdditionalDetails', document.getElementById('AdditionalDetails').value.trim());

        const imageInput = document.getElementById('Image');
        if (imageInput && imageInput.files.length > 0) {
            formData.append('Image', imageInput.files[0]);
        }

        const nidImageInput = document.getElementById('NidImage');
        if (nidImageInput && nidImageInput.files.length > 0) {
            formData.append('NidImage', nidImageInput.files[0]);
        }

        const chequeImageInput = document.getElementById('ChequeImage');
        if (chequeImageInput && chequeImageInput.files.length > 0) {
            formData.append('ChequeImage', chequeImageInput.files[0]);
        }

        try {
            console.log('Posting Create Supplier to:', endpoint);

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
            console.log('Create Supplier API Response:', resData);

            if (response.ok && resData && (resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201)) {
                successAlert.classList.remove('d-none');
                setTimeout(() => {
                    window.location.href = '/Supplier/List';
                }, 800);
            } else {
                const message = (resData && resData.message) ? resData.message : `Failed to create supplier (Status ${response.status})`;
                errorMsg.innerText = message;
                errorAlert.classList.remove('d-none');
            }
        } catch (err) {
            console.error('Error creating supplier:', err);
            errorMsg.innerText = 'Could not connect to API at ' + endpoint + '. Ensure backend server is active.';
            errorAlert.classList.remove('d-none');
        } finally {
            btnSave.disabled = false;
            btnText.innerText = 'Save Supplier';
            btnSpinner.classList.add('d-none');
        }
    });
}
