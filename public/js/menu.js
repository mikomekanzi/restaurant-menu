const state = {
  items: [],
  categories: [],
  featured: [],
  activeCategory: 'all',
  search: '',
};

const restaurantName = document.getElementById('restaurant-name');
const restaurantTagline = document.getElementById('restaurant-tagline');
const restaurantHours = document.getElementById('restaurant-hours');
const restaurantPhone = document.getElementById('restaurant-phone');
const restaurantDescription = document.getElementById('restaurant-description');
const restaurantAddress = document.getElementById('restaurant-address');
const restaurantEmail = document.getElementById('restaurant-email');
const featuredGrid = document.getElementById('featured-grid');
const categoryFilters = document.getElementById('category-filters');
const menuGrid = document.getElementById('menu-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

function formatPrice(price) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 2,
  }).format(price);
}

function createCard(item) {
  const article = document.createElement('article');
  article.className = `menu-card ${item.is_available ? '' : 'menu-card--unavailable'}`;
  article.innerHTML = `
    <div class="menu-card__media">
      <img src="${item.image_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'}" alt="${item.name}" loading="lazy" />
      <div class="badge-row">
        ${item.is_featured ? '<span class="badge badge--accent">Featured</span>' : ''}
        ${item.is_spicy ? '<span class="badge">🌶️ Spicy</span>' : ''}
        ${item.is_vegetarian ? '<span class="badge">🥬 Vegetarian</span>' : ''}
      </div>
    </div>
    <div class="menu-card__content">
      <div class="menu-card__top">
        <div>
          <h3>${item.name}</h3>
          <p class="menu-card__description">${item.description || ''}</p>
        </div>
        <span class="menu-card__price">${formatPrice(item.price)}</span>
      </div>
      <div class="menu-card__meta">
        <span>${item.category_name}</span>
        <span class="status-pill ${item.is_available ? '' : 'status-pill--muted'}">
          ${item.is_available ? 'Available' : item.availability_note || 'Currently Unavailable'}
        </span>
      </div>
    </div>
  `;
  return article;
}

function renderFeatured() {
  featuredGrid.innerHTML = '';
  state.featured.forEach((item) => featuredGrid.appendChild(createCard(item)));
}

function renderFilters() {
  const filters = [{ slug: 'all', name: 'All' }, ...state.categories];
  categoryFilters.innerHTML = '';

  filters.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-chip ${state.activeCategory === category.slug ? 'active' : ''}`;
    button.textContent = category.name;
    button.addEventListener('click', () => {
      state.activeCategory = category.slug;
      renderFilters();
      renderMenu();
    });
    categoryFilters.appendChild(button);
  });
}

function renderMenu() {
  const search = state.search.trim().toLowerCase();
  const filtered = state.items.filter((item) => {
    const matchesCategory = state.activeCategory === 'all' || item.category_slug === state.activeCategory;
    const haystack = `${item.name} ${item.description} ${item.category_name}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesCategory && matchesSearch;
  });

  menuGrid.innerHTML = '';
  filtered.forEach((item) => menuGrid.appendChild(createCard(item)));
  emptyState.classList.toggle('hidden', filtered.length > 0);
}

async function loadMenu() {
  const response = await fetch('/api/menu');
  const data = await response.json();

  restaurantName.textContent = data.restaurant?.name || 'Restaurant Menu';
  restaurantTagline.textContent = data.restaurant?.tagline || '';
  restaurantHours.textContent = data.restaurant?.opening_hours || '';
  restaurantPhone.textContent = data.restaurant?.phone || '';
  restaurantDescription.textContent = data.restaurant?.description || '';
  restaurantAddress.textContent = data.restaurant?.address || '';
  restaurantEmail.textContent = data.restaurant?.email || '';

  state.items = data.items || [];
  state.categories = data.categories || [];
  state.featured = data.featured || [];

  renderFeatured();
  renderFilters();
  renderMenu();
}

searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderMenu();
});

loadMenu().catch((error) => {
  console.error(error);
  menuGrid.innerHTML = '<p>Unable to load the menu right now.</p>';
});
