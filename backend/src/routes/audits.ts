import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /dashboard ────────────────────────────────────────────────────────────
router.get('/dashboard', async (_req, res) => {
  try {
    const [totalAudits, allAudits, capas] = await Promise.all([
      prisma.audit.count(),
      prisma.audit.findMany({ select: { area: true, score: true, status: true, type: true } }),
      prisma.capaAction.findMany({ select: { status: true, dueDate: true, severity: true } }),
    ]);

    // Agrupar por estado
    const byStatus: Record<string, number> = {};
    for (const a of allAudits) byStatus[a.status] = (byStatus[a.status] || 0) + 1;

    // Agrupar por tipo
    const byType: Record<string, number> = {};
    for (const a of allAudits) byType[a.type] = (byType[a.type] || 0) + 1;

    // Agrupar por área con puntaje promedio
    const areaMap: Record<string, { count: number; scores: number[] }> = {};
    for (const a of allAudits) {
      if (!areaMap[a.area]) areaMap[a.area] = { count: 0, scores: [] };
      areaMap[a.area].count++;
      if (a.score !== null) areaMap[a.area].scores.push(a.score);
    }
    const byArea = Object.entries(areaMap).map(([area, d]) => ({
      area,
      count: d.count,
      avgScore: d.scores.length > 0
        ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length * 10) / 10
        : null,
    })).sort((a, b) => b.count - a.count);

    const now = new Date();
    const capaStats = {
      total: capas.length,
      open: capas.filter(c => c.status === 'OPEN').length,
      inProgress: capas.filter(c => c.status === 'IN_PROGRESS').length,
      pendingVerification: capas.filter(c => c.status === 'PENDING_VERIFICATION').length,
      closed: capas.filter(c => c.status === 'CLOSED').length,
      overdue: capas.filter(c => c.status !== 'CLOSED' && new Date(c.dueDate) < now).length,
    };

    const recentAudits = await prisma.audit.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { auditor: { select: { id: true, name: true } } },
    });

    res.json({ totalAudits, byStatus, byType, byArea, capaStats, recentAudits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

// ── GET /templates ─────────────────────────────────────────────────────────────
router.get('/templates', async (_req, res) => {
  try {
    const templates = await prisma.auditTemplate.findMany({
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
    });
    res.json(templates);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// ── GET /capa ──────────────────────────────────────────────────────────────────
router.get('/capa', async (req, res) => {
  try {
    const { status, type, severity } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (severity) where.severity = severity;

    const capas = await prisma.capaAction.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        audit: { select: { id: true, code: true, title: true, area: true, type: true } },
        auditItem: { select: { id: true, description: true } },
      },
    });
    res.json(capas);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener acciones CAPA' });
  }
});

// ── GET / ──────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, area, status } = req.query;
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (area) where.area = area;
    if (status) where.status = status;

    const audits = await prisma.audit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        auditor: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { capaActions: true, sections: true } },
      },
    });
    res.json(audits);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener auditorías' });
  }
});

// ── GET /:id ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      include: {
        auditor: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: {
                checkedBy: { select: { id: true, name: true } },
                capaActions: {
                  include: {
                    assignedTo: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        capaActions: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            auditItem: { select: { id: true, description: true } },
          },
        },
      },
    });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    res.json(audit);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener auditoría' });
  }
});

