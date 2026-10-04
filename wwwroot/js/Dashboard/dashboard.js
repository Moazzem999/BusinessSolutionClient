/* ==========================================================================
   Business Solution Client - Dashboard Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const directoryTbody = document.getElementById('directory-tbody');
    if (directoryTbody) {
        fetchLiveEmployees();
    }
});

/**
 * Fetches employee records from API and populates the directory table on the dashboard
 */
async function fetchLiveEmployees() {
    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    if (!token) return;

    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
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
                    const totalEmpEl = document.getElementById('metric-total-emp');
                    if (totalEmpEl) {
                        totalEmpEl.innerText = res.data.totalCount;
                    }
                }
            }
        }
    } catch (e) {
        // Keeps static sample rows if live backend is offline
    }
}
