import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from './server/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = 'super-secret-key-change-in-prod';

async function startServer() {
  initDb();

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, role: user.role, restaurant_id: user.restaurant_id });
  });

  // Public: Get Restaurant & Table Info
  app.get('/api/public/table/:tableId', (req, res) => {
    const { tableId } = req.params;
    const table = db.prepare('SELECT t.*, r.name as restaurant_name, r.lat, r.lng, r.radius_meters FROM tables t JOIN restaurants r ON t.restaurant_id = r.id WHERE t.id = ?').get(tableId) as any;
    
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  });

  // Public: Get Menu
  app.get('/api/public/menu/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    const categories = db.prepare('SELECT * FROM categories WHERE restaurant_id = ?').all(restaurantId) as any[];
    
    const menu = categories.map(cat => {
      const items = db.prepare('SELECT * FROM menu_items WHERE category_id = ? AND is_available = 1').all(cat.id);
      return { ...cat, items };
    });
    
    res.json(menu);
  });

  // Public: Create Order
  app.post('/api/public/order', (req, res) => {
    try {
      const { restaurantId, tableId, customerNickname, items } = req.body; // items: [{ id, quantity, price, name }]

      if (!restaurantId || !tableId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

      // Use transaction for atomicity
      const createOrder = db.transaction(() => {
        const insertOrder = db.prepare('INSERT INTO orders (restaurant_id, table_id, customer_nickname, total_amount, status) VALUES (?, ?, ?, ?, ?)');
        const info = insertOrder.run(restaurantId, tableId, customerNickname, totalAmount, 'pending');
        const orderId = info.lastInsertRowid;

        const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time, name_at_time) VALUES (?, ?, ?, ?, ?)');
        items.forEach((item: any) => {
          insertItem.run(orderId, item.id, item.quantity, item.price, item.name);
        });

        // Update table status
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId);
        
        return orderId;
      });

      const orderId = createOrder();

      // Fetch full order for socket
      const fullOrder = getOrderById(orderId);

      io.to(`restaurant_${restaurantId}`).emit('new_order', fullOrder);
      
      res.json({ success: true, orderId });
    } catch (err: any) {
      console.error('Order creation failed:', err);
      res.status(500).json({ error: err.message || 'Failed to create order' });
    }
  });

  // Staff: Get Orders
  app.get('/api/staff/orders', authenticateToken, (req: any, res) => {
    const orders = db.prepare(`
      SELECT o.*, t.name as table_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.restaurant_id = ? AND o.status != 'paid'
      ORDER BY o.created_at DESC
    `).all(req.user.restaurant_id) as any[];

    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  });

  // Staff: Update Order Status
  app.post('/api/staff/order/status', authenticateToken, (req: any, res) => {
    const { orderId, status } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    
    const updatedOrder = getOrderById(orderId);
    io.to(`restaurant_${req.user.restaurant_id}`).emit('order_updated', updatedOrder);
    
    res.json({ success: true });
  });

  // Staff: Close Table Session (Mark Paid)
  app.post('/api/staff/order/pay', authenticateToken, (req: any, res) => {
    const { orderId } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    
    if (order) {
      db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
      db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);
      
      io.to(`restaurant_${req.user.restaurant_id}`).emit('order_paid', { orderId, tableId: order.table_id });
    }
    
    res.json({ success: true });
  });

  // Staff: Get Tables
  app.get('/api/staff/tables', authenticateToken, (req: any, res) => {
    const tables = db.prepare('SELECT * FROM tables WHERE restaurant_id = ?').all(req.user.restaurant_id);
    res.json(tables);
  });

  // Admin: Get Menu Items
  app.get('/api/admin/menu', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    
    const itemsCorrect = db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM menu_items m 
      JOIN categories c ON m.category_id = c.id 
      WHERE c.restaurant_id = ?
    `).all(req.user.restaurant_id);
    res.json(itemsCorrect);
  });

  // Admin: Update Menu Item Status
  app.post('/api/admin/menu/toggle', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { itemId, isAvailable } = req.body;
    db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?').run(isAvailable ? 1 : 0, itemId);
    res.json({ success: true });
  });

  // Admin: Get Discounts
  app.get('/api/admin/discounts', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const discounts = db.prepare('SELECT * FROM discounts WHERE restaurant_id = ?').all(req.user.restaurant_id);
    res.json(discounts);
  });

  // Admin: Create Discount
  app.post('/api/admin/discount', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { code, percentage } = req.body;
    
    try {
      const insert = db.prepare('INSERT INTO discounts (restaurant_id, code, percentage) VALUES (?, ?, ?)');
      insert.run(req.user.restaurant_id, code, percentage);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Get Stats
  app.get('/api/admin/stats', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'billing') return res.sendStatus(403);

    // Active Orders (not paid)
    const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND status != 'paid'").get(req.user.restaurant_id) as any;

    // Today's Sales (paid orders created today)
    // using 'now' in sqlite uses UTC. If we want local time, we might need 'localtime' modifier
    // date(created_at, 'localtime') = date('now', 'localtime')
    const sales = db.prepare(`
      SELECT SUM(total_amount) as total 
      FROM orders 
      WHERE restaurant_id = ? 
      AND status = 'paid' 
      AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get(req.user.restaurant_id) as any;

    res.json({
      activeOrders: activeOrders.count,
      todaySales: sales.total || 0
    });
  });

  // Admin: Cleanup / Reset System
  app.post('/api/admin/cleanup', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      db.transaction(() => {
        // Delete all order items first (foreign key constraint)
        db.prepare('DELETE FROM order_items').run();
        // Delete all orders
        db.prepare('DELETE FROM orders').run();
        // Reset all tables to available
        db.prepare("UPDATE tables SET status = 'available'").run();
      })();

      // Notify all clients to refresh/clear their state
      io.emit('system_reset');

      res.json({ success: true, message: 'System cleaned up successfully' });
    } catch (err: any) {
      console.error('Cleanup failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Helper
  function getOrderById(orderId: number | bigint) {
    const order = db.prepare(`
      SELECT o.*, t.name as table_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.id = ?
    `).get(orderId) as any;
    
    if (order) {
      order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    }
    return order;
  }

  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  }

  // --- Socket.io ---
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_restaurant', (restaurantId) => {
      socket.join(`restaurant_${restaurantId}`);
      console.log(`Socket ${socket.id} joined restaurant_${restaurantId}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production (if we were building for prod)
    // For this environment, we mostly rely on dev mode, but good to have placeholder
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
