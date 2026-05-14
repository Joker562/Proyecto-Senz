import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';

// ── Backup automático del dev.db al iniciar ───────────────────────────────────
(function backupDb() {
  try {
    const src = path.resolve(__dirname, '../../prisma/dev.db');
    if (!fs.existsSync(src)) return;
    const backupDir = path.resolve(__dirname, '../../prisma/backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(backupDir, `dev_${date}.db`);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log(`💾 Backup DB → backups/dev_${date}.db`);
    }
    // Limpia backups de más de 30 días
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort();
    if (files.length > 30) {
      const old = files.slice(0, files.length - 30);
      old.forEach(f => fs.unlinkSync(path.join(backupDir, f)));
    }
  } catch (e) {
    console.warn('⚠️  No se pudo hacer backup de la DB:', e);
  }
})();
import cors from 'cors';
import { setupSocket } from './socket';
import { startAutoOTCron } from './services/autoOT';
import { UPLOAD_DIR } from './services/upload';
import authRouter from './routes/auth';
import workOrdersRouter from './routes/workOrders';
import assetsRouter from './routes/assets';
import usersRouter from './routes/users';
import maintenancePlansRouter from './routes/maintenancePlans';
import photosRouter from './routes/photos';
import signaturesRouter from './routes/signatures';
import checklistsRouter from './routes/checklists';
import usageLogsRouter from './routes/usageLogs';
import areasRouter from './routes/areas';
import settingsRouter from './routes/settings';
import partRequestRouter from './routes/partRequest';
import auditsRouter from './routes/audits';

const app = express();
const httpServer = http.createServer(app);
const io = setupSocket(httpServer);

app.set('io', io);

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use('/api/auth', authRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/maintenance-plans', maintenancePlansRouter);
app.use('/api/photos', photosRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/usage-logs', usageLogsRouter);
app.use('/api/areas', areasRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/part-requests', partRequestRouter);
app.use('/api/audits', auditsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

startAutoOTCron();

const PORT = process.env.PORT || 4000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Backend en http://localhost:${PORT}`);
  console.log(`🌐 Red local:   http://192.168.254.28:${PORT}`);
});
