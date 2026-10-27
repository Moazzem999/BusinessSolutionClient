/* ==========================================================================
   Business Solution Client - Create SO (Supplier Order) JavaScript
   Handles Supplier Autocomplete, Product Autocomplete per line item,
   Dynamic Line Items, Real-time Balances, and POST https://localhost:7148/api/SupplierOrders
   ========================================================================== */

let supplierSearchDebounceTimer = null;
let currentFocusedSuggestionIndex = -1;
let supplierMap = {};
let itemRowCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    initCreateSOPage();
});

/**
 * Initializes the Create SO page components
 */
function initCreateSOPage() {
    // 1. Set today's date in order date input
    const orderDateInput = document.getElementById('order-date');
    if (orderDateInput && !orderDateInput.value) {
        orderDateInput.value = new Date().toISOString().split('T')[0];
    }

    // 2. Initialize Supplier Combobox & Keyboard navigation
    initSupplierAutocomplete();

    // 3. Initialize Order Items table & add first row
    initOrderItemsTable();

    // 4. Initialize Form Submission
    initCreateSOForm();
}

/**
 * Returns API base URL from BSApp, window variable, or fallback
 */
function getApiBaseUrl() {
    if (typeof BSApp !== 'undefined' && typeof BSApp.getApiBaseUrl === 'function') {
        return BSApp.getApiBaseUrl();
    }
    if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL.replace(/\/+$/, '');
    }
    return 'https://localhost:7148/api';
}

/**
 * Returns stored auth token from BSApp, localStorage, or cookies
 */
function getAuthToken() {
    let token = '';
    if (typeof BSApp !== 'undefined' && typeof BSApp.getStoredToken === 'function') {
        token = BSApp.getStoredToken();
    }
    if (!token) {
        token = localStorage.getItem('bs_token') || '';
    }
    if (!token) {
        const match = document.cookie.match(/(?:^|;\s*)bs_auth_token=([^;]*)/);
        if (match) {
            token = decodeURIComponent(match[1]);
        }
    }
    return token;
}

/**
 * Resolves relative image paths to complete backend URLs
 */
