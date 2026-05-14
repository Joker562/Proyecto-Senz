import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const schema = z.object({
  data: z.string().min(10),
  signerName: z.string().min(2),
});

router.post('/:workOrderId', async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.signature.findUnique({ where: { workOrderId: req.params.workOrderId } });
  if (existing) return res.status(409).json({ error: 'Esta orden ya tiene firma' });

  const signature = await prisma.signature.create({
    data: {
      ...parsed.data,
      workOrderId: req.params.workOrderId,
      signedById: req.user!.userId,
    },
  });

  await prisma.workOrder.update({
    where: { id: req.params.workOrderId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  req.app.get('io')?.emit('workOrder:updated', { id: req.params.workOrderId });
  res.status(201).json(signature);
});

router.get('/:workOrderId', async (req, res) => {
  const signature = await prisma.signature.findUnique({
    where: { workOrderId: req.params.workOrderId },
    include: { signedBy: { select: { id: true, name: true } } },
  });
  if (!signature) return res.status(404).json({ error: 'Sin firma' });
  res.json(signature);
});

export default router;
