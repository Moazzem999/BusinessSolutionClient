/* ==========================================================================
   Business Solution Client - Create Customer Order JavaScript
   ========================================================================== */

let rowCounter = 0;
let customerMap = {};
let customerSearchDebounceTimer = null;
let currentFocusedCustomerIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
    initCreateCOPage();
});

function initCreateCOPage() {
    // Set default order date to today
    const orderDateInput = document.getElementById('order-date');
    if (orderDateInput && !orderDateInput.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        orderDateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    initCustomerAutocomplete();
    initOrderItemsTable();
    initCreateCOForm();
}

/**
 * Returns API base URL
 */
function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && BSApp.apiBaseUrl) {
        return BSApp.apiBaseUrl;
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL;
    }
    return 'https://localhost:7148/api';
}

/**
 * Retrieves authentication token
 */
function getAuthToken() {
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    const cookieToken = getCookie('bs_auth_token');
    if (cookieToken && cookieToken.trim() !== '') {
        return cookieToken.trim();
    }

    const localToken = localStorage.getItem('bs_token') || sessionStorage.getItem('bs_token') || '';
    return localToken.trim();
}

/**
 * Helper to resolve relative image paths against API base URL
 */
function resolveImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    try {
        const base = new URL(getApiBaseUrl());
        const cleanedPath = path.startsWith('/') ? path : '/' + path;
        return `${base.origin}${cleanedPath}`;
    } catch (_) {
        const cleanedPath = path.startsWith('/') ? path : '/' + path;
        return `https://localhost:7148${cleanedPath}`;
    }
}

/**
 * Sanitizes text to prevent XSS injection in HTML output
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generates initials from customer or product name
 */
function getInitials(name) {
    if (!name) return 'CU';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

/**
 * Formats numbers into currency presentation (e.g. 50,300.00)
 */
function formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/* ==========================================================================
   1. Customer Search & Combobox
   GET https://localhost:7148/api/Customers/GetByName/{name}
   ========================================================================== */

function initCustomerAutocomplete() {
    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const prevBalanceInput = document.getElementById('customer-previous-balance');
    const menu = document.getElementById('customer-suggestions-menu');
    const list = document.getElementById('customer-suggestions-list');
    const clearBtn = document.getElementById('btn-clear-customer');
    const container = document.getElementById('customer-search-container');

    if (!searchInput || !hiddenInput || !menu || !list) return;

    // Typing in customer search input
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        currentFocusedCustomerIndex = -1;

        // If user is altering the name away from selected customer, reset hidden ID
        if (hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            prevBalanceInput.value = '0';
            if (clearBtn) clearBtn.classList.add('d-none');
            calculateOverallTotals();
        }

        if (val.length < 3) {
            closeCustomerSuggestionsMenu();
            if (val.length === 0) {
                clearCustomerSelection();
            }
            return;
        }

        clearTimeout(customerSearchDebounceTimer);
        customerSearchDebounceTimer = setTimeout(() => {
            searchCustomersByName(val);
        }, 300);
    });

    // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.customer-suggestion-item');
        if (!items || items.length === 0 || menu.classList.contains('d-none')) {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocusedCustomerIndex = (currentFocusedCustomerIndex + 1) % items.length;
            updateCustomerSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocusedCustomerIndex = (currentFocusedCustomerIndex - 1 + items.length) % items.length;
            updateCustomerSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (currentFocusedCustomerIndex >= 0 && currentFocusedCustomerIndex < items.length) {
                e.preventDefault();
                const selectedBtn = items[currentFocusedCustomerIndex];
                const custId = selectedBtn.getAttribute('data-id');
                selectCustomer(custId);
            }
        } else if (e.key === 'Escape') {
            closeCustomerSuggestionsMenu();
        }
    });

    // Clear Customer Button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearCustomerSelection();
            searchInput.focus();
        });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            closeCustomerSuggestionsMenu();
        }
    });
}

function updateCustomerSuggestionFocus(items) {
    items.forEach((item, idx) => {
        const titleEl = item.querySelector('.item-title');
        if (idx === currentFocusedCustomerIndex) {
            item.classList.add('active', 'bg-primary', 'text-white');
            if (titleEl) titleEl.classList.add('text-white');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('active', 'bg-primary', 'text-white');
            if (titleEl) titleEl.classList.remove('text-white');
        }
    });
}