function resolveImageUrl(path) {
    if (!path || typeof path !== 'string' || path.trim() === '') return '';
    path = path.trim();
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    const baseUrl = getApiBaseUrl();
    let host = '';
    try {
        const urlObj = new URL(baseUrl);
        host = urlObj.origin;
    } catch (e) {
        host = baseUrl.replace(/\/api\/?$/i, '');
    }
    return `${host}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Safely escapes HTML strings to prevent XSS
 */
function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Generates initials from a name (e.g., "Md Abdul Wadud" -> "MA")
 */
function getInitials(name) {
    if (!name || typeof name !== 'string') return 'PR';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ==========================================================================
   Supplier Combobox & Search Functionality
   ========================================================================== */

function initSupplierAutocomplete() {
    const searchInput = document.getElementById('supplier-search-input');
    const hiddenInput = document.getElementById('supplier-id');
    const clearBtn = document.getElementById('btn-clear-supplier');
    const menu = document.getElementById('supplier-suggestions-menu');
    const container = document.getElementById('supplier-search-container');

    if (!searchInput || !menu) return;

    // Handle Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        const list = document.getElementById('supplier-suggestions-list');
        if (!list) return;

        const items = list.querySelectorAll('.supplier-suggestion-item');
        if (!items || items.length === 0 || menu.classList.contains('d-none') || menu.style.display === 'none') {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocusedSuggestionIndex++;
            if (currentFocusedSuggestionIndex >= items.length) {
                currentFocusedSuggestionIndex = 0; // Wrap around to top
            }
            updateSupplierSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocusedSuggestionIndex--;
            if (currentFocusedSuggestionIndex < 0) {
                currentFocusedSuggestionIndex = items.length - 1; // Wrap around to bottom
            }
            updateSupplierSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (currentFocusedSuggestionIndex >= 0 && currentFocusedSuggestionIndex < items.length) {
                e.preventDefault();
                const selectedBtn = items[currentFocusedSuggestionIndex];
                const supplierId = selectedBtn.getAttribute('data-id');
                selectSupplier(supplierId);
            }
        } else if (e.key === 'Escape') {
            closeSupplierSuggestionsMenu();
        }
    });

    // Handle user typing
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        currentFocusedSuggestionIndex = -1;

        // If user changed input, reset hidden ID unless matches selected
        if (hiddenInput && hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            document.getElementById('supplier-previous-balance').value = '0';
            calculateOverallTotals();
            if (clearBtn) clearBtn.classList.add('d-none');
        }

        if (val.length < 3) {
            closeSupplierSuggestionsMenu();
            if (val.length === 0) {
                if (hiddenInput) hiddenInput.value = '';
                document.getElementById('supplier-previous-balance').value = '0';
                calculateOverallTotals();
                if (clearBtn) clearBtn.classList.add('d-none');
            }
            return;
        }

        clearTimeout(supplierSearchDebounceTimer);
        supplierSearchDebounceTimer = setTimeout(() => {
            searchSuppliersByName(val);
        }, 300);
    });

    // Handle Clear Button click
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearSupplierSelection();
            searchInput.focus();
        });
    }

    // Hide dropdown when clicking outside search container
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target)) {
            closeSupplierSuggestionsMenu();
        }
    });
}

function updateSupplierSuggestionFocus(items) {
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

function closeSupplierSuggestionsMenu() {
    const menu = document.getElementById('supplier-suggestions-menu');
    if (menu) {
        menu.classList.add('d-none');
        menu.style.display = 'none';
    }
    currentFocusedSuggestionIndex = -1;
}

/**
 * Calls API GET /api/Suppliers/GetByName/{name}
 */
async function searchSuppliersByName(nameQuery) {
    const list = document.getElementById('supplier-suggestions-list');
    const menu = document.getElementById('supplier-suggestions-menu');
    if (!list || !menu) return;

    currentFocusedSuggestionIndex = -1;
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const endpoint = `${baseUrl}/Suppliers/GetByName/${encodeURIComponent(nameQuery)}`;

    list.innerHTML = `
        <div class="p-3 text-center text-muted small">
            <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span> Searching suppliers...
        </div>
    `;
    menu.classList.remove('d-none');
    menu.style.display = 'block';

    try {
        console.log('Searching Suppliers from:', endpoint);
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
            const suppliers = resData.data;

            if (suppliers.length === 0) {
                list.innerHTML = `
                    <div class="p-3 text-center text-muted small">
                        <i class="bi bi-info-circle me-1"></i> No suppliers found for "<strong>${escapeHtml(nameQuery)}</strong>".
                    </div>
                `;
                return;
            }

            list.innerHTML = suppliers.map(supplier => {
                supplierMap[supplier.id] = supplier;
                const initials = getInitials(supplier.name);
                let imgHtml = `<div class="emp-initials-avatar fs-6 fw-bold" style="width:34px;height:34px;background-color:#eff6ff;color:#2563eb;">${initials}</div>`;

                if (supplier.imagePath && supplier.imagePath.trim() !== '') {
                    const fullImgUrl = resolveImageUrl(supplier.imagePath);
                    imgHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(supplier.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 34px; height: 34px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\' style=\\'width:34px;height:34px;background-color:#eff6ff;color:#2563eb;\\'>${initials}</div>';">`;
                }

                const balance = Number(supplier.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

                return `
                    <button type="button" 
                            class="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-2 rounded-2 border-0 supplier-suggestion-item" 
                            data-id="${supplier.id}" 
                            data-name="${escapeHtml(supplier.name)}">
                        <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                            ${imgHtml}
                            <div class="text-truncate">
                                <div class="fw-semibold text-dark text-truncate small mb-0 item-title">${escapeHtml(supplier.name)}</div>
                                <div class="text-muted small text-truncate item-subtitle" style="font-size: 0.75rem;">
                                    <i class="bi bi-shop me-1 text-secondary"></i>${escapeHtml(supplier.shopName || 'No Shop')}
                                    ${supplier.mobile ? `<span class="mx-1 text-muted">•</span><i class="bi bi-telephone me-1 text-secondary"></i>${escapeHtml(supplier.mobile)}` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="text-end flex-shrink-0">
                            <span class="badge bg-light text-primary border item-badge">৳ ${balance}</span>
                            <div class="text-muted small" style="font-size: 0.7rem;">ID #${supplier.id}</div>
                        </div>
                    </button>
                `;
            }).join('');

            list.querySelectorAll('.supplier-suggestion-item').forEach(btn => {
                const handleSelection = (e) => {
                    e.preventDefault();
                    const supplierId = btn.getAttribute('data-id');
                    selectSupplier(supplierId);
                };
                btn.addEventListener('mousedown', handleSelection);
                btn.addEventListener('click', handleSelection);
            });

        } else {
            list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData.message) || 'Failed to load suppliers.'}</div>`;
        }

    } catch (err) {
        console.error('Error searching suppliers by name:', err);
        list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to supplier API.</div>`;
    }
}