// ── POST / ─────────────────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().min(3),
  type: z.enum(['FIVE_S', 'PROCESS']),
  area: z.string().min(1),
  scheduledAt: z.string(),
  auditorId: z.string(),
  templateId: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { title, type, area, scheduledAt, auditorId, templateId, notes } = parsed.data;

  try {
    const template = await prisma.auditTemplate.findFirst({
      where: templateId ? { id: templateId } : { type, isDefault: true },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!template) return res.status(400).json({ error: 'No se encontró plantilla para este tipo' });

    const code = `AUD-${Date.now().toString(36).toUpperCase()}`;

    const audit = await prisma.audit.create({
      data: {
        code, title, type, area, notes,
        scheduledAt: new Date(scheduledAt),
        auditorId,
        templateId: template.id,
        sections: {
          create: template.sections.map(s => ({
            order: s.order,
            name: s.name,
            isBehavior: s.isBehavior,
            items: {
              create: s.items.map(i => ({
                order: i.order,
                description: i.description,
              })),
            },
          })),
        },
      },
      include: {
        auditor: { select: { id: true, name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
    });
    res.status(201).json(audit);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear auditoría' });
  }
});

// ── PATCH /:id/start ───────────────────────────────────────────────────────────
router.patch('/:id/start', async (req, res) => {
  try {
    const audit = await prisma.audit.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    res.json(audit);
  } catch (e) {
    res.status(500).json({ error: 'Error al iniciar auditoría' });
  }
});

// ── PATCH /:id/complete ────────────────────────────────────────────────────────
router.patch('/:id/complete', async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      include: { sections: { include: { items: true } } },
    });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });

    const allItems = audit.sections.flatMap(s => s.items);
    const answered = allItems.filter(i => i.result !== null && i.result !== 'NA');
    const passed = answered.filter(i => i.result === 'PASS');
    const score = answered.length > 0
      ? Math.round((passed.length / answered.length) * 1000) / 10
      : null;

    const updated = await prisma.audit.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', completedAt: new Date(), score },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al completar auditoría' });
  }
});

// ── PATCH /:id/close ───────────────────────────────────────────────────────────
router.patch('/:id/close', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try {
    const audit = await prisma.audit.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED' },
    });
    res.json(audit);
  } catch (e) {
    res.status(500).json({ error: 'Error al cerrar auditoría' });
  }
});

// ── PATCH /:id/items/:itemId ───────────────────────────────────────────────────
const updateItemSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'NA']),
  notes: z.string().optional(),
});

router.patch('/:id/items/:itemId', async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const item = await prisma.auditItem.update({
      where: { id: req.params.itemId },
      data: {
        result: parsed.data.result,
        notes: parsed.data.notes ?? null,
        checkedAt: new Date(),
        checkedById: (req as any).user.userId,
      },
      include: { checkedBy: { select: { id: true, name: true } } },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar ítem' });
  }
});

// ── POST /:id/capa ─────────────────────────────────────────────────────────────
const createCapaSchema = z.object({
  type: z.enum(['CORRECTIVE', 'PREVENTIVE']),
  description: z.string().min(5),
  rootCause: z.string().optional(),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']),
  dueDate: z.string(),
  assignedToId: z.string(),
  auditItemId: z.string().optional(),
});

router.post('/:id/capa', async (req, res) => {
  const parsed = createCapaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const code = `CAPA-${Date.now().toString(36).toUpperCase()}`;
    const capa = await prisma.capaAction.create({
      data: {
        code,
        type: parsed.data.type,
        description: parsed.data.description,
        rootCause: parsed.data.rootCause,
        severity: parsed.data.severity,
        dueDate: new Date(parsed.data.dueDate),
        auditId: req.params.id,
        auditItemId: parsed.data.auditItemId ?? null,
        assignedToId: parsed.data.assignedToId,
        createdById: (req as any).user.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        auditItem: { select: { id: true, description: true } },
      },
    });
    res.status(201).json(capa);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear acción CAPA' });
  }
});

// ── PATCH /capa/:id ────────────────────────────────────────────────────────────
const updateCapaSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED']).optional(),
  closingNotes: z.string().optional(),
});

router.patch('/capa/:id', async (req, res) => {
  const parsed = updateCapaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === 'CLOSED') data.closedAt = new Date();

    const capa = await prisma.capaAction.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        audit: { select: { id: true, code: true, title: true, area: true } },
      },
    });
    res.json(capa);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar acción CAPA' });
  }
});

export default router;
