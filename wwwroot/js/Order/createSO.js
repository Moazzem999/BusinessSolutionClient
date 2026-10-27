/* ==========================================================================
   Business Solution Client - Create SO (Sales Order) JavaScript
   Supplier Search Combobox with Autocomplete & Keyboard Navigation
   ========================================================================== */

let supplierSearchDebounceTimer = null;
let currentFocusedSuggestionIndex = -1;
let supplierMap = {};

document.addEventListener('DOMContentLoaded', () => {
    initCreateSOPage();
});

function initCreateSOPage() {
    initSupplierAutocomplete();
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
    if (!name || typeof name !== 'string') return 'SP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Initializes Supplier Searchable Combobox (min 3 chars trigger + keyboard navigation)
 */
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
            updateSuggestionFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocusedSuggestionIndex--;
            if (currentFocusedSuggestionIndex < 0) {
                currentFocusedSuggestionIndex = items.length - 1; // Wrap around to bottom
            }
            updateSuggestionFocus(items);
        } else if (e.key === 'Enter') {
            if (currentFocusedSuggestionIndex >= 0 && currentFocusedSuggestionIndex < items.length) {
                e.preventDefault(); // Prevent accidental form submit
                const selectedBtn = items[currentFocusedSuggestionIndex];
                const supplierId = selectedBtn.getAttribute('data-id');
                selectSupplier(supplierId);
            }
        } else if (e.key === 'Escape') {
            closeSuggestionsMenu();
        }
    });

    // Handle user typing
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        currentFocusedSuggestionIndex = -1;

        // If user changed input, reset hidden ID unless matches selected
        if (hiddenInput && hiddenInput.value && val !== searchInput.getAttribute('data-selected-name')) {
            hiddenInput.value = '';
            hideSelectedSupplierCard();
            if (clearBtn) clearBtn.classList.add('d-none');
        }

        if (val.length < 3) {
            closeSuggestionsMenu();
            if (val.length === 0) {
                if (hiddenInput) hiddenInput.value = '';
                hideSelectedSupplierCard();
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
            closeSuggestionsMenu();
        }
    });
}

/**
 * Updates visual highlight & scrolling for keyboard navigation
 */
function updateSuggestionFocus(items) {
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

/**
 * Closes the autocomplete suggestions dropdown menu
 */
function closeSuggestionsMenu() {
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
        console.log('Suppliers GetByName API Response:', resData);

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

            // Bind click & mousedown events to suggestion items
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
    const clearBtn = document.getElementById('btn-clear-supplier');

    if (searchInput) {
        searchInput.value = supplier.name;
        searchInput.setAttribute('data-selected-name', supplier.name);
    }
    if (hiddenInput) {
        hiddenInput.value = supplier.id;
    }

    if (clearBtn) clearBtn.classList.remove('d-none');
    closeSuggestionsMenu();

    // Render the Selected Supplier summary card
    renderSelectedSupplierCard(supplier);
}

/**
 * Displays the selected supplier's full details card
 */
function renderSelectedSupplierCard(supplier) {
    const cardContainer = document.getElementById('selected-supplier-card');
    if (!cardContainer) return;

    const initials = getInitials(supplier.name);
    let avatarHtml = `<div class="emp-initials-avatar fs-4 fw-bold" style="width: 52px; height: 52px; background-color: #dbeafe; color: #1e40af;">${initials}</div>`;

    if (supplier.imagePath && supplier.imagePath.trim() !== '') {
        const fullImgUrl = resolveImageUrl(supplier.imagePath);
        avatarHtml = `<img src="${fullImgUrl}" alt="${escapeHtml(supplier.name)}" class="rounded-circle object-fit-cover shadow-sm" style="width: 52px; height: 52px;" onerror="this.onerror=null; this.outerHTML='<div class=\\'emp-initials-avatar fs-4 fw-bold\\' style=\\'width:52px;height:52px;background-color:#dbeafe;color:#1e40af;\\'>${initials}</div>';">`;
    }

    const balance = Number(supplier.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const address = supplier.presentAddress || supplier.permanentAddress || 'Address not specified';

    cardContainer.innerHTML = `
        <div class="card border border-primary-subtle shadow-sm rounded-4 overflow-hidden" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);">
            <div class="card-body p-3 p-md-4">
                <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
                    <div class="d-flex align-items-center gap-3">
                        ${avatarHtml}
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <h6 class="fw-bold text-dark mb-0 fs-5">${escapeHtml(supplier.name)}</h6>
                                <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 small">
                                    <i class="bi bi-check-circle-fill me-1"></i>Selected
                                </span>
                                <span class="badge bg-light text-secondary border rounded-pill px-2 py-1 small">ID #${supplier.id}</span>
                            </div>
                            <div class="text-muted small d-flex align-items-center gap-3 flex-wrap">
                                <span><i class="bi bi-shop text-primary me-1"></i><strong>${escapeHtml(supplier.shopName || '—')}</strong></span>
                                ${supplier.mobile ? `<span><i class="bi bi-telephone text-primary me-1"></i>${escapeHtml(supplier.mobile)}</span>` : ''}
                                ${supplier.email ? `<span><i class="bi bi-envelope text-primary me-1"></i>${escapeHtml(supplier.email)}</span>` : ''}
                            </div>
                            <div class="text-muted small mt-1">
                                <i class="bi bi-geo-alt text-secondary me-1"></i>${escapeHtml(address)}
                            </div>
                        </div>
                    </div>
                    <div class="d-flex flex-row flex-md-column align-items-end justify-content-between w-100 w-md-auto gap-2 border-top border-md-top-0 pt-2 pt-md-0">
                        <div class="text-start text-md-end">
                            <div class="text-muted small fw-medium">Current Balance</div>
                            <div class="fs-5 fw-bold text-primary">৳ ${balance}</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-3 px-3 py-1 fw-medium d-inline-flex align-items-center gap-1 shadow-sm" onclick="clearSupplierSelection()">
                            <i class="bi bi-x-circle"></i>
                            <span>Change</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    cardContainer.classList.remove('d-none');
}

/**
 * Hides and empties the selected supplier details card
 */
function hideSelectedSupplierCard() {
    const cardContainer = document.getElementById('selected-supplier-card');
    if (cardContainer) {
        cardContainer.innerHTML = '';
        cardContainer.classList.add('d-none');
    }
}

/**
 * Clears the supplier selection completely
 */
function clearSupplierSelection() {
    const searchInput = document.getElementById('supplier-search-input');
    const hiddenInput = document.getElementById('supplier-id');
    const clearBtn = document.getElementById('btn-clear-supplier');

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

    closeSuggestionsMenu();
    hideSelectedSupplierCard();
}