/**
 * Handles selecting a supplier from suggestion list
 */
function selectSupplier(supplierId) {
    const supplier = supplierMap[supplierId];
    if (!supplier) return;

    const searchInput = document.getElementById('supplier-search-input');
    const hiddenInput = document.getElementById('supplier-id');
    const prevBalanceInput = document.getElementById('supplier-previous-balance');
    const clearBtn = document.getElementById('btn-clear-supplier');

    if (searchInput) {
        searchInput.value = supplier.name;
        searchInput.setAttribute('data-selected-name', supplier.name);
    }
    if (hiddenInput) {
        hiddenInput.value = supplier.id;
    }
    if (prevBalanceInput) {
        prevBalanceInput.value = supplier.currentBalance || 0;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    closeSupplierSuggestionsMenu();

    // Recalculate totals with the new previous balance
    calculateOverallTotals();
}

function clearSupplierSelection() {
    const searchInput = document.getElementById('supplier-search-input');
    const hiddenInput = document.getElementById('supplier-id');
    const prevBalanceInput = document.getElementById('supplier-previous-balance');
    const clearBtn = document.getElementById('btn-clear-supplier');

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
    if (clearBtn) {
        clearBtn.classList.add('d-none');
    }

    closeSupplierSuggestionsMenu();
    calculateOverallTotals();
}

/* ==========================================================================
   Order Items & Dynamic Product Search Combobox
   GET https://localhost:7148/api/Products/GetByName/{name}
   ========================================================================== */

/**
 * Sets up Order Items table and buttons
 */
function initOrderItemsTable() {
    const btnAdd = document.getElementById('btn-add-item');
    const btnAddBottom = document.getElementById('btn-add-item-bottom');

    if (btnAdd) {
        btnAdd.addEventListener('click', () => addItemRow());
    }
    if (btnAddBottom) {
        btnAddBottom.addEventListener('click', () => addItemRow());
    }

    // Add first row by default
    addItemRow();
}

/**
 * Appends a new item row to the Order Items table with Product Searchbox
 */
function addItemRow(initialData = null) {
    const tbody = document.getElementById('order-items-body');
    if (!tbody) return;

    itemRowCounter++;
    const rowId = `item-row-${itemRowCounter}`;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'item-row';

    const defaultProductId = initialData ? initialData.productId : '';
    const defaultProductName = initialData ? initialData.productName : '';
    const defaultRemarks = initialData ? initialData.remarks : '';
    const defaultQty = initialData ? initialData.quantity : 0;
    const defaultPrice = initialData ? initialData.unitPrice : 0;
    const defaultTotal = (defaultQty * defaultPrice).toFixed(2);

    tr.innerHTML = `
        <td class="ps-4 fw-semibold text-secondary row-index-cell" style="width: 45px;">
            1
        </td>
        <td style="min-width: 260px; width: 32%;">
            <div class="position-relative product-search-container">
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
                    <input type="hidden" class="item-product-id" name="productId" value="${defaultProductId}">
                    <button type="button" 
                            class="btn btn-light border border-start-0 text-muted btn-clear-product ${defaultProductId ? '' : 'd-none'}" 
                            title="Clear Product">
                        <i class="bi bi-x-circle-fill"></i>
                    </button>
                </div>

                <!-- Product Autocomplete Suggestions Menu -->
                <div class="product-suggestions-menu position-absolute start-0 w-100 shadow-lg border border-secondary-subtle rounded-3 p-0 mt-1 overflow-auto bg-white d-none" 
                     style="max-height: 240px; z-index: 1060; top: 100%; min-width: 260px;">
                    <div class="list-group list-group-flush small product-suggestions-list">
                        <!-- Dynamic product items injected on typing -->
                    </div>
                </div>
            </div>
        </td>
        <td style="min-width: 200px; width: 25%;">
            <input type="text" class="form-control rounded-3 item-remarks" placeholder="Remarks / Specs" value="${escapeHtml(defaultRemarks)}">
        </td>
        <td style="width: 120px;">
            <input type="number" min="1" class="form-control text-center rounded-3 item-quantity no-spinner" value="${defaultQty}" required>
        </td>
        <td style="width: 150px;">
            <div class="input-group">
                <span class="input-group-text bg-light text-muted small px-2">৳</span>
                <input type="number" min="0" class="form-control text-end rounded-end item-unit-price no-spinner" value="${defaultPrice}" required>
            </div>
        </td>
        <td style="width: 160px;">
            <input type="text" class="form-control text-end fw-bold bg-light rounded-3 item-line-total" value="৳ ${defaultTotal}" readonly>
        </td>
        <td class="pe-4 text-center" style="width: 50px;">
            <button type="button" class="btn btn-outline-danger btn-sm rounded-2 btn-remove-item" title="Remove Item">
                <i class="bi bi-trash-fill"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    // Initialize Product Searchbox for this row
    initRowProductAutocomplete(tr);

    // Bind Quantity, Price, and Remove event listeners
    const qtyInput = tr.querySelector('.item-quantity');
    const priceInput = tr.querySelector('.item-unit-price');
    const removeBtn = tr.querySelector('.btn-remove-item');

    qtyInput.addEventListener('input', () => calculateRowTotal(tr));
    priceInput.addEventListener('input', () => calculateRowTotal(tr));

    removeBtn.addEventListener('click', () => {
        const rows = document.querySelectorAll('#order-items-body .item-row');
        if (rows.length > 1) {
            tr.remove();
            reindexRows();
            calculateOverallTotals();
        } else {
            // If only one row, reset it
            const searchInput = tr.querySelector('.product-search-input');
            const hiddenInput = tr.querySelector('.item-product-id');
            const clearBtn = tr.querySelector('.btn-clear-product');

            if (searchInput) {
                searchInput.value = '';
                searchInput.removeAttribute('data-selected-name');
            }
            if (hiddenInput) {
                hiddenInput.value = '';
            }
            if (clearBtn) {
                clearBtn.classList.add('d-none');
            }
            tr.querySelector('.item-remarks').value = '';
            qtyInput.value = '0';
            priceInput.value = '0';
            calculateRowTotal(tr);
        }
    });

    reindexRows();
    calculateRowTotal(tr);
}

/**
 * Initializes Product Searchable Combobox for a specific table row
 * Calls GET https://localhost:7148/api/Products/GetByName/{name}
 */
function initRowProductAutocomplete(tr) {
    const searchInput = tr.querySelector('.product-search-input');
    const hiddenInput = tr.querySelector('.item-product-id');
    const clearBtn = tr.querySelector('.btn-clear-product');
    const menu = tr.querySelector('.product-suggestions-menu');
    const list = tr.querySelector('.product-suggestions-list');
    const container = tr.querySelector('.product-search-container');
    const priceInput = tr.querySelector('.item-unit-price');

    if (!searchInput || !menu || !list || !container) return;

    let searchDebounceTimer = null;
    let focusedIndex = -1;

    function closeMenu() {
        menu.classList.add('d-none');
        menu.style.display = 'none';
        container.classList.remove('active-dropdown');
        tr.style.zIndex = '';
        focusedIndex = -1;
    }

    function openMenu() {
        menu.classList.remove('d-none');
        menu.style.display = 'block';
        container.classList.add('active-dropdown');
        tr.style.zIndex = '1060';
    }

    // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.product-suggestion-item');
        if (!items || items.length === 0 || menu.classList.contains('d-none') || menu.style.display === 'none') {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex++;
            if (focusedIndex >= items.length) focusedIndex = 0;
            updateFocus(items, focusedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex--;
            if (focusedIndex < 0) focusedIndex = items.length - 1;
            updateFocus(items, focusedIndex);
        } else if (e.key === 'Enter') {
            if (focusedIndex >= 0 && focusedIndex < items.length) {
                e.preventDefault();
                const selectedBtn = items[focusedIndex];
                const prodId = selectedBtn.getAttribute('data-id');
                const prodName = selectedBtn.getAttribute('data-name');
                const prodPrice = selectedBtn.getAttribute('data-price');
                applyProductSelection(prodId, prodName, prodPrice);
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
                item.classList.remove('bg-white');
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

        // If user changed input, reset hidden ID
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
            console.log('Product Search API Response:', resData);

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
                    let imgHtml = `<div class="emp-initials-avatar fs-6 fw-bold" style="width:32px;height:32px;background-color:#eff6ff;color:#2563eb;">${initials}</div>`;

                    if (prod.imagePath && prod.imagePath.trim() !== '') {
                        const fullImgUrl = resolveImageUrl(prod.imagePath);
                        imgHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(prod.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 32px; height: 32px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-6 fw-bold\\' style=\\'width:32px;height:32px;background-color:#eff6ff;color:#2563eb;\\'>${initials}</div>';">`;
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
                                        ${prod.details ? escapeHtml(prod.details) : `ID #${prod.id}`}
                                    </div>
                                </div>
                            </div>
                            <span class="badge bg-light text-secondary border flex-shrink-0">ID #${prod.id}</span>
                        </button>
                    `;
                }).join('');

                list.querySelectorAll('.product-suggestion-item').forEach(btn => {
                    const handleSelection = (e) => {
                        e.preventDefault();
                        const pId = btn.getAttribute('data-id');
                        const pName = btn.getAttribute('data-name');
                        const pPrice = btn.getAttribute('data-price');
                        applyProductSelection(pId, pName, pPrice);
                    };
                    btn.addEventListener('mousedown', handleSelection);
                    btn.addEventListener('click', handleSelection);
                });

            } else {
                list.innerHTML = `<div class="p-3 text-center text-muted small">${escapeHtml(resData.message) || 'Failed to load products.'}</div>`;
            }

        } catch (err) {
            console.error('Error searching products by name:', err);
            list.innerHTML = `<div class="p-3 text-center text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>Could not connect to product API.</div>`;
        }
    }
}

