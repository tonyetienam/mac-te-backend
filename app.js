const BASE_URL = 'https://mac-te-engineering.onrender.com';
let allProducts = [];
let user = JSON.parse(localStorage.getItem('user'));
let token = localStorage.getItem('token');

if (!user) { window.location.href = 'auth.html'; }

async function loadProducts() {
    try {
        const response = await fetch(`${BASE_URL}/api/products`);
        allProducts = await response.json();
        renderProducts(allProducts);
    } catch (error) { console.error(error); }
}

function renderProducts(data) {
    const grid = document.getElementById('products-grid');
    if (data.length === 0) { grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999;">No products listed.</div>'; return; }
    
    grid.innerHTML = data.map(prod => `
        <div class="product-card" onclick="viewProduct('${prod.id}')">
            ${prod.discounted ? `<div class="discount-badge">-${prod.percentage}%</div>` : ''}
            <div class="product-img"><img src="${prod.main_image || 'https://images.pexels.com/photos/280229/pexels-photo-280229.jpeg'}" alt="Product"></div>
            <div class="product-info">
                <h4>${prod.name}</h4>
                <div class="price">₦${Number(prod.price).toLocaleString()} ${prod.discounted ? `<span class="original-price">₦${Number(prod.original_price).toLocaleString()}</span>` : ''}</div>
                <button class="btn-buy" onclick="event.stopPropagation(); addToCart('${prod.id}')">Buy Now</button>
            </div>
        </div>
    `).join('');
}

function viewProduct(productId) {
    window.location.href = `product.html?id=${productId}`;
}

// ===== SMART SEARCH (FIXED: Only saves on button click or Enter) =====
let searchTimeout;
function onSearchInput() {
    // Debounce the search display
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(query));
        renderProducts(filtered);
        showSearchHistory();
    }, 300);
}

function doSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    if (query.length > 0) {
        saveSearchHistory(query);
    }
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(query));
    renderProducts(filtered);
    document.getElementById('searchHistory').style.display = 'none';
}

function saveSearchHistory(query) {
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    // Remove duplicates and only save distinct searches
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 8))); // Save last 8
}

function showSearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
    const historyDiv = document.getElementById('searchHistory');
    if (history.length === 0) {
        historyDiv.style.display = 'none';
        return;
    }
    historyDiv.style.display = 'block';
    historyDiv.innerHTML = history.map(query => `<div onclick="useSearchHistory('${query}')">${query}</div>`).join('');
}

function useSearchHistory(query) {
    document.getElementById('searchInput').value = query;
    document.getElementById('searchHistory').style.display = 'none';
    doSearch();
}

// Close search history on outside click
document.addEventListener('click', function(event) {
    if (!event.target.closest('.search-box')) {
        document.getElementById('searchHistory').style.display = 'none';
    }
});

// ===== CATEGORY FILTERS (FIXED: Checks category field) =====
function filterCategory(cat) {
    if (cat === 'All') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === cat);
        if (filtered.length > 0) {
            renderProducts(filtered);
        } else {
            // If no exact match, try keyword matching
            const keywordFiltered = allProducts.filter(p => p.name.toLowerCase().includes(cat.toLowerCase()) || (p.category && p.category.toLowerCase().includes(cat.toLowerCase())));
            renderProducts(keywordFiltered.length > 0 ? keywordFiltered : allProducts);
        }
    }
}

function scrollToProducts() { document.getElementById('products-grid').scrollIntoView({ behavior: 'smooth' }); }

async function addToCart(productId) {
    try {
        const response = await fetch(`${BASE_URL}/api/cart/add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, product_id: productId, quantity: 1 })
        });
        const data = await response.json();
        if (data.message) { alert(`✅ ${data.message}`); loadCartCount(); }
        else { alert('❌ Failed.'); }
    } catch (error) { alert('❌ Network error.'); }
}

async function loadCartCount() {
    try {
        const response = await fetch(`${BASE_URL}/api/cart/${user.id}`);
        const items = await response.json();
        document.getElementById('cart-count').innerText = items.length;
    } catch (error) { console.error(error); }
}

function toggleDropdown(element) {
    const dropdownContent = element.parentElement.querySelector('.dropdown-content');
    const isVisible = dropdownContent.classList.contains('show');
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    if (!isVisible) dropdownContent.classList.add('show');
}

document.addEventListener('click', function(event) {
    if (!event.target.closest('.account-dropdown') && !event.target.closest('.help-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'auth.html';
}

loadProducts();
loadCartCount();