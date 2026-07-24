# Restaurant Menu App

A modern digital restaurant menu web application with a customer-facing QR menu and admin dashboard.

## Features
- Mobile-first customer menu designed for QR-code access
- Responsive HTML, CSS, and JavaScript frontend
- Node.js + Express backend
- SQLite persistence using `better-sqlite3`
- Secure-ish session-based admin login for local/starter use
- Category management with hide/show support
- Menu item management with availability, featured, spicy, and vegetarian flags
- Price history tracking
- Local image upload support for restaurant logo and menu images
- ETB currency formatting throughout the application

## Default admin login
- Email: `admin@restaurantmenu.local`
- Password: `Admin@123`

Change this immediately for any real deployment.

## Tech stack
- Frontend: HTML5, CSS3, JavaScript (ES modules)
- Backend: Node.js, Express
- Database: SQLite

## Project structure
```text
restaurant-menu/
├── public/
│   ├── admin.html
│   ├── index.html
│   ├── css/
│   │   ├── admin.css
│   │   └── styles.css
│   └── js/
│       ├── admin.js
│       └── menu.js
├── scripts/
│   └── initDb.js
├── src/
│   └── db.js
├── uploads/
├── data/
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Run locally
1. Clone the repository:
   ```bash
   git clone https://github.com/mikomekanzi/restaurant-menu.git
   cd restaurant-menu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```

4. Initialize the database with starter data:
   ```bash
   npm run init-db
   ```

5. Start the app:
   ```bash
   npm run dev
   ```

6. Open in your browser:
   - Customer menu: `http://localhost:3000/`
   - Admin dashboard: `http://localhost:3000/admin`

## Notes
- The app stores SQLite data in `data/restaurant-menu.db`.
- Uploaded images are stored in the `uploads/` folder.
- Admin updates appear on the customer menu the next time the page is refreshed.
- This starter is structured so it can later be extended with ordering, multi-branch support, payments, localization, and customer accounts.

## Production hardening recommended
Before production, improve:
- stronger authentication and password reset flow
- CSRF protection
- secure cookies behind HTTPS
- input validation and sanitization
- image storage/CDN strategy
- rate limiting
- audit logging
- environment-specific configuration
