/* ==========================================================================
   Business Solution Client - Settings / Change Password JavaScript
   API: POST /api/Users/ChangePassword
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initChangePasswordForm();
    initPasswordToggles();
});

/**
 * Initialize Change Password Form submission and validation
 */
function initChangePasswordForm() {
    const form = document.getElementById('change-password-form');
    if (!form) return;

    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    const errorAlert = document.getElementById('change-password-error-alert');
    const errorMessage = document.getElementById('change-password-error-message');
    const successAlert = document.getElementById('change-password-success-alert');
    const successMessage = document.getElementById('change-password-success-message');

    const submitBtn = document.getElementById('btn-submit-password');
    const submitText = document.getElementById('btn-submit-text');
    const submitIcon = document.getElementById('btn-submit-icon');
    const submitSpinner = document.getElementById('btn-submit-spinner');
    const resetBtn = document.getElementById('btn-reset-password');

    // Real-time confirmation matching validation
    confirmPasswordInput.addEventListener('input', () => {
        validatePasswordMatch();
    });

    newPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value.length > 0) {
            validatePasswordMatch();
        }
    });

    // Reset button clears all validation state
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearValidationState();
            hideAlerts();
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlerts();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // 1. Client-Side Validations
        const validationErrors = [];
        clearValidationState();

        if (!currentPassword) {
            const err = 'Current password is required.';
            validationErrors.push(err);
            markInvalid(currentPasswordInput, 'current-password-feedback', err);
        }

        if (!newPassword) {
            const err = 'New password is required.';
            validationErrors.push(err);
            markInvalid(newPasswordInput, 'new-password-feedback', err);
        } else if (newPassword.length < 6) {
            const err = 'New password must be at least 6 characters long.';
            validationErrors.push(err);
            markInvalid(newPasswordInput, 'new-password-feedback', err);
        }

        if (!confirmPassword) {
            const err = 'Please confirm your new password.';
            validationErrors.push(err);
            markInvalid(confirmPasswordInput, 'confirm-password-feedback', err);
        } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            const err = 'New password and Confirm password do not match.';
            validationErrors.push(err);
            markInvalid(confirmPasswordInput, 'confirm-password-feedback', err);
        }

        if (currentPassword && newPassword && currentPassword === newPassword) {
            const err = 'New password cannot be the same as current password.';
            validationErrors.push(err);
            markInvalid(newPasswordInput, 'new-password-feedback', err);
        }

        // If there are validation errors, display actual errors in top-right toast and alert
        if (validationErrors.length > 0) {
            const errorHtml = validationErrors.length === 1
                ? validationErrors[0]
                : validationErrors.map(item => `<div>• ${item}</div>`).join('');

            if (errorMessage) errorMessage.innerHTML = errorHtml;
            if (errorAlert) errorAlert.classList.remove('d-none');
            showToast(errorHtml, 'danger');
            return;
        }

        // 2. Prepare API Request
        const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/Users/ChangePassword`;

        const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : (localStorage.getItem('bs_token') || '');

        const payload = {
            currentPassword: currentPassword,
            newPassword: newPassword,
            confirmPassword: confirmPassword
        };

        // Loading state
        submitBtn.disabled = true;
        if (submitText) submitText.innerText = 'Updating Password...';
        if (submitIcon) submitIcon.classList.add('d-none');
        if (submitSpinner) submitSpinner.classList.remove('d-none');

        try {
            console.log('Sending ChangePassword request to:', endpoint);

            const headers = {
                'Accept': '*/*',
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            let resData = null;
            try {
                resData = await response.json();
            } catch (jsonErr) {
                console.warn('Could not parse response JSON:', jsonErr);
            }

            console.log('ChangePassword API Response:', resData);

            // 3. Process API Response
            if (response.ok && (resData?.succeeded === true || resData?.statusCode === 200 || resData?.data === true)) {
                const successMsg = resData?.message || 'Password changed successfully.';
                
                // Show Success Alert & Top-Right Toast
                if (successMessage) {
                    successMessage.innerText = `${successMsg} Stopping current session and redirecting to login...`;
                }
                if (successAlert) {
                    successAlert.classList.remove('d-none');
                }
                showToast(successMsg, 'success');

                // Disable form fields
                currentPasswordInput.disabled = true;
                newPasswordInput.disabled = true;
                confirmPasswordInput.disabled = true;
                if (resetBtn) resetBtn.disabled = true;

                // Stop current session immediately
                stopCurrentSession();

                // Redirect to login page after brief delay
                setTimeout(() => {
                    window.location.replace('/Account/Login');
                }, 1500);

            } else {
                // Extract actual error message from backend response
                const errorMsg = extractActualError(resData, response);

                if (errorMessage) errorMessage.innerHTML = errorMsg;
                if (errorAlert) errorAlert.classList.remove('d-none');
                showToast(errorMsg, 'danger');

                // Reset button state on failure
                submitBtn.disabled = false;
                if (submitText) submitText.innerText = 'Change Password';
                if (submitIcon) submitIcon.classList.remove('d-none');
                if (submitSpinner) submitSpinner.classList.add('d-none');
            }

        } catch (netErr) {
            console.error('Network or CORS error during ChangePassword:', netErr);
            const errStr = (netErr && netErr.message)
                ? `Connection error: ${netErr.message}`
                : 'Network error: Unable to connect to server. Please try again.';
            if (errorMessage) errorMessage.innerText = errStr;
            if (errorAlert) errorAlert.classList.remove('d-none');
            showToast(errStr, 'danger');

            submitBtn.disabled = false;
            if (submitText) submitText.innerText = 'Change Password';
            if (submitIcon) submitIcon.classList.remove('d-none');
            if (submitSpinner) submitSpinner.classList.add('d-none');
        }
    });

    function validatePasswordMatch() {
        const newPass = newPasswordInput.value;
        const confPass = confirmPasswordInput.value;
        if (confPass.length > 0 && newPass !== confPass) {
            markInvalid(confirmPasswordInput, 'confirm-password-feedback', 'Passwords do not match.');
            return false;
        } else if (confPass.length > 0 && newPass === confPass) {
            markValid(confirmPasswordInput, 'confirm-password-feedback');
            return true;
        }
        return true;
    }

    function markInvalid(inputEl, feedbackId, message) {
        inputEl.classList.add('is-invalid');
        inputEl.classList.remove('is-valid');
        const feedbackEl = document.getElementById(feedbackId);
        if (feedbackEl) {
            feedbackEl.innerText = message;
            feedbackEl.classList.remove('d-none');
        }
    }

    function markValid(inputEl, feedbackId) {
        inputEl.classList.remove('is-invalid');
        inputEl.classList.add('is-valid');
        const feedbackEl = document.getElementById(feedbackId);
        if (feedbackEl) {
            feedbackEl.classList.add('d-none');
        }
    }

    function clearValidationState() {
        [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(input => {
            input.classList.remove('is-invalid', 'is-valid');
        });
        ['current-password-feedback', 'new-password-feedback', 'confirm-password-feedback'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('d-none');
        });
    }

    function hideAlerts() {
        if (errorAlert) errorAlert.classList.add('d-none');
        if (successAlert) successAlert.classList.add('d-none');
    }
}

/**
 * Extracts actual human-readable error messages from backend response
 */
function extractActualError(resData, response) {
    if (!resData) {
        if (response && response.status === 401) {
            return 'Your session has expired. Please log in again.';
        }
        return `Server returned status ${response?.status || 'Error'} (${response?.statusText || 'Failed to change password'})`;
    }

    // 1. Array of error messages: e.g. ["Password must contain an uppercase letter.", "..."]
    if (Array.isArray(resData.errors) && resData.errors.length > 0) {
        return resData.errors.length === 1
            ? resData.errors[0]
            : resData.errors.map(err => `<div>• ${err}</div>`).join('');
    }

    // 2. Object dictionary of errors (ASP.NET Core Validation ProblemDetails)
    if (resData.errors && typeof resData.errors === 'object') {
        const errorList = [];
        for (const field in resData.errors) {
            const fieldErrors = resData.errors[field];
            if (Array.isArray(fieldErrors)) {
                errorList.push(...fieldErrors);
            } else if (typeof fieldErrors === 'string') {
                errorList.push(fieldErrors);
            }
        }
        if (errorList.length > 0) {
            return errorList.length === 1
                ? errorList[0]
                : errorList.map(err => `<div>• ${err}</div>`).join('');
        }
    }

    // 3. Direct message string: e.g. { message: "Current password is incorrect." }
    if (resData.message && typeof resData.message === 'string' && resData.message.trim() !== '') {
        return resData.message;
    }

    // 4. Detail string (RFC 7807 problem details)
    if (resData.detail && typeof resData.detail === 'string' && resData.detail.trim() !== '') {
        return resData.detail;
    }

    // 5. Title string
    if (resData.title && typeof resData.title === 'string' && resData.title.trim() !== '') {
        return resData.title;
    }

    // 6. Fallback
    return `Server error (${response?.status || 400}): Failed to change password.`;
}

/**
 * Stops the current user session by clearing auth tokens and cookies
 */
function stopCurrentSession() {
    try {
        if (typeof BSApp !== 'undefined' && typeof BSApp.clearSession === 'function') {
            BSApp.clearSession();
        }
    } catch (e) {
        console.warn('BSApp.clearSession failed:', e);
    }

    try {
        localStorage.removeItem('bs_user');
        localStorage.removeItem('bs_token');
        sessionStorage.clear();
        document.cookie = 'bs_auth_token=; path=/; max-age=0; SameSite=Lax';
    } catch (e) {
        console.warn('Storage cleanup failed:', e);
    }
}

/**
 * Initializes show/hide password toggle eye buttons
 */
function initPasswordToggles() {
    setupToggle('toggle-current-password', 'currentPassword');
    setupToggle('toggle-new-password', 'newPassword');
    setupToggle('toggle-confirm-password', 'confirmPassword');
}

function setupToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        const icon = btn.querySelector('i');
        if (icon) {
            if (isPassword) {
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        }
    });
}

/**
 * Toast Notification Utility (Positioned at Top-Right Screen)
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMessage) return;

    toastEl.className = 'toast align-items-center text-white border-0 rounded-3 shadow-lg';
    if (type === 'success') {
        toastEl.classList.add('bg-success');
        if (toastIcon) toastIcon.className = 'bi bi-check-circle-fill fs-5 flex-shrink-0';
    } else if (type === 'danger' || type === 'error') {
        toastEl.classList.add('bg-danger');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-triangle-fill fs-5 flex-shrink-0';
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning', 'text-dark');
        if (toastIcon) toastIcon.className = 'bi bi-exclamation-circle-fill fs-5 text-dark flex-shrink-0';
    } else {
        toastEl.classList.add('bg-primary');
        if (toastIcon) toastIcon.className = 'bi bi-info-circle-fill fs-5 flex-shrink-0';
    }

    toastMessage.innerHTML = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 6000 });
        toast.show();
    }
}
