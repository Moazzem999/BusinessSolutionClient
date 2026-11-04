/* ==========================================================================
   Business Solution Client - Customer Payments JavaScript
   Handles listing, filtering, pagination, payment voucher modal,
   create payment modal, delete payment, and exports (PDF / Excel).
   API: 
     - GET /api/CustomerPayments/GetAll?SearchTerm=...&CustomerId=...&FromDate=...&ToDate=...&PageNumber=...&PageSize=...
     - GET /api/Customers/GetByName/{name}
     - POST /api/CustomerPayments
     - DELETE /api/CustomerPayments/{id}
   Note: All query parameters are optional.
   ========================================================================== */

let currentPage = 1;
let pageSize = 10;
let searchTerm = '';
let customerId = '';
let fromDate = '';
let toDate = '';
let totalCount = 0;
let totalPages = 1;
let paymentsList = [];
let currentSelectedPayment = null;
let paymentDetailsModalInstance = null;
let createPaymentModalInstance = null;
let deletePaymentModalInstance = null;
let deletePaymentId = null;
let searchDebounceTimer = null;
let customerSearchDebounceTimer = null;
let currentFocusedSuggestionIndex = -1;
let customerMap = {};

// Sample fallback customers matching GET /api/Customers/GetByName
const SAMPLE_CUSTOMERS = [
    { id: 3, name: "Arif Hossain", shopName: "", currentBalance: 0, mobile: "01911176767", isSpecial: false },
    { id: 6, name: "Liton Mia", shopName: "Liton Garments", currentBalance: 41000, mobile: "01712345678", isSpecial: true },
    { id: 5, name: "Samsul Haque", shopName: "Samsu Fashion", currentBalance: 50000, mobile: "01977734343", isSpecial: true },
    { id: 4, name: "Jamil Khan", shopName: "", currentBalance: 15000, mobile: "01822233344", isSpecial: false }
];

// Sample fallback customer payments matching GET /api/CustomerPayments/GetAll response
const SAMPLE_PAYMENTS_DATA = [
    {
        customerId: 3,
        customerName: "Arif Hossain",
        customerShopName: "",
        payment: 1000,
        remarks: "Payment for Order CO-2026-0000004",
        transactionNo: "20261102-141a98bc66",
        transactionDate: "2026-11-02T00:00:00",
        customerPreviousBalance: 1000,
        customerNewBalance: 0,
        id: 3,
        isSpecial: false,
        createdOn: new Date().toISOString(), // Within 2 days -> Delete button visible
        updatedOn: new Date().toISOString(),
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        customerId: 6,
        customerName: "Liton Mia",
        customerShopName: "Liton Garments",
        payment: 5000,
        remarks: "Invoice Settlement for Order CO-2026-0000005",
        transactionNo: "20261102-d229f62b1e",
        transactionDate: "2026-11-02T00:00:00",
        customerPreviousBalance: 46000,
        customerNewBalance: 41000,
        id: 2,
        isSpecial: true,
        createdOn: new Date().toISOString(),
        updatedOn: new Date().toISOString(),
        createdBy: 1,
        updatedBy: 1,
        status: 1
    },
    {
        customerId: 5,
        customerName: "Samsul Haque",
        customerShopName: "Samsu Fashion",
        payment: 15000,
        remarks: "Bank Transfer Payment",
        transactionNo: "20261101-a1b2c3d4e5",
        transactionDate: "2026-11-01T14:30:00",
        customerPreviousBalance: 65000,
        customerNewBalance: 50000,
        id: 1,
        isSpecial: true,
        createdOn: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // > 2 days -> Delete hidden
        updatedOn: new Date().toISOString(),
        createdBy: 1,
        updatedBy: 1,
        status: 1
    }
];

// Helper: Get Base URL for API
function getApiBaseUrl() {
    return (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : 'https://localhost:7148/api';
}

// Helper: Get Authorization Token
function getAuthToken() {
    let token = localStorage.getItem('bs_token');
    if (!token) {
        const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
        if (match) token = decodeURIComponent(match[2]);
    }
    return token;
}

// Helper: Resolves image path into valid URL
function resolveImageUrl(imagePath) {
    if (!imagePath || imagePath.trim() === '') return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = getApiBaseUrl().replace(/\/api\/?$/, '');
    return `${base}/${imagePath.replace(/^\/+/, '')}`;
}

// Helper: Initials generator
function getInitials(name) {
    if (!name || name === '—') return 'CU';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Helper: Check if record is within 2 days (for deletion check)
function isWithinTwoDays(dateString) {
    if (!dateString) return false;
    try {
        const itemDate = new Date(dateString);
        if (isNaN(itemDate.getTime())) return false;
        const now = new Date();
        const diffInMs = now.getTime() - itemDate.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);
        // Up to 48 hours, with slight client-server clock tolerance
        return diffInHours >= -1 && diffInHours <= 48;
    } catch (_) {
        return false;
    }
}

// Helper: Date Formatter (e.g. Nov 2, 2026)
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (_) {
        return dateStr;
    }
}

// Helper: Date & Time Formatter
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (_) {
        return dateStr;
    }
}

// Helper: Currency Formatter
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Helper: HTML Escaping
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Show Toast
function showToast(message, type = 'primary') {
    const toastEl = document.getElementById('app-toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if (!toastEl || !toastMsg) return;

    toastEl.className = `toast align-items-center text-white border-0 rounded-3 shadow-lg bg-${type}`;
    if (toastIcon) {
        toastIcon.className = type === 'success' ? 'bi bi-check-circle-fill fs-5' :
                              type === 'danger' ? 'bi bi-exclamation-triangle-fill fs-5' :
                              type === 'warning' ? 'bi bi-exclamation-circle-fill fs-5' :
                              'bi bi-info-circle-fill fs-5';
    }
    toastMsg.textContent = message;

    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
        toast.show();
    }
}

