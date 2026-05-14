import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const VALID_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION'] as const;
const VALID_PERIODICIDAD = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
type WorkOrderStatus = typeof VALID_STATUSES[number];

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string(),
  type: z.enum(VALID_TYPES),
  priority: z.enum(VALID_PRIORITIES).default('MEDIUM'),
  periodicidad: z.enum(VALID_PERIODICIDAD).optional(),
  assetId: z.string(),
  assignedToId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const { status, priority, assetId, assignedToId, periodicidad, page = '1', limit = '20' } = req.query;
  const { role, userId } = req.user!;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assetId) where.assetId = assetId;
  if (assignedToId) where.assignedToId = assignedToId;
  if (periodicidad) where.periodicidad = periodicidad;

  // TECHNICIAN only sees orders assigned to them
  if (role === 'TECHNICIAN') where.assignedToId = userId;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where, skip, take: Number(limit),
      include: {
        asset: true,
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workOrder.count({ where }),
  ]);

  res.json({ data: orders, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

function buildDateFilter(period: unknown, from: unknown, to: unknown): Record<string, unknown> | null {
  if (from && to) {
    return { gte: new Date(from as string), lte: new Date(to as string) };
  }
  if (!period || period === 'all') return null;
  const now = new Date();
  const start = new Date();
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else return null;
  return { gte: start };
}

router.get('/stats', async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  const { period, from, to } = req.query;

  const baseWhere: Record<string, unknown> = role === 'TECHNICIAN' ? { assignedToId: userId } : {};

  const dateFilter = buildDateFilter(period, from, to);
  if (dateFilter) baseWhere.createdAt = dateFilter;

  const [total, byStatus, byPriority, overdue] = await Promise.all([
    prisma.workOrder.count({ where: baseWhere }),
    prisma.workOrder.groupBy({ by: ['status'], where: baseWhere, _count: true }),
    prisma.workOrder.groupBy({ by: ['priority'], where: baseWhere, _count: true }),
    prisma.workOrder.count({
      where: { ...baseWhere, status: { notIn: ['COMPLETED', 'CANCELLED'] }, scheduledAt: { lt: new Date() } },
    }),
  ]);
  res.json({ total, byStatus, byPriority, overdue });
});

// Equipos con mantenimientos completados — para sección historial del Dashboard
router.get('/completed-by-asset', async (req: Request, res: Response) => {
  const { role, userId } = req.user!;
  const { period, from, to } = req.query;
  const baseWhere: Record<string, unknown> = {
    status: 'COMPLETED',
    ...(role === 'TECHNICIAN' ? { assignedToId: userId } : {}),
  };
  const dateFilter = buildDateFilter(period, from, to);
  if (dateFilter) baseWhere.completedAt = dateFilter;

  const orders = await prisma.workOrder.findMany({
    where: baseWhere,
    include: {
      asset: { select: { id: true, name: true, code: true, area: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: 'desc' },
    take: 50,
  });

  // Agrupar por activo: último completado + total
  const map = new Map<string, {
    assetId: string; assetName: string; assetCode: string; area: string;
    totalCompleted: number; lastCompletedAt: string | null; lastTitle: string;
    lastTechnician: string | null;
  }>();

  for (const o of orders) {
    if (!o.asset) continue;
    const key = o.asset.id;
    if (!map.has(key)) {
      map.set(key, {
        assetId: o.asset.id, assetName: o.asset.name, assetCode: o.asset.code,
        area: o.asset.area, totalCompleted: 0,
        lastCompletedAt: null, lastTitle: '', lastTechnician: null,
      });
    }
    const entry = map.get(key)!;
    entry.totalCompleted += 1;
    if (!entry.lastCompletedAt) {
      entry.lastCompletedAt = o.completedAt?.toISOString() ?? null;
      entry.lastTitle = o.title;
      entry.lastTechnician = o.assignedTo?.name ?? null;
    }
  }

  res.json(Array.from(map.values()));
});

router.get('/:id', async (req, res) => {
  const order = await prisma.workOrder.findUnique({
    where: { id: req.params.id },
    include: {
      asset: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      photos: { orderBy: { createdAt: 'asc' } },
      signature: { include: { signedBy: { select: { id: true, name: true } } } },
    },
  });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

  // TECHNICIAN can only view their assigned orders
  if (req.user!.role === 'TECHNICIAN' && order.assignedToId !== req.user!.userId) {
    return res.status(403).json({ error: 'Sin acceso a esta orden' });
  }
  res.json(order);
});

router.post('/', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const order = await prisma.workOrder.create({
    data: { ...parsed.data, createdById: req.user!.userId },
    include: { asset: true },
  });

  req.app.get('io')?.emit('workOrder:created', order);
  res.status(201).json(order);
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body as { status: WorkOrderStatus };
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  // EXECUTIVE cannot change status
  if (req.user!.role === 'EXECUTIVE') {
    return res.status(403).json({ error: 'Sin permisos para cambiar estado' });
  }

  const order = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

  // TECHNICIAN can only update orders assigned to them
  if (req.user!.role === 'TECHNICIAN' && order.assignedToId !== req.user!.userId) {
    return res.status(403).json({ error: 'Solo puedes actualizar tus órdenes asignadas' });
  }

  const updates: Record<string, unknown> = { status };
  if (status === 'IN_PROGRESS') updates.startedAt = new Date();
  if (status === 'COMPLETED') updates.completedAt = new Date();

  const updated = await prisma.workOrder.update({ where: { id: req.params.id }, data: updates });
  req.app.get('io')?.emit('workOrder:updated', updated);
  res.json(updated);
});

router.patch('/:id/assign', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const { assignedToId } = req.body as { assignedToId: string | null };
  const updated = await prisma.workOrder.update({
    where: { id: req.params.id },
    data: { assignedToId: assignedToId ?? null },
    include: { asset: true, assignedTo: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  });
  req.app.get('io')?.emit('workOrder:updated', updated);
  res.json(updated);
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  if (!content?.trim()) return res.status(400).json({ error: 'Comentario vacío' });

  const comment = await prisma.comment.create({
    data: { content, workOrderId: req.params.id, authorId: req.user!.userId },
    include: { author: { select: { id: true, name: true } } },
  });

  req.app.get('io')?.emit('comment:added', { workOrderId: req.params.id, comment });
  res.status(201).json(comment);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  const order = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  await prisma.workOrder.delete({ where: { id: req.params.id } });
  req.app.get('io')?.emit('workOrder:deleted', { id: req.params.id });
  res.json({ message: 'Orden eliminada' });
});

export default router;
