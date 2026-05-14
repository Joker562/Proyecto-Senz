import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/areas — lista todas las áreas
router.get('/', async (_req, res) => {
  const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
  res.json(areas);
});

// POST /api/areas — crear área (ADMIN / SUPERVISOR)
router.post('/', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const schema = z.object({ name: z.string().min(2).max(60) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const area = await prisma.area.create({ data: { name: parsed.data.name.trim() } });
    res.status(201).json(area);
  } catch {
    res.status(409).json({ error: 'El área ya existe' });
  }
});

// DELETE /api/areas/:id — eliminar área (ADMIN)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  const area = await prisma.area.findUnique({ where: { id: req.params.id } });
  if (!area) return res.status(404).json({ error: 'Área no encontrada' });
  await prisma.area.delete({ where: { id: req.params.id } });
  res.json({ message: 'Área eliminada' });
});

export default router;
