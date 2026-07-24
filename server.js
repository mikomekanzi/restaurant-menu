const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const {
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
} = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

ensureDatabase();
createDefaultData();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const admin = getAdminById(req.session.adminId);
  if (!admin) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Session expired.' });
  }

  req.admin = admin;
  next();
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/menu', (_req, res) => {
  const restaurant = getRestaurant();
  const categories = listVisibleCategories();
  const items = listMenuItems({ includeHiddenCategories: false });
  const featured = listFeaturedItems();

  res.json({
    restaurant,
    categories,
    featured,
    items,
    currency: 'ETB',
    updatedAt: new Date().toISOString(),
  });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const admin = validateAdmin(email, password);
  if (!admin) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  req.session.adminId = admin.id;
  res.json({
    message: 'Login successful.',
    admin: { id: admin.id, fullName: admin.full_name, email: admin.email },
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/admin/session', (req, res) => {
  if (!req.session.adminId) {
    return res.status(401).json({ authenticated: false });
  }

  const admin = getAdminById(req.session.adminId);
  if (!admin) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    admin: { id: admin.id, fullName: admin.full_name, email: admin.email },
  });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const restaurant = getRestaurant();
  const categories = listAdminCategories();
  const items = listMenuItems({ includeHiddenCategories: true });
  const priceHistory = listPriceHistory();

  res.json({ restaurant, categories, items, priceHistory, currency: 'ETB' });
});

app.put('/api/admin/restaurant', requireAdmin, upload.single('logo'), (req, res) => {
  const current = getRestaurant();
  const payload = {
    name: req.body.name || current?.name || 'Restaurant Menu',
    tagline: req.body.tagline || current?.tagline || '',
    description: req.body.description || current?.description || '',
    logo_url: req.file ? `/uploads/${req.file.filename}` : req.body.logo_url || current?.logo_url || '',
    phone: req.body.phone || current?.phone || '',
    email: req.body.email || current?.email || '',
    address: req.body.address || current?.address || '',
    opening_hours: req.body.opening_hours || current?.opening_hours || '',
    social_links: req.body.social_links || current?.social_links || '{}',
    currency_code: 'ETB',
  };

  upsertRestaurant(payload);
  res.json({ message: 'Restaurant information updated.', restaurant: getRestaurant() });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, slug, is_visible } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ message: 'Category name and slug are required.' });
  }

  const category = createCategory({
    name,
    slug,
    is_visible: is_visible === 'false' ? 0 : 1,
  });
  res.status(201).json({ message: 'Category created.', category });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const category = updateCategory(Number(req.params.id), req.body);
  res.json({ message: 'Category updated.', category });
});

app.post('/api/admin/items', requireAdmin, upload.single('image'), (req, res) => {
  const item = createMenuItem({
    ...req.body,
    category_id: Number(req.body.category_id),
    image_url: req.file ? `/uploads/${req.file.filename}` : req.body.image_url,
    created_by: req.admin.full_name,
  });

  res.status(201).json({ message: 'Menu item created.', item });
});

app.put('/api/admin/items/:id', requireAdmin, upload.single('image'), (req, res) => {
  const item = updateMenuItem(Number(req.params.id), {
    ...req.body,
    category_id: Number(req.body.category_id),
    image_url: req.file ? `/uploads/${req.file.filename}` : req.body.image_url,
    updated_by: req.admin.full_name,
  });

  res.json({ message: 'Menu item updated.', item });
});

app.delete('/api/admin/items/:id', requireAdmin, (req, res) => {
  deleteMenuItem(Number(req.params.id));
  res.json({ message: 'Menu item deleted.' });
});

app.put('/api/admin/items/reorder', requireAdmin, (req, res) => {
  reorderItems(req.body.itemIds || []);
  res.json({ message: 'Menu items reordered.' });
});

app.get('/api/admin/price-history', requireAdmin, (_req, res) => {
  res.json({ history: listPriceHistory() });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Restaurant menu app running on http://localhost:${PORT}`);
});