// Copy to Clipboard
window.copyToClipboard = function(text, label = 'Text') {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied to clipboard!`, 'success');
    }).catch(() => {
        showToast(`Failed to copy ${label}.`, 'danger');
    });
};

/**
 * Reads any query parameters passed via URL (e.g. ?SearchTerm=...&CustomerId=...&FromDate=...&ToDate=...)
 */
function parseUrlParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('CustomerId')) customerId = urlParams.get('CustomerId') || '';
        else if (urlParams.has('customerId')) customerId = urlParams.get('customerId') || '';

        if (urlParams.has('SearchTerm')) searchTerm = urlParams.get('SearchTerm') || '';
        else if (urlParams.has('searchTerm')) searchTerm = urlParams.get('searchTerm') || '';

        if (urlParams.has('FromDate')) fromDate = urlParams.get('FromDate') || '';
        else if (urlParams.has('fromDate')) fromDate = urlParams.get('fromDate') || '';

        if (urlParams.has('ToDate')) toDate = urlParams.get('ToDate') || '';
        else if (urlParams.has('toDate')) toDate = urlParams.get('toDate') || '';

        if (urlParams.has('PageNumber')) currentPage = parseInt(urlParams.get('PageNumber'), 10) || 1;
        if (urlParams.has('PageSize')) pageSize = parseInt(urlParams.get('PageSize'), 10) || 10;

        // Sync inputs with parsed params
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchTerm) searchInput.value = searchTerm;

        const fromDateInput = document.getElementById('from-date-input');
        if (fromDateInput && fromDate) fromDateInput.value = fromDate;

        const toDateInput = document.getElementById('to-date-input');
        if (toDateInput && toDate) toDateInput.value = toDate;

        const pageSizeSelect = document.getElementById('page-size-select');
        if (pageSizeSelect && pageSize) pageSizeSelect.value = pageSize.toString();

    } catch (e) {
        console.warn('Could not parse URL query parameters:', e);
    }
}

/**
 * Collects current filter inputs and triggers reload without needing to click Apply Filter button
 */
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');

    searchTerm = searchInput ? searchInput.value.trim() : '';
    fromDate = fromDateInput ? fromDateInput.value.trim() : '';
    toDate = toDateInput ? toDateInput.value.trim() : '';

    currentPage = 1;

    // Keep URL in sync without reload
    if (window.history && window.history.replaceState) {
        const url = new URL(window.location);
        if (searchTerm) url.searchParams.set('SearchTerm', searchTerm);
        else url.searchParams.delete('SearchTerm');

        if (fromDate) url.searchParams.set('FromDate', fromDate);
        else url.searchParams.delete('FromDate');

        if (toDate) url.searchParams.set('ToDate', toDate);
        else url.searchParams.delete('ToDate');

        window.history.replaceState({}, document.title, url.pathname + url.search);
    }

    loadCustomerPayments();
}

/* ==========================================================================
   Page Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', initCustomerPaymentsPage);

function initCustomerPaymentsPage() {
    const filterForm = document.getElementById('payment-filter-form');
    const searchInput = document.getElementById('search-input');
    const fromDateInput = document.getElementById('from-date-input');
    const toDateInput = document.getElementById('to-date-input');
    const btnReset = document.getElementById('btn-reset');
    const pageSizeSelect = document.getElementById('page-size-select');
    const btnRetryApi = document.getElementById('btn-retry-api');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const createPaymentForm = document.getElementById('create-payment-form');
    const paymentAmountInput = document.getElementById('payment-amount-input');

    // Parse URL parameters on load
    parseUrlParameters();

    // Debounced search typing in filter bar (auto-filters as user types)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
            }, 400);
        });
    }

    // Filter Form Submit
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    // Auto-apply filters when date changes (no need to click Apply Filter)
    if (fromDateInput) {
        fromDateInput.addEventListener('change', () => {
            applyFilters();
        });
        fromDateInput.addEventListener('input', () => {
            applyFilters();
        });
    }
    if (toDateInput) {
        toDateInput.addEventListener('change', () => {
            applyFilters();
        });
        toDateInput.addEventListener('input', () => {
            applyFilters();
        });
    }

    // Reset Filters
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            searchTerm = '';
            customerId = '';
            fromDate = '';
            toDate = '';
            currentPage = 1;

            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }

            loadCustomerPayments();
        });
    }

    // Rows per page change
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = parseInt(e.target.value, 10) || 10;
            currentPage = 1;
            loadCustomerPayments();
        });
    }

    // Retry API
    if (btnRetryApi) {
        btnRetryApi.addEventListener('click', () => {
            const apiErrorAlert = document.getElementById('api-error-alert');
            if (apiErrorAlert) apiErrorAlert.classList.add('d-none');
            loadCustomerPayments();
        });
    }

    // Export PDF & Excel
    if (btnExportPdf) btnExportPdf.addEventListener('click', exportToPdf);
    if (btnExportExcel) btnExportExcel.addEventListener('click', exportToExcel);

    // Amount input in Create Payment modal -> recalculate balance live
    if (paymentAmountInput) {
        paymentAmountInput.addEventListener('input', recalculatePaymentBalances);
    }

    // Create Payment Form Submit
    if (createPaymentForm) {
        createPaymentForm.addEventListener('submit', handleCreatePaymentSubmit);
    }

    // Delete Payment Confirm Button
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-payment');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', executeDeletePayment);
    }

    // Reset create modal when opened
    const createModalEl = document.getElementById('createPaymentModal');
    if (createModalEl) {
        createModalEl.addEventListener('show.bs.modal', resetCreatePaymentForm);
    }

    // Setup searchable customer combobox
    initCustomerAutocomplete();

    // Initial Load
    loadCustomerPayments();
}

/* ==========================================================================
   Customer Searchable Combobox with isSpecial Tooltip
   ========================================================================== */
function initCustomerAutocomplete() {
    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const clearBtn = document.getElementById('btn-clear-customer');
    const menu = document.getElementById('customer-suggestions-menu');
    const container = document.getElementById('customer-search-container');

    if (!searchInput || !menu) return;

    // Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        const list = document.getElementById('customer-suggestions-list');
        if (!list) return;

        const items = list.querySelectorAll('.customer-suggestion-item');
        if (!items || items.length === 0 || menu.classList.contains('d-none') || menu.style.display === 'none') {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocusedSuggestionIndex++;
            if (currentFocusedSuggestionIndex >= items.length) {
                currentFocusedSuggestionIndex = 0;
            }
            updateCustomerSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocusedSuggestionIndex--;
            if (currentFocusedSuggestionIndex < 0) {
                currentFocusedSuggestionIndex = items.length - 1;
            }
            updateCustomerSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (currentFocusedSuggestionIndex >= 0 && currentFocusedSuggestionIndex < items.length) {
                e.preventDefault();
                const selectedBtn = items[currentFocusedSuggestionIndex];
                const custId = selectedBtn.getAttribute('data-id');
                selectCustomer(custId);
            }
        } else if (e.key === 'Escape') {
            closeCustomerSuggestionsMenu();
        }
    });

    // Typing in search box
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        currentFocusedSuggestionIndex = -1;

        if (hiddenInput && hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            const prevBalInput = document.getElementById('payment-prev-balance-input');
            if (prevBalInput) prevBalInput.value = '0.00';
            const summaryText = document.getElementById('create-payment-summary-text');
            if (summaryText) summaryText.innerText = 'Select a customer and enter amount';
            recalculatePaymentBalances();
            if (clearBtn) clearBtn.classList.add('d-none');
        }

        if (val.length < 3) {
            closeCustomerSuggestionsMenu();
            if (val.length === 0) {
                if (hiddenInput) hiddenInput.value = '';
                const prevBalInput = document.getElementById('payment-prev-balance-input');
                if (prevBalInput) prevBalInput.value = '0.00';
                const summaryText = document.getElementById('create-payment-summary-text');
                if (summaryText) summaryText.innerText = 'Select a customer and enter amount';
                recalculatePaymentBalances();
                if (clearBtn) clearBtn.classList.add('d-none');
            }
            return;
        }

        clearTimeout(customerSearchDebounceTimer);
        customerSearchDebounceTimer = setTimeout(() => {
            searchCustomersByName(val);
        }, 300);
    });

    // Clear Button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearCustomerSelection();
            searchInput.focus();
        });
    }

    // Click outside -> close
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            closeCustomerSuggestionsMenu();
        }
    });
}

function updateCustomerSuggestionFocus(items) {
    items.forEach((item, index) => {
        const titleEl = item.querySelector('.item-title');
        const badgeEl = item.querySelector('.item-badge');

        if (index === currentFocusedSuggestionIndex) {
            item.classList.add('active', 'bg-primary', 'text-white');
            item.classList.remove('bg-white');
            if (titleEl) titleEl.classList.add('text-white');
            if (badgeEl) badgeEl.classList.add('bg-white', 'text-primary');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('active', 'bg-primary', 'text-white');
            if (titleEl) titleEl.classList.remove('text-white');
            if (badgeEl) badgeEl.classList.remove('bg-white', 'text-primary');
        }
    });
}

function closeCustomerSuggestionsMenu() {
    const menu = document.getElementById('customer-suggestions-menu');
    if (menu) {
        menu.classList.add('d-none');
        menu.style.display = 'none';
    }
    currentFocusedSuggestionIndex = -1;
}

/**
 * Calls API GET /api/Customers/GetByName/{name}
 */
async function searchCustomersByName(nameQuery) {
    const list = document.getElementById('customer-suggestions-list');
    const menu = document.getElementById('customer-suggestions-menu');
    if (!list || !menu) return;

    currentFocusedSuggestionIndex = -1;
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Customers/GetByName/${encodeURIComponent(nameQuery)}`;

    list.innerHTML = `
        <div class="p-3 text-center text-muted small">
            <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span> Searching customers...
        </div>
    `;
    menu.classList.remove('d-none');
    menu.style.display = 'block';

    try {
        console.log('Searching Customers from:', endpoint);
        const headers = {
            'Content-Type': 'application/json',
            'accept': '*/*'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const resData = await response.json();

        if (resData && resData.succeeded && Array.isArray(resData.data)) {
            const customers = resData.data;

            if (customers.length === 0) {
                list.innerHTML = `
                    <div class="p-3 text-center text-muted small">
                        <i class="bi bi-info-circle me-1"></i> No customers found for "<strong>${escapeHtml(nameQuery)}</strong>".
                    </div>
                `;
                return;
            }

            renderCustomerSuggestions(customers, list);

        } else {
            const matches = SAMPLE_CUSTOMERS.filter(c => 
                (c.name && c.name.toLowerCase().includes(nameQuery.toLowerCase())) ||
                (c.shopName && c.shopName.toLowerCase().includes(nameQuery.toLowerCase()))
            );
            if (matches.length > 0) {
                renderCustomerSuggestions(matches, list);
            } else {
                list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData?.message) || 'No customers found.'}</div>`;
            }
        }

    } catch (err) {
        console.warn('Error searching customers by name, checking sample fallback:', err);
        const matches = SAMPLE_CUSTOMERS.filter(c => 
            (c.name && c.name.toLowerCase().includes(nameQuery.toLowerCase())) ||
            (c.shopName && c.shopName.toLowerCase().includes(nameQuery.toLowerCase()))
        );
        if (matches.length > 0) {
            renderCustomerSuggestions(matches, list);
        } else {
            list.innerHTML = `<div class="p-3 text-center text-muted small"><i class="bi bi-info-circle me-1"></i> No customers found for "<strong>${escapeHtml(nameQuery)}</strong>".</div>`;
        }
    }
}

/**
 * Renders suggestions in the search menu with isSpecial tooltip
 */
function renderCustomerSuggestions(customers, list) {
    list.innerHTML = customers.map(customer => {
        customerMap[customer.id] = customer;
        const initials = getInitials(customer.name);
        let imgHtml = `<div class="avatar-circle-sm bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width:34px;height:34px;min-width:34px;font-size:12px;">${initials}</div>`;

        if (customer.imagePath && customer.imagePath.trim() !== '') {
            const fullImgUrl = resolveImageUrl(customer.imagePath);
            imgHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(customer.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 34px; height: 34px; min-width: 34px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'avatar-circle-sm bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold\\' style=\\'width:34px;height:34px;min-width:34px;font-size:12px;\\'>${initials}</div>';">`;
        }

        const balance = Number(customer.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const isSpecial = customer.isSpecial === true || customer.IsSpecial === true || customer.isSpecial === 'true';

        return `
            <button type="button" 
                    class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 customer-suggestion-item" 
                    data-id="${customer.id}" 
                    data-name="${escapeHtml(customer.name)}">
                <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                    ${imgHtml}
                    <div class="text-truncate">
                        <div class="d-flex align-items-center gap-1.5 mb-0 text-truncate">
                            <span class="fw-semibold text-dark text-truncate small item-title">${escapeHtml(customer.name)}</span>
                            ${isSpecial ? `
                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-1.5 py-0 flex-shrink-0" data-bs-toggle="tooltip" data-bs-placement="top" title="Special Customer" style="font-size: 0.68rem; cursor: help;">
                                    <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.6rem;"></i>Special
                                </span>
                            ` : ''}
                        </div>
                        <div class="text-muted small text-truncate item-subtitle" style="font-size: 0.75rem;">
                            <i class="bi bi-shop me-1 text-secondary"></i>${escapeHtml(customer.shopName || 'No Shop')}
                            ${customer.mobile ? `<span class="mx-1 text-muted">•</span><i class="bi bi-telephone me-1 text-secondary"></i>${escapeHtml(customer.mobile)}` : ''}
                        </div>
                    </div>
                </div>
                <div class="text-end flex-shrink-0">
                    <span class="badge bg-light text-primary border item-badge">৳ ${balance}</span>
                    <div class="text-muted small" style="font-size: 0.7rem;">ID #${customer.id}</div>
                </div>
            </button>
        `;
    }).join('');

    // Attach click listeners to suggestions
    list.querySelectorAll('.customer-suggestion-item').forEach(btn => {
        const handleSelection = (e) => {
            e.preventDefault();
            const custId = btn.getAttribute('data-id');
            selectCustomer(custId);
        };
        btn.addEventListener('mousedown', handleSelection);
        btn.addEventListener('click', handleSelection);
    });

    // Initialize tooltips on the new suggestion items
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        list.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    }
}

