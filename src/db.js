const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'restaurant-menu.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function ensureDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tagline TEXT,
      description TEXT,
      logo_url TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      opening_hours TEXT,
      social_links TEXT,
      currency_code TEXT NOT NULL DEFAULT 'ETB',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_spicy INTEGER NOT NULL DEFAULT 0,
      is_vegetarian INTEGER NOT NULL DEFAULT 0,
      availability_note TEXT,
      available_from TEXT,
      available_to TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      previous_price REAL NOT NULL,
      new_price REAL NOT NULL,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      changed_by TEXT NOT NULL,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    );
  `);
}

function getRestaurant() {
  return db.prepare('SELECT * FROM restaurants ORDER BY id LIMIT 1').get();
}

function upsertRestaurant(payload) {
  const existing = getRestaurant();
  if (!existing) {
    db.prepare(`
      INSERT INTO restaurants (name, tagline, description, logo_url, phone, email, address, opening_hours, social_links, currency_code)
      VALUES (@name, @tagline, @description, @logo_url, @phone, @email, @address, @opening_hours, @social_links, @currency_code)
    `).run(payload);
    return;
  }

  db.prepare(`
    UPDATE restaurants
    SET name = @name,
        tagline = @tagline,
        description = @description,
        logo_url = @logo_url,
        phone = @phone,
        email = @email,
        address = @address,
        opening_hours = @opening_hours,
        social_links = @social_links,
        currency_code = @currency_code,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ ...payload, id: existing.id });
}

function listVisibleCategories() {
  return db.prepare('SELECT * FROM categories WHERE is_visible = 1 ORDER BY sort_order, name').all();
}

function listAdminCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
}

function listMenuItems({ includeHiddenCategories = false } = {}) {
  return db.prepare(`
    SELECT menu_items.*, categories.name AS category_name, categories.slug AS category_slug, categories.is_visible AS category_visible
    FROM menu_items
    JOIN categories ON categories.id = menu_items.category_id
    ${includeHiddenCategories ? '' : 'WHERE categories.is_visible = 1'}
    ORDER BY categories.sort_order, menu_items.sort_order, menu_items.name
  `).all();
}

function listFeaturedItems() {
  return db.prepare(`
    SELECT menu_items.*, categories.name AS category_name, categories.slug AS category_slug
    FROM menu_items
    JOIN categories ON categories.id = menu_items.category_id
    WHERE menu_items.is_featured = 1 AND categories.is_visible = 1
    ORDER BY menu_items.sort_order, menu_items.name
    LIMIT 6
  `).all();
}

function listPriceHistory() {
  return db.prepare(`
    SELECT price_history.*, menu_items.name AS item_name
    FROM price_history
    JOIN menu_items ON menu_items.id = price_history.menu_item_id
    ORDER BY changed_at DESC
    LIMIT 100
  `).all();
}

function createCategory({ name, slug, is_visible }) {
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM categories').get().nextOrder;
  const result = db.prepare(`
    INSERT INTO categories (name, slug, is_visible, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(name, slug, is_visible, sortOrder);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

function updateCategory(id, payload) {
  const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  db.prepare(`
    UPDATE categories
    SET name = ?,
        slug = ?,
        is_visible = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.name || current.name,
    payload.slug || current.slug,
    payload.is_visible === undefined ? current.is_visible : Number(payload.is_visible),
    payload.sort_order === undefined ? current.sort_order : Number(payload.sort_order),
    id
  );
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function createMenuItem(payload) {
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM menu_items').get().nextOrder;
  const result = db.prepare(`
    INSERT INTO menu_items (
      category_id, name, description, price, image_url, is_available, is_featured, is_spicy, is_vegetarian,
      availability_note, available_from, available_to, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.category_id,
    payload.name,
    payload.description || '',
    Number(payload.price),
    payload.image_url || '',
    payload.is_available === 'false' ? 0 : 1,
    payload.is_featured === 'true' ? 1 : 0,
    payload.is_spicy === 'true' ? 1 : 0,
    payload.is_vegetarian === 'true' ? 1 : 0,
    payload.availability_note || '',
    payload.available_from || '',
    payload.available_to || '',
    sortOrder
  );

  return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
}

function updateMenuItem(id, payload) {
  const current = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  const previousPrice = current.price;
  const newPrice = Number(payload.price);

  db.prepare(`
    UPDATE menu_items
    SET category_id = ?,
        name = ?,
        description = ?,
        price = ?,
        image_url = ?,
        is_available = ?,
        is_featured = ?,
        is_spicy = ?,
        is_vegetarian = ?,
        availability_note = ?,
        available_from = ?,
        available_to = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.category_id || current.category_id,
    payload.name || current.name,
    payload.description ?? current.description,
    Number.isNaN(newPrice) ? current.price : newPrice,
    payload.image_url || current.image_url,
    payload.is_available === undefined ? current.is_available : Number(payload.is_available === 'true' || payload.is_available === 1 || payload.is_available === '1'),
    payload.is_featured === undefined ? current.is_featured : Number(payload.is_featured === 'true' || payload.is_featured === 1 || payload.is_featured === '1'),
    payload.is_spicy === undefined ? current.is_spicy : Number(payload.is_spicy === 'true' || payload.is_spicy === 1 || payload.is_spicy === '1'),
    payload.is_vegetarian === undefined ? current.is_vegetarian : Number(payload.is_vegetarian === 'true' || payload.is_vegetarian === 1 || payload.is_vegetarian === '1'),
    payload.availability_note ?? current.availability_note,
    payload.available_from ?? current.available_from,
    payload.available_to ?? current.available_to,
    payload.sort_order === undefined ? current.sort_order : Number(payload.sort_order),
    id
  );

  if (!Number.isNaN(newPrice) && previousPrice !== newPrice) {
    db.prepare(`
      INSERT INTO price_history (menu_item_id, previous_price, new_price, changed_by)
      VALUES (?, ?, ?, ?)
    `).run(id, previousPrice, newPrice, payload.updated_by || 'Admin User');
  }

  return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
}

function deleteMenuItem(id) {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
}

function reorderItems(itemIds) {
  const update = db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index + 1, id));
  });
  transaction(itemIds);
}