/**
 * Re-numbers row indices (1, 2, 3...) and updates count text
 */
function reindexRows() {
    const rows = document.querySelectorAll('#order-items-body .item-row');
    rows.forEach((row, index) => {
        const cell = row.querySelector('.row-index-cell');
        if (cell) cell.textContent = index + 1;
    });

    const itemsCountText = document.getElementById('items-count-text');
    if (itemsCountText) {
        itemsCountText.textContent = `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`;
    }
}

/**
 * Calculates a single row's line total: quantity * unitPrice
 */
function calculateRowTotal(rowEl) {
    const qty = parseFloat(rowEl.querySelector('.item-quantity').value) || 0;
    const price = parseFloat(rowEl.querySelector('.item-unit-price').value) || 0;
    const lineTotal = qty * price;

    const lineTotalInput = rowEl.querySelector('.item-line-total');
    if (lineTotalInput) {
        lineTotalInput.value = `৳ ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    calculateOverallTotals();
}

/**
 * Computes Order Total Amount and New Supplier Balance:
 * Order Total = sum(line totals)
 * New Balance = Previous Balance + Order Total
 */
function calculateOverallTotals() {
    let orderTotal = 0;
    const rows = document.querySelectorAll('#order-items-body .item-row');

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.item-unit-price').value) || 0;
        orderTotal += (qty * price);
    });

    const prevBalanceVal = parseFloat(document.getElementById('supplier-previous-balance')?.value) || 0;
    const newBalanceVal = prevBalanceVal + orderTotal;

    // Update Financial Summary elements
    const prevBalanceEl = document.getElementById('summary-prev-balance');
    const orderTotalEl = document.getElementById('summary-order-total');
    const newBalanceEl = document.getElementById('summary-new-balance');

    if (prevBalanceEl) {
        prevBalanceEl.textContent = `৳ ${prevBalanceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (orderTotalEl) {
        orderTotalEl.textContent = `৳ ${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (newBalanceEl) {
        newBalanceEl.textContent = `৳ ${newBalanceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

/* ==========================================================================
   Create SO Form Submission
   POST https://localhost:7148/api/SupplierOrders
   ========================================================================== */

function initCreateSOForm() {
    const form = document.getElementById('create-so-form');
    if (!form) return;

    let isSubmitting = false;
    const btnSubmit = document.getElementById('btn-submit-order');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnIcon = document.getElementById('btn-icon');
    const btnText = document.getElementById('btn-text');

    // Helper to reset button state only on validation or network/server failure
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

    // Direct click guard to prevent fast repeat clicks
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

        // Prevent multiple submissions if already processing
        if (isSubmitting) {
            return;
        }

        const errorAlert = document.getElementById('create-error-alert');
        const errorMsg = document.getElementById('create-error-message');
        const successAlert = document.getElementById('create-success-alert');
        const successMsg = document.getElementById('create-success-message');

        // Hide previous alerts
        if (errorAlert) errorAlert.classList.add('d-none');
        if (successAlert) successAlert.classList.add('d-none');

        // 1. Validate Supplier
        const supplierIdVal = document.getElementById('supplier-id')?.value;
        const supplierId = parseInt(supplierIdVal, 10);
        if (!supplierId || isNaN(supplierId) || supplierId <= 0) {
            resetSubmitButton();
            showFormError('Please search and select a valid supplier from the dropdown.');
            document.getElementById('supplier-search-input')?.focus();
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
                supplierOrderId: 0,
                productId: productId,
                remarks: remarksInput ? remarksInput.value.trim() : '',
                quantity: quantity,
                unitPrice: unitPrice,
                lineTotal: lineTotal
            });
        }

        const supplierPreviousBalance = parseFloat(document.getElementById('supplier-previous-balance')?.value) || 0;
        const totalAmountFinal = parseFloat(totalAmount.toFixed(2));
        const supplierNewBalance = parseFloat((supplierPreviousBalance + totalAmountFinal).toFixed(2));
        const notes = document.getElementById('order-notes')?.value.trim() || '';

        // Prepare JSON payload matching curl schema
        const payload = {
            id: 0,
            supplierId: supplierId,
            orderDate: orderDate,
            totalAmount: totalAmountFinal,
            notes: notes,
            supplierPreviousBalance: supplierPreviousBalance,
            supplierNewBalance: supplierNewBalance,
            orderDetails: orderDetails
        };

        console.log('Submitting Supplier Order payload:', payload);

        // Lock form submission and update UI to loading state immediately
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
        const endpoint = `${baseUrl}/SupplierOrders`;

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
            console.log('Supplier Order Create Response:', resData);

            if (response.ok && resData && (resData.succeeded === true || resData.statusCode === 200 || resData.statusCode === 201)) {
                if (successMsg) successMsg.textContent = resData.message || 'Supplier order created successfully!';
                if (successAlert) successAlert.classList.remove('d-none');
                if (btnText) btnText.textContent = 'Processing...';

                // Keep button disabled and isSubmitting = true permanently so user cannot submit again
                setTimeout(() => {
                    window.location.href = '/Order/SupplierOrders';
                }, 1000);
            } else {
                const message = (resData && resData.message) ? resData.message : `Failed to create supplier order (Status ${response.status})`;
                showFormError(message);
                resetSubmitButton();
            }

        } catch (err) {
            console.error('Error submitting supplier order:', err);
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