function closeCustomerSuggestionsMenu() {
    const menu = document.getElementById('customer-suggestions-menu');
    if (menu) {
        menu.classList.add('d-none');
        menu.style.display = 'none';
    }
    currentFocusedCustomerIndex = -1;
}

/**
 * Calls API GET /api/Customers/GetByName/{name}
 */
async function searchCustomersByName(nameQuery) {
    const list = document.getElementById('customer-suggestions-list');
    const menu = document.getElementById('customer-suggestions-menu');
    if (!list || !menu) return;

    currentFocusedCustomerIndex = -1;
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
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

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

            list.innerHTML = customers.map(customer => {
                customerMap[customer.id] = customer;
                const initials = getInitials(customer.name);
                let imgHtml = `<div class="emp-initials-avatar fs-6 fw-bold" style="width:34px;height:34px;background-color:#eff6ff;color:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;">${initials}</div>`;

                if (customer.imagePath && customer.imagePath.trim() !== '') {
                    const fullImgUrl = resolveImageUrl(customer.imagePath);
                    imgHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(customer.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 34px; height: 34px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\' style=\\'width:34px;height:34px;background-color:#eff6ff;color:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;\\'>${initials}</div>';">`;
                }

                const balance = Number(customer.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

                return `
                    <button type="button" 
                            class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 customer-suggestion-item" 
                            data-id="${customer.id}" 
                            data-name="${escapeHtml(customer.name)}">
                        <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                            ${imgHtml}
                            <div class="text-truncate">
                                <div class="fw-semibold text-dark text-truncate small mb-0 item-title">${escapeHtml(customer.name)}</div>
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

            list.querySelectorAll('.customer-suggestion-item').forEach(btn => {
                const handleSelection = (e) => {
                    e.preventDefault();
                    const customerId = btn.getAttribute('data-id');
                    selectCustomer(customerId);
                };
                btn.addEventListener('mousedown', handleSelection);
                btn.addEventListener('click', handleSelection);
            });

        } else {
            list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData.message) || 'Failed to load customers.'}</div>`;
        }

    } catch (err) {
        console.error('Error searching customers by name:', err);
        list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to customer API.</div>`;
    }
}

/**
 * Handles selecting a customer from suggestion list
 */
function selectCustomer(customerId) {
    const customer = customerMap[customerId];
    if (!customer) return;

    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const prevBalanceInput = document.getElementById('customer-previous-balance');
    const clearBtn = document.getElementById('btn-clear-customer');

    if (searchInput) {
        searchInput.value = customer.name;
        searchInput.setAttribute('data-selected-name', customer.name);
    }
    if (hiddenInput) {
        hiddenInput.value = customer.id;
    }
    if (prevBalanceInput) {
        prevBalanceInput.value = customer.currentBalance || 0;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    closeCustomerSuggestionsMenu();

    // Recalculate totals with the new previous balance
    calculateOverallTotals();
}

function clearCustomerSelection() {
    const searchInput = document.getElementById('customer-search-input');
    const hiddenInput = document.getElementById('customer-id');
    const prevBalanceInput = document.getElementById('customer-previous-balance');
    const clearBtn = document.getElementById('btn-clear-customer');

    if (searchInput) {
        searchInput.value = '';
        searchInput.removeAttribute('data-selected-name');
    }
    if (hiddenInput) {
        hiddenInput.value = '';
    }
    if (prevBalanceInput) {
        prevBalanceInput.value = '0';
    }
    if (clearBtn) clearBtn.classList.add('d-none');
    closeCustomerSuggestionsMenu();

    calculateOverallTotals();
}

/* ==========================================================================
   2. Order Items & Products Table
   GET https://localhost:7148/api/Products/GetByName/{name}
   ========================================================================== */

function initOrderItemsTable() {
    const btnAddTop = document.getElementById('btn-add-item');
    const btnAddBottom = document.getElementById('btn-add-item-bottom');

    if (btnAddTop) {
        btnAddTop.addEventListener('click', () => addItemRow());
    }
    if (btnAddBottom) {
        btnAddBottom.addEventListener('click', () => addItemRow());
    }

    // Global listener: prevent mouse wheel scrolling on Qty and Price number inputs
    document.addEventListener('wheel', (e) => {
        if (e.target && (e.target.classList.contains('item-quantity') || e.target.classList.contains('item-unit-price') || e.target.classList.contains('no-spinner'))) {
            e.preventDefault();
            if (document.activeElement === e.target) {
                e.target.blur();
            }
            window.scrollBy({
                top: e.deltaY,
                left: e.deltaX,
                behavior: 'auto'
            });
        }
    }, { passive: false });

    // Global listener: prevent ArrowUp and ArrowDown from stepping/scrolling numbers
    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.classList.contains('item-quantity') || e.target.classList.contains('item-unit-price') || e.target.classList.contains('no-spinner'))) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
            }
        }
    });

    // Add first initial row
    addItemRow();
}

/**
 * Appends a new item row to the table
 */
function addItemRow(initialData = null) {
    rowCounter++;
    const currentId = rowCounter;
    const tbody = document.getElementById('order-items-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.id = `item-row-${currentId}`;

    const defaultProductId = initialData ? initialData.productId : '';
    const defaultProductName = initialData ? initialData.productName : '';
    const defaultRemarks = initialData ? initialData.remarks : '';
    const defaultQty = initialData && initialData.quantity !== undefined ? initialData.quantity : 0;
    const defaultPrice = initialData && initialData.unitPrice !== undefined ? initialData.unitPrice : 0;
    const defaultTotal = (defaultQty * defaultPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    tr.innerHTML = `
        <td class="ps-4 fw-semibold text-secondary row-index-cell" style="width: 45px;">
            ${tbody.children.length + 1}
        </td>

        <!-- Product Search Combobox -->
        <td class="position-relative product-search-container" style="min-width: 260px; width: 32%;">
            <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-muted ps-2.5">
                    <i class="bi bi-box-seam"></i>
                </span>
                <input type="text" 
                       class="form-control bg-light border-start-0 ps-1 product-search-input" 
                       placeholder="Search product (e.g. 'hud')..." 
                       value="${escapeHtml(defaultProductName)}" 
                       ${defaultProductName ? `data-selected-name="${escapeHtml(defaultProductName)}"` : ''}
                       autocomplete="off" 
                       required>
                <input type="hidden" class="item-product-id" name="orderDetails[${currentId}].productId" value="${defaultProductId}">
                <button type="button" 
                        class="btn btn-light border border-start-0 text-muted btn-clear-product ${defaultProductId ? '' : 'd-none'}" 
                        title="Clear Product">
                    <i class="bi bi-x-circle-fill"></i>
                </button>
            </div>

            <!-- Autocomplete suggestions menu -->
            <div class="product-suggestions-menu position-absolute start-0 w-100 shadow-lg border border-secondary-subtle rounded-3 p-0 mt-1 overflow-auto bg-white d-none" 
                 style="max-height: 240px; z-index: 1060; top: 100%; min-width: 260px;">
                <div class="product-suggestions-list list-group list-group-flush small">
                    <!-- Populated dynamically -->
                </div>
            </div>
        </td>

        <!-- Remarks -->
        <td style="min-width: 200px; width: 25%;">
            <input type="text" 
                   class="form-control rounded-3 item-remarks" 
                   placeholder="Remarks / Specs" 
                   value="${escapeHtml(defaultRemarks)}"
                   name="orderDetails[${currentId}].remarks">
        </td>

        <!-- Quantity -->
        <td style="width: 120px;">
            <input type="number" 
                   class="form-control text-center rounded-3 item-quantity no-spinner" 
                   value="${defaultQty}" 
                   min="0" 
                   step="1" 
                   required>
        </td>

        <!-- Price -->
        <td style="width: 150px;">
            <div class="input-group">
                <span class="input-group-text bg-light text-muted small px-2">৳</span>
                <input type="number" 
                   class="form-control text-end rounded-end item-unit-price no-spinner" 
                   value="${defaultPrice}" 
                   min="0" 
                   step="0.01" 
                   placeholder="0.00" 
                   required>
            </div>
        </td>

        <!-- Total -->
        <td style="width: 160px;">
            <input type="text" class="form-control text-end fw-bold bg-light rounded-3 item-line-total" value="৳ ${defaultTotal}" readonly>
        </td>

        <!-- Action Delete Row -->
        <td class="pe-4 text-center" style="width: 50px;">
            <button type="button" 
                    class="btn btn-outline-danger btn-sm rounded-2 btn-remove-item" 
                    title="Remove Item">
                <i class="bi bi-trash-fill"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    // Initialize Autocomplete on the new row
    initRowProductAutocomplete(tr);

    // Bind Quantity, Price, and Remove event listeners
    const qtyInput = tr.querySelector('.item-quantity');
    const priceInput = tr.querySelector('.item-unit-price');
    const removeBtn = tr.querySelector('.btn-remove-item');

    // Prevent mouse wheel scrolling & Arrow keys on Qty and Price directly on the elements
    [qtyInput, priceInput].forEach(input => {
        if (!input) return;
        input.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (document.activeElement === input) {
                input.blur();
            }
            window.scrollBy({
                top: e.deltaY,
                left: e.deltaX,
                behavior: 'auto'
            });
        }, { passive: false });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
            }
        });
    });

    if (qtyInput) {
        qtyInput.addEventListener('input', () => calculateRowTotal(tr));
        qtyInput.addEventListener('change', () => calculateRowTotal(tr));
    }
    if (priceInput) {
        priceInput.addEventListener('input', () => calculateRowTotal(tr));
        priceInput.addEventListener('change', () => calculateRowTotal(tr));
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const allRows = tbody.querySelectorAll('.item-row');
            if (allRows.length <= 1) {
                // Keep at least one row, just clear its inputs
                const searchInp = tr.querySelector('.product-search-input');
                const hiddenInp = tr.querySelector('.item-product-id');
                const remarksInp = tr.querySelector('.item-remarks');
                const clearProductBtn = tr.querySelector('.btn-clear-product');

                if (searchInp) {
                    searchInp.value = '';
                    searchInp.removeAttribute('data-selected-name');
                }
                if (hiddenInp) hiddenInp.value = '';
                if (remarksInp) remarksInp.value = '';
                if (qtyInput) qtyInput.value = '0';
                if (priceInput) priceInput.value = '0';
                if (clearProductBtn) clearProductBtn.classList.add('d-none');

                calculateRowTotal(tr);
            } else {
                tr.remove();
                reindexRows();
                calculateOverallTotals();
            }
        });
    }

    reindexRows();
    calculateRowTotal(tr);
}

