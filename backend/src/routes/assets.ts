import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const VALID_ASSET_STATUSES = ['OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED'] as const;

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(3),
  description: z.string().optional(),
  location: z.string(),
  area: z.string(),
  status: z.enum(VALID_ASSET_STATUSES).default('OPERATIONAL'),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().datetime().optional(),
});

// Base filter: nunca mostrar activos borrados lógicamente
const notDeleted = { deletedAt: null };

router.get('/', async (req: Request, res: Response) => {
  const { area, status, search } = req.query;
  const where: Record<string, unknown> = { ...notDeleted };
  if (area) where.area = area;
  if (status) where.status = status;
  if (search) where.OR = [
    { name: { contains: search as string } },
    { code: { contains: search as string } },
  ];

  const assets = await prisma.asset.findMany({
    where,
    include: {
      _count: { select: { workOrders: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } } } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(assets);
});

router.get('/:id', async (req, res) => {
  const asset = await prisma.asset.findFirst({
    where: { id: req.params.id, ...notDeleted },
    include: {
      workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      maintenancePlans: true,
    },
  });
  if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });
  res.json(asset);
});

router.post('/', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const asset = await prisma.asset.create({ data: parsed.data });
    res.status(201).json(asset);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Código ya existe' });
    throw e;
  }
});

router.put('/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(asset);
});

// Borrado lógico — solo ADMIN
router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response) => {
  const asset = await prisma.asset.findFirst({ where: { id: req.params.id, ...notDeleted } });
  if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

  // Verificar que no tenga OTs abiertas
  const activeOTs = await prisma.workOrder.count({
    where: { assetId: req.params.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
  });
  if (activeOTs > 0) {
    return res.status(409).json({ error: `No se puede eliminar: tiene ${activeOTs} orden(es) de trabajo activa(s)` });
  }

  await prisma.asset.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.json({ message: 'Activo eliminado correctamente' });
});

export default router;