/**
 * Handles selecting a customer from suggestion list
 */
function selectCustomer(selectedCustId) {
    const customer = customerMap[selectedCustId];
    if (!customer) return;

    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const isSpecialInput = document.getElementById('customer-is-special');
    const clearBtn = document.getElementById('btn-clear-customer');
    const prevBalInput = document.getElementById('payment-prev-balance-input');
    const summaryText = document.getElementById('create-payment-summary-text');

    if (searchInput) {
        searchInput.value = customer.name;
        searchInput.setAttribute('data-selected-name', customer.name);
    }
    if (hiddenInput) hiddenInput.value = customer.id;
    if (isSpecialInput) isSpecialInput.value = (customer.isSpecial === true || customer.IsSpecial === true || customer.isSpecial === 'true') ? 'true' : 'false';

    const currentBal = Number(customer.currentBalance || 0);
    if (prevBalInput) prevBalInput.value = currentBal.toFixed(2);

    if (summaryText) {
        summaryText.innerText = `Selected: ${customer.name}${customer.shopName ? ` (${customer.shopName})` : ''}`;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    closeCustomerSuggestionsMenu();
    recalculatePaymentBalances();

    const amountInput = document.getElementById('payment-amount-input');
    if (amountInput) amountInput.focus();
}

function clearCustomerSelection() {
    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const isSpecialInput = document.getElementById('customer-is-special');
    const clearBtn = document.getElementById('btn-clear-customer');
    const prevBalInput = document.getElementById('payment-prev-balance-input');
    const summaryText = document.getElementById('create-payment-summary-text');

    if (searchInput) {
        searchInput.value = '';
        searchInput.removeAttribute('data-selected-name');
    }
    if (hiddenInput) hiddenInput.value = '';
    if (isSpecialInput) isSpecialInput.value = 'false';
    if (prevBalInput) prevBalInput.value = '0.00';
    if (summaryText) summaryText.innerText = 'Select a customer and enter amount';
    if (clearBtn) clearBtn.classList.add('d-none');

    recalculatePaymentBalances();
    closeCustomerSuggestionsMenu();
}

/**
 * Recalculates New Balance live:
 * Customer Balance decreases when payment is received: newBalance = prevBalance - paymentAmount
 */
function recalculatePaymentBalances() {
    const prevBalInput = document.getElementById('payment-prev-balance-input');
    const amountInput = document.getElementById('payment-amount-input');
    const newBalInput = document.getElementById('payment-new-balance-input');
    const previewPrevBal = document.getElementById('preview-prev-bal');
    const previewNewBal = document.getElementById('preview-new-bal');

    const prevBal = parseFloat(prevBalInput ? prevBalInput.value : 0) || 0;
    const paymentAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;
    const newBal = prevBal - paymentAmount;

    if (newBalInput) newBalInput.value = newBal.toFixed(2);
    if (previewPrevBal) previewPrevBal.innerText = `${formatCurrency(prevBal)}`;
    if (previewNewBal) {
        previewNewBal.innerText = `${formatCurrency(newBal)}`;
        previewNewBal.className = newBal < 0 ? 'badge bg-white text-danger border font-monospace fw-bold px-2 py-1' :
                                  newBal === 0 ? 'badge bg-white text-success border font-monospace fw-bold px-2 py-1' :
                                  'badge bg-white text-dark border font-monospace fw-bold px-2 py-1';
    }
}

function resetCreatePaymentForm() {
    clearCustomerSelection();
    const dateInput = document.getElementById('payment-date-input');
    const amountInput = document.getElementById('payment-amount-input');
    const remarksInput = document.getElementById('payment-remarks-input');
    const errorAlert = document.getElementById('create-payment-error');

    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    if (amountInput) amountInput.value = '';
    if (remarksInput) remarksInput.value = '';
    if (errorAlert) errorAlert.classList.add('d-none');
    recalculatePaymentBalances();
}

/* ==========================================================================
   Create Payment Submission (POST /api/CustomerPayments)
   ========================================================================== */
async function handleCreatePaymentSubmit(e) {
    e.preventDefault();

    const hiddenCustId = document.getElementById('customer-id');
    const dateInput = document.getElementById('payment-date-input');
    const amountInput = document.getElementById('payment-amount-input');
    const remarksInput = document.getElementById('payment-remarks-input');
    const errorAlert = document.getElementById('create-payment-error');
    const errorText = document.getElementById('create-payment-error-text');
    const btnSave = document.getElementById('btn-save-payment');
    const btnSaveText = document.getElementById('btn-save-payment-text');
    const btnSaveIcon = document.getElementById('btn-save-payment-icon');
    const btnSaveSpinner = document.getElementById('btn-save-payment-spinner');

    if (errorAlert) errorAlert.classList.add('d-none');

    const custIdVal = hiddenCustId ? hiddenCustId.value.trim() : '';
    if (!custIdVal) {
        if (errorAlert && errorText) {
            errorText.textContent = 'Please select a valid customer from the suggestions.';
            errorAlert.classList.remove('d-none');
        }
        document.getElementById('customer-search-input')?.focus();
        return;
    }

    const paymentAmount = parseFloat(amountInput ? amountInput.value : 0);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        if (errorAlert && errorText) {
            errorText.textContent = 'Please enter a valid payment amount greater than 0.';
            errorAlert.classList.remove('d-none');
        }
        amountInput?.focus();
        return;
    }

    const payload = {
        customerId: parseInt(custIdVal, 10),
        payment: paymentAmount,
        amount: paymentAmount,
        paymentDate: dateInput ? dateInput.value : new Date().toISOString().split('T')[0],
        remarks: remarksInput ? remarksInput.value.trim() : ''
    };

    if (btnSave) btnSave.disabled = true;
    if (btnSaveText) btnSaveText.textContent = 'Saving...';
    if (btnSaveIcon) btnSaveIcon.classList.add('d-none');
    if (btnSaveSpinner) btnSaveSpinner.classList.remove('d-none');

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/CustomerPayments`;

    try {
        console.log('Submitting Customer Payment to:', endpoint, payload);
        const headers = {
            'Content-Type': 'application/json',
            'accept': '*/*'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => null);
            throw new Error(errBody?.message || `Server returned HTTP ${response.status}`);
        }

        const resData = await response.json().catch(() => ({}));
        showToast('Customer payment recorded successfully!', 'success');

        const modalEl = document.getElementById('createPaymentModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }

        currentPage = 1;
        loadCustomerPayments();

    } catch (err) {
        console.error('Error submitting customer payment:', err);
        if (errorAlert && errorText) {
            errorText.textContent = err.message || 'Failed to submit payment to server.';
            errorAlert.classList.remove('d-none');
        }
    } finally {
        if (btnSave) btnSave.disabled = false;
        if (btnSaveText) btnSaveText.textContent = 'Save Payment';
        if (btnSaveIcon) btnSaveIcon.classList.remove('d-none');
        if (btnSaveSpinner) btnSaveSpinner.classList.add('d-none');
    }
}

/* ==========================================================================
   Load Customer Payments List (GET /api/CustomerPayments/GetAll)
   ========================================================================== */
async function loadCustomerPayments() {
    const tableBody = document.getElementById('payments-table-body');
    const loadingRow = document.getElementById('payments-loading-row');
    const emptyState = document.getElementById('payments-empty-state');
    const apiErrorAlert = document.getElementById('api-error-alert');
    const apiErrorMsg = document.getElementById('api-error-message');

    if (loadingRow) loadingRow.classList.remove('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    if (apiErrorAlert) apiErrorAlert.classList.add('d-none');

    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const token = getAuthToken();

    const queryParams = new URLSearchParams();
    if (searchTerm && searchTerm.trim() !== '') {
        queryParams.append('SearchTerm', searchTerm.trim());
    }
    if (customerId) {
        queryParams.append('CustomerId', customerId.toString());
    }
    if (fromDate && fromDate.trim() !== '') {
        queryParams.append('FromDate', fromDate.trim());
    }
    if (toDate && toDate.trim() !== '') {
        queryParams.append('ToDate', toDate.trim());
    }
    if (currentPage) {
        queryParams.append('PageNumber', currentPage.toString());
    }
    if (pageSize) {
        queryParams.append('PageSize', pageSize.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString 
        ? `${baseUrl}/CustomerPayments/GetAll?${queryString}` 
        : `${baseUrl}/CustomerPayments/GetAll`;

    try {
        console.log('Fetching Customer Payments from:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: headers
        });

        if (response.status === 401) {
            throw new Error('Unauthorized (401). Please sign in to fetch live records.');
        }

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status} (${response.statusText || 'Error'})`);
        }

        const resData = await response.json();
        console.log('Customer Payments API Response:', resData);

        let items = [];
        if (resData && resData.succeeded && resData.data) {
            items = resData.data.items || [];
            totalCount = resData.data.totalCount || items.length;
            totalPages = resData.data.totalPages || Math.ceil(totalCount / pageSize) || 1;
        } else if (Array.isArray(resData)) {
            items = resData;
            totalCount = items.length;
            totalPages = Math.ceil(totalCount / pageSize) || 1;
        } else if (resData.items) {
            items = resData.items;
            totalCount = resData.totalCount || items.length;
            totalPages = resData.totalPages || Math.ceil(totalCount / pageSize) || 1;
        }

        paymentsList = items;
        renderPaymentsTable(paymentsList);
        renderPaginationInfo(paymentsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();

    } catch (error) {
        console.warn('Customer Payments API error, falling back to sample data:', error.message);

        if (apiErrorAlert && apiErrorMsg) {
            apiErrorMsg.textContent = `Unable to connect to live API (${error.message}). Displaying cached sample payments.`;
            apiErrorAlert.classList.remove('d-none');
            apiErrorAlert.classList.add('d-flex');
        }

        let filteredSample = SAMPLE_PAYMENTS_DATA.filter(item => {
            let match = true;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const cName = (item.customerName || '').toLowerCase();
                const shop = (item.customerShopName || '').toLowerCase();
                const tx = (item.transactionNo || '').toLowerCase();
                const rem = (item.remarks || '').toLowerCase();
                if (!cName.includes(term) && !shop.includes(term) && !tx.includes(term) && !rem.includes(term)) {
                    match = false;
                }
            }
            if (fromDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').split('T')[0];
                if (itemDate && itemDate < fromDate) match = false;
            }
            if (toDate) {
                const itemDate = (item.transactionDate || item.createdOn || '').split('T')[0];
                if (itemDate && itemDate > toDate) match = false;
            }
            return match;
        });

        paymentsList = filteredSample;
        totalCount = filteredSample.length;
        totalPages = Math.ceil(totalCount / pageSize) || 1;

        renderPaymentsTable(paymentsList);
        renderPaginationInfo(paymentsList.length, totalCount, currentPage);
        renderPaginationControls(currentPage, totalPages);
        updateActiveFilterBadges();
    }
}

