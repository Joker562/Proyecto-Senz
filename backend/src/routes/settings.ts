import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const PERMISSIONS_KEY = 'role_permissions';
const SMTP_KEY        = 'smtp_config';
const PASS_MASK       = '••••••••';

// ─── Permisos por defecto (incluye fleet / oee / audits) ────────────────────

const DEFAULT_PERMISSIONS = {
  ADMIN:      { dashboard:true,  workOrders:true,  assets:true,  maintenance:true,  calendar:true,  checklists:true,  users:true,  settings:true,  fleet:true,  oee:true,  audits:true  },
  SUPERVISOR: { dashboard:true,  workOrders:true,  assets:true,  maintenance:true,  calendar:true,  checklists:true,  users:false, settings:false, fleet:true,  oee:true,  audits:true  },
  TECHNICIAN: { dashboard:true,  workOrders:true,  assets:false, maintenance:false, calendar:true,  checklists:false, users:false, settings:false, fleet:false, oee:false, audits:false },
  EXECUTIVE:  { dashboard:true,  workOrders:true,  assets:false, maintenance:false, calendar:false, checklists:false, users:false, settings:false, fleet:false, oee:true,  audits:true  },
};

// GET /api/settings/role-permissions — cualquier usuario autenticado puede leer
router.get('/role-permissions', async (_req: Request, res: Response) => {
  const setting = await prisma.appSetting.findUnique({ where: { key: PERMISSIONS_KEY } });
  if (!setting) return res.json(DEFAULT_PERMISSIONS);
  try {
    const saved = JSON.parse(setting.value);
    // Fusionar con defaults para garantizar que todas las claves existan
    const merged: Record<string, object> = {};
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      merged[role] = { ...DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS], ...saved[role] };
    }
    res.json(merged);
  } catch {
    res.json(DEFAULT_PERMISSIONS);
  }
});

// PUT /api/settings/role-permissions — solo ADMIN
router.put('/role-permissions', authorize('ADMIN'), async (req: Request, res: Response) => {
  const permissions = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'Permisos inválidos' });
  }
  await prisma.appSetting.upsert({
    where:  { key: PERMISSIONS_KEY },
    update: { value: JSON.stringify(permissions) },
    create: { key: PERMISSIONS_KEY, value: JSON.stringify(permissions) },
  });
  res.json(permissions);
});

// ─── Configuración SMTP ──────────────────────────────────────────────────────

interface SmtpConfig {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; secure: boolean;
}

const SMTP_EMPTY: SmtpConfig = { host:'', port:587, user:'', pass:'', from:'', fromName:'', secure:false };

// GET /api/settings/smtp-config — ADMIN only, devuelve pass enmascarado
router.get('/smtp-config', authorize('ADMIN'), async (_req: Request, res: Response) => {
  const setting = await prisma.appSetting.findUnique({ where: { key: SMTP_KEY } });
  if (!setting) return res.json(SMTP_EMPTY);
  try {
    const cfg: SmtpConfig = JSON.parse(setting.value);
    res.json({ ...cfg, pass: cfg.pass ? PASS_MASK : '' });
  } catch {
    res.json(SMTP_EMPTY);
  }
});

// PUT /api/settings/smtp-config — ADMIN only
router.put('/smtp-config', authorize('ADMIN'), async (req: Request, res: Response) => {
  const { host, port, user, pass, from, fromName, secure } = req.body as Partial<SmtpConfig>;

  if (!host || !user) {
    return res.status(400).json({ error: 'Host y usuario SMTP son requeridos' });
  }

  // Si el cliente envía el placeholder, conservar la contraseña guardada
  let finalPass = pass ?? '';
  if (finalPass === PASS_MASK) {
    const existing = await prisma.appSetting.findUnique({ where: { key: SMTP_KEY } });
    if (existing) {
      try { finalPass = (JSON.parse(existing.value) as SmtpConfig).pass || ''; } catch { finalPass = ''; }
    } else {
      finalPass = '';
    }
  }

  const config: SmtpConfig = {
    host:     host.trim(),
    port:     Number(port) || 587,
    user:     user.trim(),
    pass:     finalPass,
    from:     (from || user).trim(),
    fromName: (fromName || 'Senz').trim(),
    secure:   Boolean(secure),
  };

  await prisma.appSetting.upsert({
    where:  { key: SMTP_KEY },
    update: { value: JSON.stringify(config) },
    create: { key: SMTP_KEY, value: JSON.stringify(config) },
  });

  res.json({ ...config, pass: config.pass ? PASS_MASK : '' });
});

export default router;
