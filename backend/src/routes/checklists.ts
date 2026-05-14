import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Templates ───────────────────────────────────────────────────────────────

router.get('/templates', async (_req, res) => {
  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' },
  });
  res.json(templates);
});

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  items: z.array(z.object({ description: z.string(), required: z.boolean().default(false) })).min(1),
});

router.post('/templates', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, description, items } = parsed.data;
  const template = await prisma.checklistTemplate.create({
    data: {
      name, description,
      items: { create: items.map((item, i) => ({ ...item, order: i + 1 })) },
    },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  res.status(201).json(template);
});

router.delete('/templates/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.checklistTemplate.delete({ where: { id: req.params.id } });
  res.json({ message: 'Template eliminado' });
});

// ─── Work Order Checklists ────────────────────────────────────────────────────

router.get('/work-order/:workOrderId', async (req, res) => {
  const checklist = await prisma.workOrderChecklist.findUnique({
    where: { workOrderId: req.params.workOrderId },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { checkedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!checklist) return res.status(404).json({ error: 'Sin checklist' });
  res.json(checklist);
});

router.post('/work-order/:workOrderId', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const { templateId, items } = req.body as {
    templateId?: string;
    items?: { description: string; required: boolean }[];
  };

  const existing = await prisma.workOrderChecklist.findUnique({ where: { workOrderId: req.params.workOrderId } });
  if (existing) return res.status(409).json({ error: 'Ya existe un checklist para esta orden' });

  let checklistItems: { description: string; required: boolean; order: number }[] = [];

  if (templateId) {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!template) return res.status(404).json({ error: 'Template no encontrado' });
    checklistItems = template.items.map((item) => ({ description: item.description, required: item.required, order: item.order }));
  } else if (items?.length) {
    checklistItems = items.map((item, i) => ({ ...item, order: i + 1 }));
  } else {
    return res.status(400).json({ error: 'Se requiere templateId o items' });
  }

  const checklist = await prisma.workOrderChecklist.create({
    data: {
      workOrderId: req.params.workOrderId,
      items: { create: checklistItems },
    },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  res.status(201).json(checklist);
});

router.patch('/items/:itemId', async (req: Request, res: Response) => {
  const { checked, notes } = req.body as { checked: boolean; notes?: string };

  const item = await prisma.workOrderChecklistItem.update({
    where: { id: req.params.itemId },
    data: {
      checked,
      notes: notes ?? undefined,
      checkedAt: checked ? new Date() : null,
      checkedById: checked ? req.user!.userId : null,
    },
    include: { checkedBy: { select: { id: true, name: true } } },
  });
  res.json(item);
});

export default router;
