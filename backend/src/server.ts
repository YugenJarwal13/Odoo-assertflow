import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/org/org.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import logRoutes from './modules/logs/logs.routes.js';
import assetRoutes from './modules/assets/assets.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import maintenanceRoutes from './modules/maintenance/maintenance.routes.js';
import auditRoutes from './modules/audits/audits.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', orgRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', logRoutes);
app.use('/api', assetRoutes); // /assets, /allocations, /transfers
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/reports', reportRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 AssetFlow API running on http://localhost:${PORT}`);
});
