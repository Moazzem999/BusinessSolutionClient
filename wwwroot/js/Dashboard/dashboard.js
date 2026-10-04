/* ==========================================================================
   Business Solution Client - Dashboard Page JavaScript
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardMetrics();
});

/**
 * Fetches employee count metrics from API and updates the dashboard metric cards
 */
async function fetchDashboardMetrics() {
    const token = typeof BSApp !== 'undefined' ? BSApp.getStoredToken() : localStorage.getItem('bs_token');
    if (!token) return;

    const baseUrl = typeof BSApp !== 'undefined' ? BSApp.getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://localhost:7148/api');
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/Employees/GetAll?pageNumber=1&pageSize=1`;

    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const res = await response.json();
            if (res.succeeded && res.data && res.data.totalCount !== undefined) {
                const totalEmpEl = document.getElementById('metric-total-emp');
                if (totalEmpEl) {
                    totalEmpEl.innerText = res.data.totalCount;
                }
            }
        }
    } catch (e) {
        // Keeps fallback count if live backend is offline
    }
}
