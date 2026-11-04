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
        let isValid = true;
        clearValidationState();

        if (!currentPassword) {
            markInvalid(currentPasswordInput, 'current-password-feedback', 'Current password is required.');
            isValid = false;
        }

        if (!newPassword) {
            markInvalid(newPasswordInput, 'new-password-feedback', 'New password is required.');
            isValid = false;
        } else if (newPassword.length < 6) {
            markInvalid(newPasswordInput, 'new-password-feedback', 'New password must be at least 6 characters long.');
            isValid = false;
        }

        if (!confirmPassword) {
            markInvalid(confirmPasswordInput, 'confirm-password-feedback', 'Please confirm your new password.');
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            markInvalid(confirmPasswordInput, 'confirm-password-feedback', 'Passwords do not match.');
            isValid = false;
        }

        if (currentPassword && newPassword && currentPassword === newPassword) {
            markInvalid(newPasswordInput, 'new-password-feedback', 'New password cannot be the same as current password.');
            isValid = false;
        }

        if (!isValid) {
            showToast('Please fix the errors in the form before submitting.', 'danger');
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
                
                // Show Success Alert & Toast
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
                // Determine error message from response
                let errorMsg = 'Failed to change password.';
                if (resData) {
                    if (resData.message) {
                        errorMsg = resData.message;
                    } else if (resData.errors && typeof resData.errors === 'object') {
                        errorMsg = Object.values(resData.errors).flat().join(' ');
                    } else if (resData.title) {
                        errorMsg = resData.title;
                    }
                } else {
                    errorMsg = `Server returned status ${response.status} (${response.statusText})`;
                }

                if (errorMessage) errorMessage.innerText = errorMsg;
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
            const errStr = 'Network error: Unable to connect to server. Please try again.';
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
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
    const toastEl = document.getElementById('app-toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toastEl || !toastMessage) return;

    toastEl.className = 'toast align-items-center text-white border-0 rounded-3 shadow-lg';
    if (type === 'success') {
        toastEl.classList.add('bg-success');
        if (toastIcon) toastIcon.className = 'bi bi-check-circle-fill fs-5';
    } else if (type === 'danger' || type === 'error') {
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

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4500 });
        toast.show();
    }
}

