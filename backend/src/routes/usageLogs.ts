import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const logSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['hours', 'cycles', 'km']),
  notes: z.string().optional(),
});

router.post('/:assetId', async (req: Request, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { value, unit, notes } = parsed.data;

  const log = await prisma.assetUsageLog.create({
    data: { assetId: req.params.assetId, value, unit, notes, loggedById: req.user!.userId },
  });

  const updateField =
    unit === 'hours' ? { currentHours: value } :
    unit === 'cycles' ? { currentCycles: value } :
    { currentKm: value };

  await prisma.asset.update({ where: { id: req.params.assetId }, data: updateField });

  res.status(201).json(log);
});

router.get('/:assetId', async (req, res) => {
  const logs = await prisma.assetUsageLog.findMany({
    where: { assetId: req.params.assetId },
    include: { loggedBy: { select: { id: true, name: true } } },
    orderBy: { loggedAt: 'desc' },
    take: 50,
  });
  res.json(logs);
});

export default router;
