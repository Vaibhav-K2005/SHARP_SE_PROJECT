// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { db } from './data/db.js';
import authRoutes from './routes/auth.js';
import allocationRoutes from './routes/allocation.js';
import leaveRoutes from './routes/leaves.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await db.ready;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/allocation', allocationRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);

// Notifications Endpoint
app.get('/api/notifications/:role/:userId', (req, res) => {
  const { role, userId } = req.params;
  const notifications = db.find('notifications', n => 
    (n.recipientRole === role && (!n.recipientId || n.recipientId === userId))
  );
  res.json({ notifications });
});

app.post('/api/notifications/read', (req, res) => {
  const { notificationId } = req.body;
  const updated = db.update('notifications', notificationId, { read: true });
  res.json({ success: true, updated });
});

// Root / SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server if directly executed
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SHARP Platform Server running on http://localhost:${PORT}`);
    console.log(`   Smart Hostel Allocation & Resident Portal`);
    console.log(`=======================================================`);
  });
}

export default app;
