import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { generateDueWorkOrders } from '../services/autoOT';

const VALID_MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION'] as const;

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(VALID_MAINTENANCE_TYPES).default('PREVENTIVE'),
  triggerType: z.enum(['TIME', 'USAGE', 'BOTH']).default('TIME'),
  frequency: z.number().int().positive().optional(),
  frequencyUnit: z.enum(['days', 'weeks', 'months']).optional(),
  usageThreshold: z.number().positive().optional(),
  usageUnit: z.enum(['hours', 'cycles', 'km']).optional(),
  nextDue: z.string().datetime().optional(),
  assetId: z.string(),
  active: z.boolean().default(true),
  checklistTemplateId: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const { assetId, active } = req.query;
  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;
  if (active !== undefined) where.active = active === 'true';

  const plans = await prisma.maintenancePlan.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, code: true, area: true, currentHours: true, currentCycles: true, currentKm: true } },
      checklistTemplate: { select: { id: true, name: true } },
    },
    orderBy: { nextDue: 'asc' },
  });
  res.json(plans);
});

router.post('/', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = { ...parsed.data, nextDue: parsed.data.nextDue ? new Date(parsed.data.nextDue) : undefined };
  const plan = await prisma.maintenancePlan.create({
    data,
    include: { asset: { select: { id: true, name: true, code: true } } },
  });
  res.status(201).json(plan);
});

router.patch('/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.nextDue) data.nextDue = new Date(parsed.data.nextDue);

  const plan = await prisma.maintenancePlan.update({ where: { id: req.params.id }, data });
  res.json(plan);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.maintenancePlan.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ message: 'Plan desactivado' });
});

router.post('/trigger-auto-ot', authorize('ADMIN', 'SUPERVISOR'), async (_req, res) => {
  await generateDueWorkOrders();
  res.json({ message: 'Generación de OTs ejecutada' });
});

export default router;