/**
 * Renders payments into table rows (without ৳ symbol in table rows)
 */
function renderPaymentsTable(items) {
    const tableBody = document.getElementById('payments-table-body');
    const emptyState = document.getElementById('payments-empty-state');
    if (!tableBody) return;

    if (!items || items.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    let html = '';
    items.forEach((item, index) => {
        const id = item.id || 0;
        const transNo = item.transactionNo || '—';
        const dateFormatted = formatDate(item.transactionDate || item.createdOn);
        const customerName = item.customerName || 'N/A';
        const shopName = item.customerShopName || '';
        const paymentAmount = Number(item.payment !== undefined ? item.payment : (item.amount || 0));
        const prevBal = Number(item.customerPreviousBalance !== undefined ? item.customerPreviousBalance : 0);
        const newBal = Number(item.customerNewBalance !== undefined ? item.customerNewBalance : (prevBal - paymentAmount));
        const remarks = item.remarks || item.notes || '—';
        const custFromMap = customerMap[item.customerId];
        const isSpecial = item.isSpecial === true || item.IsSpecial === true || item.isSpecial === 'true'
            || (custFromMap && (custFromMap.isSpecial === true || custFromMap.IsSpecial === true || custFromMap.isSpecial === 'true'));

        // Delete allowed ONLY for Special customers AND within 2 days of creation.
        // For regular customer payments, the delete button is permanently unavailable.
        const createdOnRaw = item.createdOn || item.CreatedOn || item.transactionDate;
        const canDelete = isSpecial && isWithinTwoDays(createdOnRaw);

        // Balance direction styling
        const balanceDecreased = newBal < prevBal;
        const balColorClass = balanceDecreased ? 'text-success' : 'text-dark';

        html += `
            <tr class="payment-row" data-id="${id}">
                <!-- Date -->
                <td class="ps-4">
                    <span class="fw-semibold text-dark">${dateFormatted}</span>
                </td>

                <!-- Transaction Ref -->
                <td>
                    <div class="d-inline-flex align-items-center gap-1">
                        <span class="badge bg-light text-dark border font-monospace px-2 py-1 transaction-ref-badge" role="button" onclick="copyToClipboard('${escapeHtml(transNo)}', 'Transaction Ref')" title="Click to copy">
                            ${escapeHtml(transNo)}
                        </span>
                        <button type="button" class="btn btn-link btn-sm p-0 text-muted" onclick="copyToClipboard('${escapeHtml(transNo)}', 'Transaction Ref')" title="Copy Reference">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </td>

                <!-- Customer Info -->
                <td style="max-width: 230px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="avatar-circle-sm bg-light text-primary border rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0" style="width: 34px; height: 34px; min-width: 34px; font-size: 0.8rem;">
                            <i class="bi bi-person-fill"></i>
                        </div>
                        <div class="text-truncate">
                            <div class="d-flex align-items-center gap-1.5 mb-0 text-truncate">
                                <span class="fw-semibold text-dark text-truncate" title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</span>
                                ${isSpecial ? `
                                    <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0 flex-shrink-0" data-bs-toggle="tooltip" data-bs-placement="top" title="Special Customer" style="font-size: 0.72rem; cursor: help;">
                                        <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.65rem;"></i>Special
                                    </span>
                                ` : ''}
                            </div>
                            ${shopName ? `
                                <div class="text-muted small d-flex align-items-center gap-1 text-truncate" title="${escapeHtml(shopName)}">
                                    <i class="bi bi-shop small"></i> ${escapeHtml(shopName)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </td>

                <!-- Remarks -->
                <td style="max-width: 180px;">
                    <span class="text-muted small text-truncate d-inline-block" style="max-width: 170px;" title="${escapeHtml(remarks)}">
                        ${escapeHtml(remarks)}
                    </span>
                </td>

                <!-- Payment Amount (No ৳ symbol) -->
                <td class="text-end">
                    <span class="fw-bold text-success font-monospace">${formatCurrency(paymentAmount)}</span>
                </td>

                <!-- Balance Flow -->
                <td class="text-center">
                    <div class="balance-flow-box justify-content-center">
                        <span class="text-muted font-monospace small" title="Previous Balance">${formatCurrency(prevBal)}</span>
                        <i class="bi bi-arrow-right text-secondary small"></i>
                        <span class="fw-bold font-monospace ${balColorClass}" title="New Balance">${formatCurrency(newBal)}</span>
                    </div>
                </td>

                <!-- Actions -->
                <td class="pe-4 text-end">
                    <div class="d-inline-flex gap-1 justify-content-end">
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-3 px-2.5 py-1.5" onclick="viewPaymentDetails(${index})" title="View Voucher">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${canDelete ? `
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-3 px-2.5 py-1.5" onclick="confirmDeletePayment(${id}, '${escapeHtml(transNo)}')" title="Delete Payment (within 2 days)">
                            <i class="bi bi-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Tooltips for special badges
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        tableBody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    }
}

function updateActiveFilterBadges() {
    const container = document.getElementById('active-filter-badges');
    if (!container) return;

    let badgesHtml = '';
    if (searchTerm) {
        badgesHtml += `
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>Search: <strong>${escapeHtml(searchTerm)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('search')" title="Remove"></i>
            </span>
        `;
    }
    if (fromDate) {
        badgesHtml += `
            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>From: <strong>${formatDate(fromDate)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('from')" title="Remove"></i>
            </span>
        `;
    }
    if (toDate) {
        badgesHtml += `
            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill py-1 px-2.5 small d-inline-flex align-items-center gap-1">
                <span>To: <strong>${formatDate(toDate)}</strong></span>
                <i class="bi bi-x-circle-fill" role="button" onclick="clearSpecificFilter('to')" title="Remove"></i>
            </span>
        `;
    }

    container.innerHTML = badgesHtml;
}

window.clearSpecificFilter = function(filterType) {
    if (filterType === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
    } else if (filterType === 'from') {
        const fromDateInput = document.getElementById('from-date-input');
        if (fromDateInput) fromDateInput.value = '';
    } else if (filterType === 'to') {
        const toDateInput = document.getElementById('to-date-input');
        if (toDateInput) toDateInput.value = '';
    }
    applyFilters();
};

/* ==========================================================================
   Payment Voucher Details Modal (Financial summary shown only if isSpecial)
   ========================================================================== */
window.viewPaymentDetails = function(index) {
    const payment = paymentsList[index];
    if (!payment) return;

    currentSelectedPayment = payment;
    const modalTitleNo = document.getElementById('modal-payment-trans-no');
    const modalContent = document.getElementById('modal-payment-details-content');

    const paymentId = payment.id || payment.Id || '—';
    const transNo = payment.transactionNo || payment.TransactionNo || '—';
    const customerName = payment.customerName || payment.CustomerName || '—';
    const shopName = payment.customerShopName || payment.CustomerShopName || '';
    const customerIdVal = payment.customerId || payment.CustomerId || '—';
    const dateFormatted = formatDateTime(payment.transactionDate || payment.createdOn);
    const paidAmount = Number(payment.payment !== undefined ? payment.payment : (payment.amount || 0));
    const prevBalance = Number(payment.customerPreviousBalance !== undefined ? payment.customerPreviousBalance : 0);
    const newBalance = Number(payment.customerNewBalance !== undefined ? payment.customerNewBalance : (prevBalance - paidAmount));
    const notes = payment.remarks || payment.notes || 'None';
    const isSpecial = payment.isSpecial === true || payment.IsSpecial === true || payment.isSpecial === 'true';

    if (modalTitleNo) modalTitleNo.innerText = transNo;

    if (modalContent) {
        modalContent.innerHTML = `
            <!-- Master Info Cards -->
            <div class="row g-3 mb-4">
                <!-- 1. Customer Card -->
                <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-primary">
                            <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-person-fill fs-6 text-primary"></i>
                            </div>
                            <span class="fw-semibold fs-6">Customer</span>
                        </div>
                        <div class="fw-bold text-dark mb-1 d-flex align-items-center gap-2 text-truncate">
                            <span class="text-truncate" title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</span>
                            ${isSpecial ? `
                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill small px-2 py-0" style="font-size: 0.72rem;">
                                    <i class="bi bi-star-fill text-warning me-1" style="font-size: 0.65rem;"></i>Special
                                </span>
                            ` : ''}
                        </div>
                        ${shopName ? `
                            <div class="text-secondary small mb-1 text-truncate" title="${escapeHtml(shopName)}">
                                <i class="bi bi-shop me-1 text-secondary"></i>${escapeHtml(shopName)}
                            </div>
                        ` : ''}
                        <div class="text-muted small">
                            Customer ID: <span class="fw-bold text-dark">#${escapeHtml(customerIdVal)}</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Financial Summary Card (Special Customers Only) -->
                ${isSpecial ? `
                <div class="col-12 col-md-4">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-success">
                            <div class="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-cash-stack fs-6 text-success"></i>
                            </div>
                            <h6 class="mb-0 fw-bold text-dark">Financial Summary</h6>
                        </div>
                        <div class="d-flex justify-content-between text-muted small mb-1">
                            <span>Old Balance:</span>
                            <span class="font-monospace text-dark">৳ ${formatCurrency(prevBalance)}</span>
                        </div>
                        <div class="d-flex justify-content-between fw-bold fs-6 mb-1 text-success">
                            <span>Received:</span>
                            <span class="font-monospace">৳ ${formatCurrency(paidAmount)}</span>
                        </div>
                        <div class="d-flex justify-content-between text-muted small pt-1">
                            <span>New Balance:</span>
                            <span class="font-monospace fw-bold text-dark">৳ ${formatCurrency(newBalance)}</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 3. Information Card -->
                <div class="${isSpecial ? 'col-12 col-md-4' : 'col-12 col-md-6'}">
                    <div class="p-3 bg-light rounded-4 h-100 border">
                        <div class="d-flex align-items-center gap-2 mb-2 text-info">
                            <div class="rounded-circle bg-info-subtle text-info d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                <i class="bi bi-info-circle fs-6 text-info"></i>
                            </div>
                            <span class="fw-semibold fs-6 text-info">Information</span>
                        </div>
                        <div class="text-muted small mb-1">
                            Date: <span class="fw-medium text-dark">${dateFormatted}</span>
                        </div>
                        <div class="text-muted small mb-1">
                            Payment ID: <span class="fw-bold text-dark">#${escapeHtml(paymentId)}</span>
                        </div>
                        <div class="text-muted small d-flex align-items-center gap-1">
                            <span>Notes:</span>
                            <span class="badge bg-white text-dark border fw-normal text-truncate" style="max-width: 150px;" title="${escapeHtml(notes)}">${escapeHtml(notes)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Voucher Specifications Overview -->
            <div class="card border rounded-3 overflow-hidden">
                <div class="card-header bg-white py-2 px-3 fw-bold small text-uppercase text-secondary d-flex align-items-center gap-2">
                    <i class="bi bi-card-text"></i>
                    <span>Voucher Specifications</span>
                </div>
                <div class="card-body p-0">
                    <table class="table table-bordered mb-0 small">
                        <tbody>
                            <tr>
                                <th class="bg-light text-secondary fw-semibold" style="width: 25%;">Transaction Reference</th>
                                <td class="font-monospace fw-medium" style="width: 25%;">${escapeHtml(transNo)}</td>
                                <th class="bg-light text-secondary fw-semibold" style="width: 25%;">Status</th>
                                <td style="width: 25%;"><span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 fw-semibold">Completed</span></td>
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary fw-semibold">Customer Name</th>
                                <td class="fw-medium">${escapeHtml(customerName)}</td>
                                <th class="bg-light text-secondary fw-semibold">Shop / Outlet</th>
                                <td class="fw-medium">${escapeHtml(shopName || '—')}</td>
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary fw-semibold">Received Amount</th>
                                <td class="fw-bold text-success font-monospace" ${isSpecial ? '' : 'colspan="3"'}>৳ ${formatCurrency(paidAmount)}</td>
                                ${isSpecial ? `
                                <th class="bg-light text-secondary fw-semibold">Updated Balance</th>
                                <td class="font-monospace fw-bold text-dark">৳ ${formatCurrency(newBalance)}</td>
                                ` : ''}
                            </tr>
                            <tr>
                                <th class="bg-light text-secondary fw-semibold">Remarks</th>
                                <td colspan="3">${escapeHtml(notes)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (paymentDetailsModalInstance) {
        paymentDetailsModalInstance.show();
    } else {
        const modalEl = document.getElementById('paymentDetailsModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            paymentDetailsModalInstance = new bootstrap.Modal(modalEl);
            paymentDetailsModalInstance.show();
        }
    }
};

/* ==========================================================================
   Delete Payment (DELETE /api/CustomerPayments/{id})
   ========================================================================== */
window.confirmDeletePayment = function(id, transNo) {
    const payment = paymentsList.find(p => (p.id || p.Id) == id);
    if (payment) {
        const custFromMap = customerMap[payment.customerId];
        const isSpecial = payment.isSpecial === true || payment.IsSpecial === true || payment.isSpecial === 'true'
            || (custFromMap && (custFromMap.isSpecial === true || custFromMap.IsSpecial === true || custFromMap.isSpecial === 'true'));
        const createdOnRaw = payment.createdOn || payment.CreatedOn || payment.transactionDate;

        if (!isSpecial) {
            showToast('Delete is permanently unavailable for regular customer payments.', 'warning');
            return;
        }
        if (!isWithinTwoDays(createdOnRaw)) {
            showToast('Payments older than 2 days cannot be deleted.', 'warning');
            return;
        }
    }

    deletePaymentId = id;
    const refEl = document.getElementById('delete-payment-ref');
    const idEl = document.getElementById('delete-payment-id');
    const errAlert = document.getElementById('delete-payment-error');

    if (refEl) refEl.innerText = transNo || `#${id}`;
    if (idEl) idEl.innerText = id;
    if (errAlert) errAlert.classList.add('d-none');

    if (deletePaymentModalInstance) {
        deletePaymentModalInstance.show();
    } else {
        const modalEl = document.getElementById('deletePaymentModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            deletePaymentModalInstance = new bootstrap.Modal(modalEl);
            deletePaymentModalInstance.show();
        }
    }
};

async function executeDeletePayment() {
    if (!deletePaymentId) return;

    const btnConfirm = document.getElementById('btn-confirm-delete-payment');
    const btnText = document.getElementById('btn-confirm-delete-payment-text');
    const errAlert = document.getElementById('delete-payment-error');
    const errText = document.getElementById('delete-payment-error-text');

    if (btnConfirm) btnConfirm.disabled = true;
    if (btnText) btnText.innerText = 'Deleting...';
    if (errAlert) errAlert.classList.add('d-none');

    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/CustomerPayments/${encodeURIComponent(deletePaymentId)}`;

    try {
        console.log('Deleting Customer Payment:', endpoint);
        const headers = { 'accept': '*/*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.message || `Failed with HTTP ${response.status}`);
        }

        showToast('Payment record deleted successfully.', 'success');

        const modalEl = document.getElementById('deletePaymentModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
        }

        deletePaymentId = null;
        loadCustomerPayments();

    } catch (err) {
        console.error('Delete payment error:', err);
        if (errAlert && errText) {
            errText.innerText = err.message || 'Failed to delete payment.';
            errAlert.classList.remove('d-none');
        }
    } finally {
        if (btnConfirm) btnConfirm.disabled = false;
        if (btnText) btnText.innerText = 'Delete';
    }
}

/* ==========================================================================
   Pagination Controls
   ========================================================================== */
function renderPaginationInfo(itemCount, total, page) {
    const infoEl = document.getElementById('pagination-info');
    if (!infoEl) return;

    if (total === 0 || itemCount === 0) {
        infoEl.innerText = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(start + itemCount - 1, total);
    infoEl.innerText = `Showing ${start} to ${end} of ${total} entries`;
}

function renderPaginationControls(page, totalPgs) {
    const listEl = document.getElementById('pagination-list');
    if (!listEl) return;

    if (totalPgs <= 1) {
        listEl.innerHTML = '';
        return;
    }

    let html = '';

    const prevDisabled = page <= 1 ? 'disabled' : '';
    html += `
        <li class="page-item ${prevDisabled}">
            <button class="page-link rounded-2 px-2 py-1" onclick="navigateToPage(${page - 1})" aria-label="Previous" ${page <= 1 ? 'disabled' : ''}>
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPgs, page + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(1)">1</button></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === page ? 'active' : '';
        html += `
            <li class="page-item ${activeClass}">
                <button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(${p})">${p}</button>
            </li>
        `;
    }

    if (endPage < totalPgs) {
        if (endPage < totalPgs - 1) {
            html += `<li class="page-item disabled"><span class="page-link border-0">...</span></li>`;
        }
        html += `<li class="page-item"><button class="page-link rounded-2 px-3 py-1" onclick="navigateToPage(${totalPgs})">${totalPgs}</button></li>`;
    }

    const nextDisabled = page >= totalPgs ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <button class="page-link rounded-2 px-2 py-1" onclick="navigateToPage(${page + 1})" aria-label="Next" ${page >= totalPgs ? 'disabled' : ''}>
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;

    listEl.innerHTML = html;
}

window.navigateToPage = function(targetPage) {
    if (targetPage < 1 || (totalPages && targetPage > totalPages) || targetPage === currentPage) {
        return;
    }
    currentPage = targetPage;
    loadCustomerPayments();
};

/* ==========================================================================
   Exports (PDF & Excel)
   ========================================================================== */
function exportToExcel() {
    if (!paymentsList || paymentsList.length === 0) {
        showToast('No payment records to export.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel export library not loaded. Please try again.', 'danger');
        return;
    }

    try {
        const exportData = paymentsList.map(item => ({
            "Transaction Ref": item.transactionNo || '',
            "Date": formatDate(item.transactionDate || item.createdOn),
            "Customer Name": item.customerName || '',
            "Customer Shop": item.customerShopName || '',
            "Payment Received (BDT)": Number(item.payment !== undefined ? item.payment : (item.amount || 0)),
            "Previous Balance (BDT)": Number(item.customerPreviousBalance || 0),
            "New Balance (BDT)": Number(item.customerNewBalance || 0),
            "Remarks": item.remarks || item.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Customer Payments");

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Customer_Payments_${dateStr}.xlsx`);
        showToast('Excel report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to Excel:', e);
        showToast('Failed to export to Excel.', 'danger');
    }
}

function exportToPdf() {
    if (!paymentsList || paymentsList.length === 0) {
        showToast('No payment records to export.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        showToast('PDF export library not loaded. Please try again.', 'danger');
        return;
    }

    try {
        const doc = new jsPDF('landscape', 'pt', 'a4');

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("Customer Payments Log Report", 40, 45);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.text(`Generated on: ${dateStr} | Total Records: ${paymentsList.length}`, 40, 65);

        const tableHeaders = [[
            'Date',
            'Transaction Ref',
            'Customer',
            'Shop',
            'Remarks',
            { content: 'Payment (BDT)', styles: { halign: 'right' } },
            { content: 'Prev Balance', styles: { halign: 'right' } },
            { content: 'New Balance', styles: { halign: 'right' } }
        ]];
        const tableRows = paymentsList.map(item => [
            formatDate(item.transactionDate || item.createdOn),
            item.transactionNo || '—',
            item.customerName || '',
            item.customerShopName || '',
            item.remarks || item.notes || '',
            formatCurrency(item.payment !== undefined ? item.payment : item.amount),
            formatCurrency(item.customerPreviousBalance),
            formatCurrency(item.customerNewBalance)
        ]);

        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 80,
            styles: {
                fontSize: 8.5,
                cellPadding: 5,
                valign: 'middle'
            },
            headStyles: {
                fillColor: [241, 245, 249],
                textColor: [51, 65, 85],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 110 },
                2: { cellWidth: 120 },
                3: { cellWidth: 100 },
                4: { cellWidth: 110 },
                5: { halign: 'right', cellWidth: 85 },
                6: { halign: 'right', cellWidth: 85 },
                7: { halign: 'right', cellWidth: 85 }
            },
            didParseCell: function(data) {
                if (data.section === 'head' && [5, 6, 7].includes(data.column.index)) {
                    data.cell.styles.halign = 'right';
                }
            }
        });

        const saveDate = new Date().toISOString().split('T')[0];
        doc.save(`Customer_Payments_${saveDate}.pdf`);
        showToast('PDF report generated successfully.', 'success');

    } catch (e) {
        console.error('Failed to export to PDF:', e);
        showToast('Failed to export to PDF.', 'danger');
    }
}

