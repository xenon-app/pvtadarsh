import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('restaurant.db');

export function initDb() {
  // Restaurants
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      radius_meters INTEGER DEFAULT 100
    );
  `);

  // Users (Staff)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'kitchen', 'billing')),
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied')),
      current_session_token TEXT,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Menu Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Menu Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      is_available BOOLEAN DEFAULT 1,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      table_id INTEGER,
      customer_nickname TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'paid')),
      total_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY(table_id) REFERENCES tables(id)
    );
  `);

  // Order Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      menu_item_id INTEGER,
      quantity INTEGER NOT NULL,
      price_at_time REAL NOT NULL,
      name_at_time TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
    );
  `);

  // Discounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      code TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Ensure name is updated if DB exists
  db.prepare("UPDATE restaurants SET name = 'Adarsh PVT.' WHERE id = 1").run();

  seedData();
}

function seedData() {
  const stmt = db.prepare('SELECT count(*) as count FROM restaurants');
  const result = stmt.get() as { count: number };

  if (result.count === 0) {
    console.log('Seeding data...');

    // 1. Create Restaurant
    const info = db.prepare('INSERT INTO restaurants (name, lat, lng) VALUES (?, ?, ?)').run('Adarsh PVT.', 12.9716, 77.5946);
    const restaurantId = info.lastInsertRowid;

    // 2. Create Users
    const password = bcrypt.hashSync('password', 10);
    const insertUser = db.prepare('INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)');
    insertUser.run(restaurantId, 'admin', password, 'admin');
    insertUser.run(restaurantId, 'kitchen', password, 'kitchen');
    insertUser.run(restaurantId, 'billing', password, 'billing');

    // 3. Create Tables
    const insertTable = db.prepare('INSERT INTO tables (restaurant_id, name) VALUES (?, ?)');
    insertTable.run(restaurantId, 'Jaguar');
    insertTable.run(restaurantId, 'Monkey');
    insertTable.run(restaurantId, 'Tiger');

    // 4. Create Categories & Menu Items
    const insertCategory = db.prepare('INSERT INTO categories (restaurant_id, name) VALUES (?, ?)');
    const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, price, description) VALUES (?, ?, ?, ?)');

    // Food Items
    const foodCat = insertCategory.run(restaurantId, 'Food Items').lastInsertRowid;
    const foodItems = [
      { name: 'Pav Bhaji', price: 120 },
      { name: 'Butter Pav Bhaji', price: 140 },
      { name: 'Masala Dosa', price: 110 },
      { name: 'Plain Dosa', price: 90 },
      { name: 'Mysore Dosa', price: 130 },
      { name: 'Cheese Dosa', price: 150 },
      { name: 'Idli (2 pcs)', price: 60 },
      { name: 'Medu Vada (2 pcs)', price: 70 },
      { name: 'Veg Sandwich', price: 80 },
      { name: 'Grilled Sandwich', price: 100 },
      { name: 'Chole Bhature', price: 140 },
      { name: 'Veg Fried Rice', price: 130 },
      { name: 'Veg Manchurian', price: 120 },
      { name: 'Paneer Butter Masala', price: 180 },
      { name: 'Butter Naan (2 pcs)', price: 60 },
    ];
    foodItems.forEach(item => insertItem.run(foodCat, item.name, item.price, 'Delicious ' + item.name));

    // Cold Drinks
    const coldCat = insertCategory.run(restaurantId, 'Cold Drinks').lastInsertRowid;
    const coldItems = [
      { name: 'Sprite (250ml)', price: 30 },
      { name: 'Sprite (500ml)', price: 50 },
      { name: 'Coca Cola (250ml)', price: 30 },
      { name: 'Coca Cola (500ml)', price: 50 },
      { name: 'Thums Up (250ml)', price: 30 },
      { name: 'Pepsi (500ml)', price: 50 },
      { name: 'Maaza (250ml)', price: 35 },
      { name: 'Frooti (250ml)', price: 35 },
      { name: 'Cold Coffee', price: 70 },
      { name: 'Chocolate Milk Shake', price: 90 },
    ];
    coldItems.forEach(item => insertItem.run(coldCat, item.name, item.price, 'Refreshing ' + item.name));

    // Hot Drinks / Fast Food
    const hotCat = insertCategory.run(restaurantId, 'Hot Drinks / Fast Food').lastInsertRowid;
    const hotItems = [
      { name: 'Tea', price: 20 },
      { name: 'Masala Tea', price: 25 },
      { name: 'Coffee', price: 30 },
      { name: 'Hot Chocolate', price: 60 },
      { name: 'Samosa', price: 20 },
      { name: 'Kachori', price: 25 },
      { name: 'Veg Puff', price: 30 },
      { name: 'French Fries', price: 80 },
      { name: 'Cheese Balls', price: 100 },
      { name: 'Veg Burger', price: 90 },
    ];
    hotItems.forEach(item => insertItem.run(hotCat, item.name, item.price, 'Tasty ' + item.name));

    console.log('Seeding complete.');
  }
}

export default db;
