const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutButton = document.getElementById('logout-button');
const restaurantForm = document.getElementById('restaurant-form');
const categoryForm = document.getElementById('category-form');
const itemForm = document.getElementById('item-form');
const categoryList = document.getElementById('category-list');
const itemList = document.getElementById('item-list');
const historyList = document.getElementById('history-list');
const categorySelect = document.getElementById('item-category-select');

let dashboardData = null;

function toFormData(form) {
  const formData = new FormData();
  Array.from(form.elements).forEach((field) => {
    if (!field.name) return;
    if (field.type === 'file') {
      if (field.files?.[0]) formData.append(field.name, field.files[0]);
      return;
    }
    if (field.type === 'checkbox') {
      formData.append(field.name, field.checked ? 'true' : 'false');
      return;
    }
    formData.append(field.name, field.value);
  });
  return formData;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function renderCategories(categories) {
  categorySelect.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join('');

  categoryList.innerHTML = categories
    .map(
      (category) => `
        <div class="list-item">
          <div class="list-item__row">
            <div>
              <strong>${category.name}</strong>
              <p>${category.slug} · ${category.is_visible ? 'Visible' : 'Hidden'}</p>
            </div>
            <div class="inline-actions">
              <button data-action="toggle-category" data-id="${category.id}" data-visible="${category.is_visible}">
                ${category.is_visible ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderItems(items) {
  itemList.innerHTML = items
    .map(
      (item) => `
        <div class="list-item">
          <div class="list-item__row">
            <div>
              <strong>${item.name}</strong>
              <p>${item.category_name} · ETB ${Number(item.price).toFixed(2)}</p>
              <p>${item.is_available ? 'Available' : item.availability_note || 'Currently Unavailable'}</p>
            </div>
            <div class="inline-actions">
              <button data-action="toggle-item" data-id="${item.id}" data-available="${item.is_available}">
                ${item.is_available ? 'Mark unavailable' : 'Mark available'}
              </button>
              <button data-action="feature-item" data-id="${item.id}" data-featured="${item.is_featured}">
                ${item.is_featured ? 'Remove featured' : 'Make featured'}
              </button>
              <button data-action="delete-item" data-id="${item.id}">Delete</button>
            </div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderHistory(history) {
  historyList.innerHTML = history.length
    ? history
        .map(
          (entry) => `
            <div class="list-item">
              <strong>${entry.item_name}</strong>
              <p>ETB ${Number(entry.previous_price).toFixed(2)} → ETB ${Number(entry.new_price).toFixed(2)}</p>
              <p>${entry.changed_by} · ${new Date(entry.changed_at).toLocaleString()}</p>
            </div>
          `
        )
        .join('')
    : '<p>No price changes recorded yet.</p>';
}

function populateRestaurantForm(restaurant) {
  restaurantForm.name.value = restaurant?.name || '';
  restaurantForm.tagline.value = restaurant?.tagline || '';
  restaurantForm.description.value = restaurant?.description || '';
  restaurantForm.phone.value = restaurant?.phone || '';
  restaurantForm.email.value = restaurant?.email || '';
  restaurantForm.address.value = restaurant?.address || '';
  restaurantForm.opening_hours.value = restaurant?.opening_hours || '';
}

async function loadDashboard() {
  const data = await fetchJson('/api/admin/dashboard');
  dashboardData = data;
  populateRestaurantForm(data.restaurant);
  renderCategories(data.categories || []);
  renderItems(data.items || []);
  renderHistory(data.priceHistory || []);
}

async function checkSession() {
  try {
    await fetchJson('/api/admin/session');
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    await loadDashboard();
  } catch {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = '';
  const payload = {
    email: loginForm.email.value,
    password: loginForm.password.value,
  };

  try {
    await fetchJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    await loadDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

logoutButton.addEventListener('click', async () => {
  await fetchJson('/api/admin/logout', { method: 'POST' });
  location.reload();
});

restaurantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await fetchJson('/api/admin/restaurant', {
    method: 'PUT',
    body: toFormData(restaurantForm),
  });
  await loadDashboard();
  alert('Restaurant information updated.');
});

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await fetchJson('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: categoryForm.name.value,
      slug: categoryForm.slug.value,
      is_visible: categoryForm.is_visible.checked,
    }),
  });
  categoryForm.reset();
  categoryForm.is_visible.checked = true;
  await loadDashboard();
});

itemForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await fetchJson('/api/admin/items', {
    method: 'POST',
    body: toFormData(itemForm),
  });
  itemForm.reset();
  itemForm.is_available.checked = true;
  await loadDashboard();
});

categoryList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="toggle-category"]');
  if (!button) return;

  const id = button.dataset.id;
  const currentVisible = button.dataset.visible === '1';
  await fetchJson(`/api/admin/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_visible: !currentVisible }),
  });
  await loadDashboard();
});

itemList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'delete-item') {
    const confirmed = window.confirm('Delete this menu item?');
    if (!confirmed) return;
    await fetchJson(`/api/admin/items/${id}`, { method: 'DELETE' });
  }

  if (action === 'toggle-item') {
    const item = dashboardData.items.find((entry) => String(entry.id) === String(id));
    await fetchJson(`/api/admin/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        is_available: item.is_available ? 0 : 1,
        availability_note: item.is_available ? 'Currently Unavailable' : '',
      }),
    });
  }

  if (action === 'feature-item') {
    const item = dashboardData.items.find((entry) => String(entry.id) === String(id));
    await fetchJson(`/api/admin/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        is_featured: item.is_featured ? 0 : 1,
      }),
    });
  }

  await loadDashboard();
});

checkSession();
