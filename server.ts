import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'super-secret-key-change-in-prod';
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

/* -------------------- DEMO USERS (VERCEL SAFE) -------------------- */
const USERS = {
  admin: { id: 1, role: 'admin', restaurant_id: 1 },
  kitchen: { id: 2, role: 'kitchen', restaurant_id: 1 },
  billing: { id: 3, role: 'billing', restaurant_id: 1 },
};

/* -------------------- AUTH -------------------- */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (USERS[username] && password === 'password') {
    const user = USERS[username];

    const token = jwt.sign(
      user,
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      role: user.role,
      restaurant_id: user.restaurant_id,
    });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

/* -------------------- DEMO DATA -------------------- */
const TABLES = [
  { id: 1, name: 'Jaguar', status: 'available' },
  { id: 2, name: 'Monkey', status: 'available' },
  { id: 3, name: 'Tiger', status: 'available' },
];

const MENU = [
  {
    id: 1,
    name: 'Food Items',
    items: [
      { id: 1, name: 'Pav Bhaji', price: 120 },
      { id: 2, name: 'Butter Pav Bhaji', price: 140 },
      { id: 3, name: 'Masala Dosa', price: 110 },
    ],
  },
  {
    id: 2,
    name: 'Cold Drinks',
    items: [
      { id: 4, name: 'Sprite (250ml)', price: 30 },
      { id: 5, name: 'Cold Coffee', price: 70 },
    ],
  },
];

let ORDERS: any[] = [];

/* -------------------- PUBLIC -------------------- */
app.get('/api/public/menu/:restaurantId', (_req, res) => {
  res.json(MENU);
});

app.post('/api/public/order', (req, res) => {
  const order = {
    id: Date.now(),
    ...req.body,
    status: 'pending',
    created_at: new Date(),
  };

  ORDERS.push(order);
  io.emit('new_order', order);

  res.json({ success: true, orderId: order.id });
});

/* -------------------- STAFF -------------------- */
app.get('/api/staff/orders', authenticateToken, (_req, res) => {
  res.json(ORDERS.filter(o => o.status !== 'paid'));
});

app.post('/api/staff/order/status', authenticateToken, (req, res) => {
  const { orderId, status } = req.body;
  const order = ORDERS.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    io.emit('order_updated', order);
  }
  res.json({ success: true });
});

app.post('/api/staff/order/pay', authenticateToken, (req, res) => {
  const { orderId } = req.body;
  const order = ORDERS.find(o => o.id === orderId);
  if (order) {
    order.status = 'paid';
    io.emit('order_paid', order);
  }
  res.json({ success: true });
});

app.get('/api/staff/tables', authenticateToken, (_req, res) => {
  res.json(TABLES);
});

/* -------------------- ADMIN -------------------- */
app.get('/api/admin/stats', authenticateToken, (req: any, res) => {
  if (!['admin', 'billing'].includes(req.user.role)) {
    return res.sendStatus(403);
  }

  res.json({
    activeOrders: ORDERS.filter(o => o.status !== 'paid').length,
    todaySales: ORDERS
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
  });
});

/* -------------------- SOCKET.IO -------------------- */
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected'));
});

/* -------------------- START -------------------- */
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
