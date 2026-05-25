import { Router } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/notifications — lista para el usuario autenticado
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    const unreadCount = notifications.filter((n) => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// PATCH /api/notifications/read-all — marcar todas como leídas  (debe ir antes de /:id/read)
router.patch('/read-all', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

// PATCH /api/notifications/:id/read — marcar una como leída
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar notificación' });
  }
});

export default router;
