import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import database (this initializes schema + default admin)
import './db/connection';

// Import middleware
import { authMiddleware } from './middleware/auth';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import periodsRoutes from './routes/periods';
import coursesRoutes from './routes/courses';
import unitsRoutes from './routes/units';
import teachersRoutes from './routes/teachers';
import assignmentsRoutes from './routes/assignments';
import lessonsRoutes from './routes/lessons';
import calendarRoutes from './routes/calendar';
import auditRoutes from './routes/audit';
import importRoutes from './routes/import';
import anomaliesRoutes from './routes/anomalies';
import detailViewsRoutes from './routes/detail-views';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Middleware
app.use(cors({
  origin: true, // Dynamically reflect requesting origin to support local network device testing
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no auth required)
app.use('/api/public', calendarRoutes);
app.use('/api/public/detail', detailViewsRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Admin routes (auth required)
app.use('/api/admin/users', authMiddleware, usersRoutes);
app.use('/api/admin/periods', authMiddleware, periodsRoutes);
app.use('/api/admin/courses', authMiddleware, coursesRoutes);
app.use('/api/admin/units', authMiddleware, unitsRoutes);
app.use('/api/admin/teachers', authMiddleware, teachersRoutes);
app.use('/api/admin/assignments', authMiddleware, assignmentsRoutes);
app.use('/api/admin/lessons', authMiddleware, lessonsRoutes);
app.use('/api/admin/audit-log', authMiddleware, auditRoutes);
app.use('/api/admin/import-excel', authMiddleware, importRoutes);
app.use('/api/admin/anomalies', authMiddleware, anomaliesRoutes);
app.use('/api/admin/detail', authMiddleware, detailViewsRoutes);

// Serve frontend static files from the built client
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// API 404 handler (only for /api routes)
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// SPA catch-all: serve index.html for any non-API route (client-side routing)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Frontend served from: ${clientDistPath}`);
  console.log(`\n📌 API Routes:`);
  console.log(`  Public:`);
  console.log(`    GET  /api/public/periods`);
  console.log(`    GET  /api/public/courses?period_id=`);
  console.log(`    GET  /api/public/teachers?period_id=`);
  console.log(`    GET  /api/public/calendar?period_id=&week=YYYY-MM-DD`);
  console.log(`    GET  /api/public/calendar/month?period_id=&month=YYYY-MM`);
  console.log(`  Auth:`);
  console.log(`    POST /api/auth/login`);
  console.log(`    POST /api/auth/logout`);
  console.log(`    GET  /api/auth/me`);
  console.log(`    PUT  /api/auth/change-password`);
  console.log(`  Admin (JWT required):`);
  console.log(`    CRUD /api/admin/users`);
  console.log(`    CRUD /api/admin/periods`);
  console.log(`    CRUD /api/admin/courses`);
  console.log(`    CRUD /api/admin/units`);
  console.log(`    CRUD /api/admin/teachers`);
  console.log(`    CRUD /api/admin/assignments`);
  console.log(`    CRUD /api/admin/lessons`);
  console.log(`    GET  /api/admin/audit-log`);
  console.log(`    POST /api/admin/import-excel`);
  console.log(`\n🔑 Default admin: admin / admin123\n`);
});

export default app;
