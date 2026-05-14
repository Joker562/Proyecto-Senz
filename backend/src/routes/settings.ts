import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const PERMISSIONS_KEY = 'role_permissions';

// Permisos por defecto para cada rol
const DEFAULT_PERMISSIONS = {
  ADMIN: {
    dashboard: true, workOrders: true, assets: true,
    maintenance: true, calendar: true, checklists: true,
    users: true, settings: true,
  },
  SUPERVISOR: {
    dashboard: true, workOrders: true, assets: true,
    maintenance: true, calendar: true, checklists: true,
    users: false, settings: false,
  },
  TECHNICIAN: {
    dashboard: true, workOrders: true, assets: false,
    maintenance: false, calendar: true, checklists: false,
    users: false, settings: false,
  },
  EXECUTIVE: {
    dashboard: true, workOrders: true, assets: false,
    maintenance: false, calendar: false, checklists: false,
    users: false, settings: false,
  },
};

router.get('/role-permissions', async (_req: Request, res: Response) => {
  const setting = await prisma.appSetting.findUnique({ where: { key: PERMISSIONS_KEY } });
  if (!setting) {
    return res.json(DEFAULT_PERMISSIONS);
  }
  try {
    res.json(JSON.parse(setting.value));
  } catch {
    res.json(DEFAULT_PERMISSIONS);
  }
});

router.put('/role-permissions', authorize('ADMIN'), async (req: Request, res: Response) => {
  const permissions = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'Permisos inválidos' });
  }

  await prisma.appSetting.upsert({
    where: { key: PERMISSIONS_KEY },
    update: { value: JSON.stringify(permissions) },
    create: { key: PERMISSIONS_KEY, value: JSON.stringify(permissions) },
  });

  res.json(permissions);
});

export default router;