/**
 * Initializes product autocomplete for a given row element
 */
function initRowProductAutocomplete(tr) {
    const container = tr.querySelector('.product-search-container');
    const searchInput = tr.querySelector('.product-search-input');
    const hiddenInput = tr.querySelector('.item-product-id');
    const clearBtn = tr.querySelector('.btn-clear-product');
    const menu = tr.querySelector('.product-suggestions-menu');
    const list = tr.querySelector('.product-suggestions-list');
    const priceInput = tr.querySelector('.item-unit-price');

    if (!searchInput || !hiddenInput || !menu || !list || !container) return;

    let searchDebounceTimer = null;
    let focusedIndex = -1;

    function closeMenu() {
        menu.classList.add('d-none');
        menu.style.display = 'none';
        container.classList.remove('active-dropdown');
        focusedIndex = -1;
    }

    function openMenu() {
        menu.classList.remove('d-none');
        menu.style.display = 'block';
        container.classList.add('active-dropdown');
    }

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.product-suggestion-item');
        if (!items || items.length === 0 || menu.classList.contains('d-none')) {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex = (focusedIndex + 1) % items.length;
            updateFocus(items, focusedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex = (focusedIndex - 1 + items.length) % items.length;
            updateFocus(items, focusedIndex);
        } else if (e.key === 'Enter') {
            if (focusedIndex >= 0 && focusedIndex < items.length) {
                e.preventDefault();
                const sel = items[focusedIndex];
                applyProductSelection(
                    sel.getAttribute('data-id'),
                    sel.getAttribute('data-name'),
                    sel.getAttribute('data-price')
                );
            }
        } else if (e.key === 'Escape') {
            closeMenu();
        }
    });

    function updateFocus(items, idx) {
        items.forEach((item, i) => {
            const titleEl = item.querySelector('.item-title');
            if (i === idx) {
                item.classList.add('active', 'bg-primary', 'text-white');
                if (titleEl) titleEl.classList.add('text-white');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('active', 'bg-primary', 'text-white');
                if (titleEl) titleEl.classList.remove('text-white');
            }
        });
    }

    function applyProductSelection(prodId, prodName, prodPrice) {
        searchInput.value = prodName;
        searchInput.setAttribute('data-selected-name', prodName);
        hiddenInput.value = prodId;

        if (clearBtn) clearBtn.classList.remove('d-none');
        closeMenu();

        // If product has a unit price, set it
        if (prodPrice) {
            const parsedPrice = parseFloat(prodPrice);
            if (!isNaN(parsedPrice) && parsedPrice > 0 && (parseFloat(priceInput.value) === 0 || parseFloat(priceInput.value) === 100)) {
                priceInput.value = parsedPrice;
            }
        }

        calculateRowTotal(tr);
    }

    // Input event with 300ms debounce
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        focusedIndex = -1;

        if (hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            if (clearBtn) clearBtn.classList.add('d-none');
            calculateRowTotal(tr);
        }

        if (val.length < 2) {
            closeMenu();
            if (val.length === 0) {
                hiddenInput.value = '';
                if (clearBtn) clearBtn.classList.add('d-none');
                calculateRowTotal(tr);
            }
            return;
        }

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            queryProductsByName(val);
        }, 300);
    });

    // Clear button event
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.removeAttribute('data-selected-name');
            hiddenInput.value = '';
            clearBtn.classList.add('d-none');
            closeMenu();
            calculateRowTotal(tr);
            searchInput.focus();
        });
    }

    // Click outside closes menu
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeMenu();
        }
    });

    /**
     * Calls GET /api/Products/GetByName/{query}
     */
    async function queryProductsByName(nameQuery) {
        focusedIndex = -1;
        const token = getAuthToken();
        const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
        const endpoint = `${baseUrl}/Products/GetByName/${encodeURIComponent(nameQuery)}`;

        list.innerHTML = `
            <div class="p-3 text-center text-muted small">
                <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span> Searching products...
            </div>
        `;
        openMenu();

        try {
            console.log('Searching products from:', endpoint);
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
                const products = resData.data;

                if (products.length === 0) {
                    list.innerHTML = `
                        <div class="p-3 text-center text-muted small">
                            <i class="bi bi-info-circle me-1"></i> No products found for "<strong>${escapeHtml(nameQuery)}</strong>".
                        </div>
                    `;
                    return;
                }

                list.innerHTML = products.map(prod => {
                    const initials = getInitials(prod.name);
                    let imgHtml = `<div class="emp-initials-avatar fs-6 fw-bold" style="width:32px;height:32px;background-color:#eff6ff;color:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;">${initials}</div>`;

                    if (prod.imagePath && prod.imagePath.trim() !== '') {
                        const fullImgUrl = resolveImageUrl(prod.imagePath);
                        imgHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(prod.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 32px; height: 32px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\' style=\\'width:32px;height:32px;background-color:#eff6ff;color:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;\\'>${initials}</div>';">`;
                    }

                    const priceVal = prod.unitPrice || prod.price || '';

                    return `
                        <button type="button" 
                                class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 product-suggestion-item" 
                                data-id="${prod.id}" 
                                data-name="${escapeHtml(prod.name)}"
                                data-price="${priceVal}">
                            <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                                ${imgHtml}
                                <div class="text-truncate">
                                    <div class="fw-semibold text-dark text-truncate small mb-0 item-title">${escapeHtml(prod.name)}</div>
                                    <div class="text-muted small text-truncate item-subtitle" style="font-size: 0.72rem;">
                                        ID #${prod.id} ${prod.sku ? `• SKU: ${escapeHtml(prod.sku)}` : ''}
                                    </div>
                                </div>
                            </div>
                            <span class="badge bg-light text-secondary border flex-shrink-0">ID #${prod.id}</span>
                        </button>
                    `;
                }).join('');

                list.querySelectorAll('.product-suggestion-item').forEach(btn => {
                    const handleSelect = (e) => {
                        e.preventDefault();
                        const pId = btn.getAttribute('data-id');
                        const pName = btn.getAttribute('data-name');
                        const pPrice = btn.getAttribute('data-price');
                        applyProductSelection(pId, pName, pPrice);
                    };
                    btn.addEventListener('mousedown', handleSelect);
                    btn.addEventListener('click', handleSelect);
                });

            } else {
                list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData.message) || 'Failed to load products.'}</div>`;
            }

        } catch (err) {
            console.error('Error searching products by name:', err);
            list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to products API.</div>`;
        }
    }
}

