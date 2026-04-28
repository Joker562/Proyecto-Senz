import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
const VALID_ROLES = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'EXECUTIVE'] as const;
type Role = typeof VALID_ROLES[number];

const router = Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'SUPERVISOR'), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.get('/me', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
});

router.post('/', authorize('ADMIN'), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(VALID_ROLES).default('TECHNICIAN'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const hash = await bcrypt.hash(parsed.data.password, 10);
  try {
    const user = await prisma.user.create({
      data: { ...parsed.data, password: hash },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'Email ya registrado' });
  }
});

router.patch('/:id/toggle', authorize('ADMIN'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: !user.active },
    select: { id: true, active: true },
  });
  res.json(updated);
});

// PATCH /api/users/:id/password — resetear contraseña (ADMIN)
router.patch('/:id/password', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    const schema = z.object({ password: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const hash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hash } });
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/users/:id — editar nombre y/o rol (ADMIN)
router.patch('/:id', authorize('ADMIN'), async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    role: z.enum(VALID_ROLES).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Evitar que el admin se degrade a sí mismo
  if (req.params.id === req.user!.userId && parsed.data.role && parsed.data.role !== 'ADMIN') {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  res.json(updated);
});

export default router;
