/* ==========================================================================
   Business Solution Client - Frontend JavaScript Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. LOGIN FORM HANDLER
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
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

            const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api';
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

                    // Match exact response model: { succeeded, statusCode, message, data: { token, expiresIn, user: { id, name, email } } }
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
    }

    // 2. DASHBOARD USER AVATAR & INITIALS SYNC
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    if (userAvatarBtn) {
        const storedUser = localStorage.getItem('bs_user');
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                if (u.name) {
                    const dropdownName = document.getElementById('dropdown-user-name');
                    if (dropdownName) dropdownName.innerText = u.name;
                    
                    const nameParts = u.name.trim().split(' ');
                    let initials = 'MH';
                    if (nameParts.length >= 2) {
                        initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
                    } else if (nameParts.length === 1 && nameParts[0].length > 0) {
                        initials = nameParts[0].substring(0, 2).toUpperCase();
                    }
                    userAvatarBtn.innerText = initials;
                }
            } catch (e) { }
        }
    }

    const directoryTbody = document.getElementById('directory-tbody');
    if (directoryTbody) {
        fetchLiveEmployees();
    }
});

async function fetchLiveEmployees() {
    const token = localStorage.getItem('bs_token');
    if (!token) return;

    const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api';
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetAll?pageNumber=1&pageSize=5`;

    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const res = await response.json();
            if (res.succeeded && res.data && res.data.items && res.data.items.length > 0) {
                const items = res.data.items;
                const tbody = document.getElementById('directory-tbody');

                tbody.innerHTML = items.map(emp => {
                    const initials = emp.name ? emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EM';
                    return `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center gap-3">
                                    <div class="emp-initials-avatar">${initials}</div>
                                    <div>
                                        <div class="emp-name-text">${emp.name}</div>
                                        <div class="emp-email-text">${emp.email || 'No Email'}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${emp.designation || 'Unassigned'}</td>
                            <td>${emp.presentAddress || 'General'}</td>
                        </tr>
                    `;
                }).join('');

                if (res.data.totalCount) {
                    document.getElementById('metric-total-emp').innerText = res.data.totalCount;
                }
            }
        }
    } catch (e) {
        // Keeps static sample rows if live backend is offline
    }
}