/**
 * Re-numbers rows sequentially and updates item count badge
 */
function reindexRows() {
    const rows = document.querySelectorAll('#order-items-body .item-row');
    const badge = document.getElementById('items-count-text');

    rows.forEach((row, idx) => {
        const numEl = row.querySelector('.row-index-cell, .item-row-num');
        if (numEl) numEl.textContent = idx + 1;
    });

    if (badge) {
        badge.innerText = `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;
    }
}

/**
 * Calculates line total for a single row
 */
function calculateRowTotal(rowEl) {
    if (!rowEl) return;
    const qtyInput = rowEl.querySelector('.item-quantity');
    const priceInput = rowEl.querySelector('.item-unit-price');
    const totalEl = rowEl.querySelector('.item-line-total');

    const qty = parseFloat(qtyInput ? qtyInput.value : 0) || 0;
    const price = parseFloat(priceInput ? priceInput.value : 0) || 0;
    const lineTotal = qty * price;

    if (totalEl) {
        const formatted = `৳ ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (totalEl.tagName === 'INPUT') {
            totalEl.value = formatted;
        } else {
            totalEl.innerText = formatted;
        }
    }

    calculateOverallTotals();
}

/**
 * Calculates sum of all line totals, previous balance, and new balance
 */
function calculateOverallTotals() {
    const rows = document.querySelectorAll('#order-items-body .item-row');
    let orderTotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-quantity')?.value || 0) || 0;
        const price = parseFloat(row.querySelector('.item-unit-price')?.value || 0) || 0;
        orderTotal += (qty * price);
    });

    const prevBalanceVal = document.getElementById('customer-previous-balance')?.value || '0';
    const prevBalance = parseFloat(prevBalanceVal) || 0;
    const newBalance = prevBalance + orderTotal;

    const prevEl = document.getElementById('summary-prev-balance');
    const totalEl = document.getElementById('summary-order-total');
    const newEl = document.getElementById('summary-new-balance');

    if (prevEl) prevEl.innerText = `৳ ${formatCurrency(prevBalance)}`;
    if (totalEl) totalEl.innerText = `৳ ${formatCurrency(orderTotal)}`;
    if (newEl) newEl.innerText = `৳ ${formatCurrency(newBalance)}`;
}

