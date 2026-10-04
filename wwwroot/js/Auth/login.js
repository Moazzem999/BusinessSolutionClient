/* ==========================================================================
   Business Solution Client - Auth / Login Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById('username').value.trim();
        const passwordInput = document.getElementById('password').value;
        const errorAlert = document.getElementById('login-error-alert');
        const successAlert = document.getElementById('login-success-alert');
        const btnText = document.getElementById('btn-login-text');
        const btnSpinner = document.getElementById('login-spinner');
        const btnSubmit = document.getElementById('btn-login');

        errorAlert.classList.add('d-none');
        successAlert.classList.add('d-none');
        btnText.innerText = 'Authenticating...';
        btnSpinner.classList.remove('d-none');
        btnSubmit.disabled = true;

        const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
        const loginEndpoint = `${baseUrl.replace(/\/+$/, '')}/Auth/Login`;

        const requestPayload = {
            userName: usernameInput,
            password: passwordInput
        };

        try {
            let authSuccess = false;
            let userObj = { id: 1, name: 'Moazzem Hossain', email: 'meraj2@gmail.com' };
            let token = '';
            let responseMessage = '';

            try {
                console.log('Sending Login request to:', loginEndpoint, requestPayload);

                const response = await fetch(loginEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestPayload)
                });

                const resData = await response.json();
                console.log('Login API Response:', resData);

                if (resData && resData.succeeded === true && resData.data && resData.data.token) {
                    authSuccess = true;
                    token = resData.data.token;
                    if (resData.data.user) {
                        userObj = resData.data.user;
                    }
                    responseMessage = resData.message || 'Login successful.';
                } else {
                    responseMessage = (resData && resData.message) ? resData.message : `Authentication failed (Status ${response.status})`;
                }
            } catch (netErr) {
                console.warn('Backend API connection failed or SSL exception:', netErr);
                responseMessage = 'Could not connect to API at ' + loginEndpoint;

                // Demo fallback matching the user model
                if (usernameInput === 'admin' && passwordInput === 'Password123!') {
                    authSuccess = true;
                    token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOiIxIiwiZW1haWwiOiJtZXJhajJAZ21haWwuY29tIiwidW5pcXVlX25hbWUiOiJNZXJhaiIsImp0aSI6ImI1OTZmMmNjLTJlNDItNDI2Ni1hZmZlLTQ2YTY0ZDIxZTI2NCIsImV4cCI6MTc5MTAzNjczNiwiaXNzIjoiU2VjdXJlQXBpIiwiYXVkIjoiU2VjdXJlQXBpVXNlciJ9.0M1ZCNxjYlBrWEGy7_7B_gd5k6dcAvYDD0DZtk_crsM';
                    userObj = { id: 1, name: 'Moazzem Hossain', email: 'meraj2@gmail.com' };
                    responseMessage = 'Login successful (Demo Mode).';
                }
            }

            if (authSuccess) {
                // Set Auth Token Cookie (valid 1 day)
                document.cookie = `bs_auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
                localStorage.setItem('bs_user', JSON.stringify(userObj));
                localStorage.setItem('bs_token', token);

                successAlert.innerText = (responseMessage || 'Login successful.') + ' Redirecting...';
                successAlert.classList.remove('d-none');

                setTimeout(() => {
                    window.location.href = '/Dashboard';
                }, 500);
            } else {
                errorAlert.innerText = responseMessage;
                errorAlert.classList.remove('d-none');
            }
        } catch (err) {
            errorAlert.innerText = 'Login error: ' + err.message;
            errorAlert.classList.remove('d-none');
        } finally {
            btnText.innerText = 'Sign In';
            btnSpinner.classList.add('d-none');
            btnSubmit.disabled = false;
        }
    });

    const autofillBtn = document.getElementById('btn-autofill');
    if (autofillBtn) {
        autofillBtn.addEventListener('click', () => {
            document.getElementById('username').value = 'admin';
            document.getElementById('password').value = 'Password123!';
        });
    }
});