function validateAdmin(email, password) {
  const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);
  if (!admin) return null;
  const valid = bcrypt.compareSync(password, admin.password_hash);
  return valid ? admin : null;
}

function getAdminById(id) {
  return db.prepare('SELECT id, full_name, email, role FROM admin_users WHERE id = ?').get(id);
}

function createDefaultData() {
  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get().count;
  if (!adminCount) {
    db.prepare(`
      INSERT INTO admin_users (full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Restaurant Owner', 'admin@restaurantmenu.local', bcrypt.hashSync('Admin@123', 10), 'owner');
  }

  if (!getRestaurant()) {
    upsertRestaurant({
      name: 'Restaurant Menu',
      tagline: 'Fresh flavors, warm hospitality.',
      description: 'A premium digital menu experience designed for fast browsing and a polished dine-in journey.',
      logo_url: '',
      phone: '+251 900 000 000',
      email: 'hello@restaurantmenu.local',
      address: 'Addis Ababa, Ethiopia',
      opening_hours: 'Mon - Sun: 7:00 AM - 11:00 PM',
      social_links: JSON.stringify({ instagram: '', facebook: '', tiktok: '' }),
      currency_code: 'ETB',
    });
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
  if (!categoryCount) {
    const categoryNames = [
      ['Breakfast', 'breakfast'],
      ['Appetizers', 'appetizers'],
      ['Main Courses', 'main-courses'],
      ['Traditional Foods', 'traditional-foods'],
      ['Pasta', 'pasta'],
      ['Pizza', 'pizza'],
      ['Burgers', 'burgers'],
      ['Sandwiches', 'sandwiches'],
      ['Seafood', 'seafood'],
      ['Vegetarian', 'vegetarian'],
      ['Desserts', 'desserts'],
      ['Hot Drinks', 'hot-drinks'],
      ['Cold Drinks', 'cold-drinks'],
      ['Fresh Juices', 'fresh-juices'],
      ['Cocktails/Mocktails', 'cocktails-mocktails'],
      ['Specials', 'specials'],
    ];

    const insert = db.prepare('INSERT INTO categories (name, slug, is_visible, sort_order) VALUES (?, ?, 1, ?)');
    categoryNames.forEach(([name, slug], index) => insert.run(name, slug, index + 1));
  }

  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
  if (!itemCount) {
    const categories = listAdminCategories();
    const categoryId = (slug) => categories.find((category) => category.slug === slug)?.id;
    const insert = db.prepare(`
      INSERT INTO menu_items (
        category_id, name, description, price, image_url, is_available, is_featured, is_spicy, is_vegetarian, availability_note, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedItems = [
      [categoryId('specials'), 'Chef’s Tibs Special', 'Sizzling beef tibs with peppers, rosemary, and house bread.', 890, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80', 1, 1, 1, 0, '', 1],
      [categoryId('breakfast'), 'Addis Sunrise Breakfast', 'Eggs, ful, toasted bread, fruit, and Ethiopian coffee.', 420, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80', 1, 1, 0, 1, '', 2],
      [categoryId('traditional-foods'), 'Doro Wat Deluxe', 'Slow-cooked chicken stew served with injera and ayib.', 760, 'https://images.unsplash.com/photo-1604908176997-4316f5b4b8aa?auto=format&fit=crop&w=900&q=80', 1, 1, 1, 0, '', 3],
      [categoryId('pizza'), 'Berbere Chicken Pizza', 'Wood-fired pizza with spiced chicken, mozzarella, and onions.', 680, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80', 1, 0, 1, 0, '', 4],
      [categoryId('burgers'), 'Signature Beef Burger', 'Juicy beef patty, cheddar, caramelized onions, and fries.', 610, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 1, 0, 0, 0, '', 5],
      [categoryId('fresh-juices'), 'Mango Passion Cooler', 'Fresh mango, passion fruit, mint, and crushed ice.', 240, 'https://images.unsplash.com/photo-1622597467836-f3e67035f810?auto=format&fit=crop&w=900&q=80', 1, 1, 0, 1, '', 6],
      [categoryId('desserts'), 'Honey Baklava Slice', 'Crisp pastry layers with nuts and fragrant honey syrup.', 280, 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=80', 0, 0, 0, 1, 'Currently Unavailable', 7]
    ];

    seedItems.forEach((item) => insert.run(...item));
  }
}

module.exports = {
  db,
  ensureDatabase,
  listVisibleCategories,
  listAdminCategories,
  listMenuItems,
  listFeaturedItems,
  listPriceHistory,
  upsertRestaurant,
  getRestaurant,
  createCategory,
  updateCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  validateAdmin,
  getAdminById,
  reorderItems,
  createDefaultData,
};