/* ==========================================================================
   3. Form Submission & API Integration
   POST https://localhost:7148/api/CustomerOrders
   ========================================================================== */

function initCreateCOForm() {
    const form = document.getElementById('create-co-form');
    if (!form) return;

    let isSubmitting = false;
    const btnSubmit = document.getElementById('btn-submit-order');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnIcon = document.getElementById('btn-icon');
    const btnText = document.getElementById('btn-text');

    function resetSubmitButton() {
        isSubmitting = false;
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('disabled');
            btnSubmit.style.pointerEvents = '';
        }
        if (btnSpinner) btnSpinner.classList.add('d-none');
        if (btnIcon) btnIcon.classList.remove('d-none');
        if (btnText) btnText.textContent = 'Create Order';
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            if (isSubmitting || btnSubmit.disabled) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) {
            return;
        }

        const errorAlert = document.getElementById('create-error-alert');
        const successAlert = document.getElementById('create-success-alert');
        const successMsg = document.getElementById('create-success-message');

        if (errorAlert) errorAlert.classList.add('d-none');
        if (successAlert) successAlert.classList.add('d-none');

        // 1. Validate Customer
        const customerIdVal = document.getElementById('customer-id')?.value;
        const customerId = parseInt(customerIdVal, 10);
        if (!customerId || isNaN(customerId) || customerId <= 0) {
            resetSubmitButton();
            showFormError('Please search and select a valid customer from the dropdown.');
            document.getElementById('customer-search-input')?.focus();
            return;
        }

        // 2. Validate Order Date
        const orderDate = document.getElementById('order-date')?.value;
        if (!orderDate) {
            resetSubmitButton();
            showFormError('Please select a valid order date.');
            document.getElementById('order-date')?.focus();
            return;
        }

        // 3. Validate & Build Order Details
        const rows = document.querySelectorAll('#order-items-body .item-row');
        if (!rows || rows.length === 0) {
            resetSubmitButton();
            showFormError('Please add at least one product item to the order.');
            return;
        }

        const orderDetails = [];
        let totalAmount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const productIdInput = row.querySelector('.item-product-id');
            const searchInput = row.querySelector('.product-search-input');
            const remarksInput = row.querySelector('.item-remarks');
            const qtyInput = row.querySelector('.item-quantity');
            const priceInput = row.querySelector('.item-unit-price');

            const productId = parseInt(productIdInput ? productIdInput.value : '', 10);
            if (!productId || isNaN(productId) || productId <= 0) {
                resetSubmitButton();
                showFormError(`Please search and select a valid product for line #${i + 1}.`);
                if (searchInput) searchInput.focus();
                return;
            }

            const quantity = parseFloat(qtyInput.value) || 0;
            if (quantity <= 0) {
                resetSubmitButton();
                showFormError(`Please enter a quantity greater than zero for line #${i + 1}.`);
                qtyInput.focus();
                return;
            }

            const unitPrice = parseFloat(priceInput.value);
            if (isNaN(unitPrice) || unitPrice < 0) {
                resetSubmitButton();
                showFormError(`Please enter a valid unit price (≥ 0) for line #${i + 1}.`);
                priceInput.focus();
                return;
            }

            const lineTotal = parseFloat((quantity * unitPrice).toFixed(2));
            totalAmount += lineTotal;

            orderDetails.push({
                id: 0,
                customerOrderId: 0,
                productId: productId,
                remarks: remarksInput ? remarksInput.value.trim() : '',
                quantity: quantity,
                unitPrice: unitPrice,
                lineTotal: lineTotal
            });
        }

        const customerPreviousBalance = parseFloat(document.getElementById('customer-previous-balance')?.value) || 0;
        const totalAmountFinal = parseFloat(totalAmount.toFixed(2));
        const customerNewBalance = parseFloat((customerPreviousBalance + totalAmountFinal).toFixed(2));
        const notes = document.getElementById('order-notes')?.value.trim() || '';

        // Prepare JSON payload matching curl schema
        const payload = {
            id: 0,
            customerId: customerId,
            orderDate: orderDate.includes('T') ? orderDate : (orderDate + "T00:00:00"),
            totalAmount: totalAmountFinal,
            notes: notes,
            customerPreviousBalance: customerPreviousBalance,
            customerNewBalance: customerNewBalance,
            orderDetails: orderDetails
        };

        console.log('Submitting Customer Order payload:', payload);

        isSubmitting = true;
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.classList.add('disabled');
            btnSubmit.style.pointerEvents = 'none';
        }
        if (btnSpinner) btnSpinner.classList.remove('d-none');
        if (btnIcon) btnIcon.classList.add('d-none');
        if (btnText) btnText.textContent = 'Processing...';

        const token = getAuthToken();
        const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
        const endpoint = `${baseUrl}/CustomerOrders`;

        try {
            const headers = {
                'Content-Type': 'application/json',
                'accept': '*/*'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const resData = await response.json();
            console.log('Customer Order Create Response:', resData);

            if (response.ok && resData && (resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201)) {
                if (successMsg) successMsg.textContent = resData.message || 'Customer order created successfully!';
                if (successAlert) successAlert.classList.remove('d-none');
                if (btnText) btnText.textContent = 'Processing...';

                setTimeout(() => {
                    window.location.href = '/Order/CustomerOrders';
                }, 1000);
            } else {
                const message = (resData && resData.message) ? resData.message : `Failed to create customer order (Status ${response.status})`;
                showFormError(message);
                resetSubmitButton();
            }

        } catch (err) {
            console.error('Error submitting customer order:', err);
            showFormError(`Could not connect to API (${err.message}). Ensure backend server is running.`);
            resetSubmitButton();
        }
    });
}

function showFormError(msg) {
    const errorAlert = document.getElementById('create-error-alert');
    const errorMsg = document.getElementById('create-error-message');
    if (errorAlert && errorMsg) {
        errorMsg.textContent = msg;
        errorAlert.classList.remove('d-none');
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        alert(msg);
    }
}

