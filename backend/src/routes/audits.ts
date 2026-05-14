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

    const byStatus: Record<string, number> = {};
    for (const a of allAudits) byStatus[a.status] = (byStatus[a.status] || 0) + 1;

    const byType: Record<string, number> = {};
    for (const a of allAudits) byType[a.type] = (byType[a.type] || 0) + 1;

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
        _count: { select: { audits: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(templates);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// ── POST /templates ────────────────────────────────────────────────────────────
const templateItemSchema = z.object({
  description: z.string().min(1),
  weight: z.number().min(0.1).max(10).default(1),
});

const templateSectionSchema = z.object({
  name: z.string().min(1),
  isBehavior: z.boolean().default(false),
  weight: z.number().min(0.1).max(10).default(1),
  items: z.array(templateItemSchema).min(1, 'Cada sección necesita al menos 1 ítem'),
});

const saveTemplateSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['FIVE_S', 'PROCESS']),
  isDefault: z.boolean().default(false),
  sections: z.array(templateSectionSchema).min(1, 'La plantilla necesita al menos 1 sección'),
});

router.post('/templates', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const parsed = saveTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, type, isDefault, sections } = parsed.data;

  try {
    // If marking as default, unset previous default for this type
    if (isDefault) {
      await prisma.auditTemplate.updateMany({ where: { type, isDefault: true }, data: { isDefault: false } });
    }

    const template = await prisma.auditTemplate.create({
      data: {
        name, type, isDefault,
        sections: {
          create: sections.map((s, si) => ({
            order: si + 1,
            name: s.name,
            isBehavior: s.isBehavior,
            weight: s.weight,
            items: {
              create: s.items.map((i, ii) => ({
                order: ii + 1,
                description: i.description,
                weight: i.weight,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { audits: true } },
      },
    });
    res.status(201).json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

// ── PUT /templates/:id ─────────────────────────────────────────────────────────
router.put('/templates/:id', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const parsed = saveTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, type, isDefault, sections } = parsed.data;

  try {
    const existing = await prisma.auditTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Plantilla no encontrada' });

    if (isDefault) {
      await prisma.auditTemplate.updateMany({
        where: { type, isDefault: true, id: { not: req.params.id } },
        data: { isDefault: false },
      });
    }

    // Delete existing sections (items cascade) then recreate
    await prisma.auditTemplateSection.deleteMany({ where: { templateId: req.params.id } });

    const template = await prisma.auditTemplate.update({
      where: { id: req.params.id },
      data: {
        name, type, isDefault,
        sections: {
          create: sections.map((s, si) => ({
            order: si + 1,
            name: s.name,
            isBehavior: s.isBehavior,
            weight: s.weight,
            items: {
              create: s.items.map((i, ii) => ({
                order: ii + 1,
                description: i.description,
                weight: i.weight,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { audits: true } },
      },
    });
    res.json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

// ── DELETE /templates/:id ──────────────────────────────────────────────────────
router.delete('/templates/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const auditCount = await prisma.audit.count({ where: { templateId: req.params.id } });
    if (auditCount > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: la plantilla tiene ${auditCount} auditoría${auditCount > 1 ? 's' : ''} vinculada${auditCount > 1 ? 's' : ''}. Elimina primero las auditorías o desvincula la plantilla.`,
      });
    }
    await prisma.auditTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

// ── POST /templates/:id/duplicate ─────────────────────────────────────────────
router.post('/templates/:id/duplicate', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try {
    const source = await prisma.auditTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!source) return res.status(404).json({ error: 'Plantilla no encontrada' });

    const copy = await prisma.auditTemplate.create({
      data: {
        name: `${source.name} (copia)`,
        type: source.type,
        isDefault: false,
        sections: {
          create: source.sections.map(s => ({
            order: s.order,
            name: s.name,
            isBehavior: s.isBehavior,
            weight: s.weight,
            items: {
              create: s.items.map(i => ({
                order: i.order,
                description: i.description,
                weight: i.weight,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { audits: true } },
      },
    });
    res.status(201).json(copy);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al duplicar plantilla' });
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
            weight: s.weight,
            items: {
              create: s.items.map(i => ({
                order: i.order,
                description: i.description,
                weight: i.weight,
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

    // Weighted score: effectiveWeight = section.weight × item.weight
    let weightedPass = 0;
    let weightedTotal = 0;
    for (const section of audit.sections) {
      const sectionWeight = section.weight ?? 1;
      for (const item of section.items) {
        if (!item.result || item.result === 'NA') continue;
        const effective = sectionWeight * (item.weight ?? 1);
        weightedTotal += effective;
        if (item.result === 'PASS') weightedPass += effective;
      }
    }
    const score = weightedTotal > 0
      ? Math.round((weightedPass / weightedTotal) * 1000) / 10
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

// ── GET /reports/capas ─────────────────────────────────────────────────────────
// Dashboard de CAPAs: contadores globales + tabla filtrable + desglose por responsable
router.get('/reports/capas', async (req, res) => {
  try {
    const { severity, assignedTo, area, status } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (status)   where.status   = status;
    if (assignedTo) where.assignedToId = assignedTo;
    if (area) where.audit = { area };

    const [allCapas, filtered] = await Promise.all([
      prisma.capaAction.findMany({
        select: { status: true, dueDate: true, severity: true, assignedToId: true },
      }),
      prisma.capaAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true } },
          createdBy:  { select: { id: true, name: true } },
          audit: { select: { id: true, code: true, title: true, area: true, type: true } },
          auditItem: { select: { id: true, description: true } },
        },
      }),
    ]);

    const now = new Date();
    const globalStats = {
      total:               allCapas.length,
      open:                allCapas.filter(c => c.status === 'OPEN').length,
      inProgress:          allCapas.filter(c => c.status === 'IN_PROGRESS').length,
      pendingVerification: allCapas.filter(c => c.status === 'PENDING_VERIFICATION').length,
      closed:              allCapas.filter(c => c.status === 'CLOSED').length,
      overdue:             allCapas.filter(c => c.status !== 'CLOSED' && new Date(c.dueDate) < now).length,
    };

    // Desglose por responsable (todos, sin filtrar)
    const responsableMap: Record<string, { id: string; name: string; total: number; closed: number; overdue: number }> = {};
    for (const c of allCapas) {
      if (!responsableMap[c.assignedToId]) {
        responsableMap[c.assignedToId] = { id: c.assignedToId, name: '', total: 0, closed: 0, overdue: 0 };
      }
      responsableMap[c.assignedToId].total++;
      if (c.status === 'CLOSED') responsableMap[c.assignedToId].closed++;
      if (c.status !== 'CLOSED' && new Date(c.dueDate) < now) responsableMap[c.assignedToId].overdue++;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: Object.keys(responsableMap) } },
      select: { id: true, name: true },
    });
    for (const u of users) {
      if (responsableMap[u.id]) responsableMap[u.id].name = u.name;
    }

    const byResponsable = Object.values(responsableMap)
      .map(r => ({ ...r, pct: r.total > 0 ? Math.round(r.closed / r.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    res.json({ globalStats, capas: filtered, byResponsable });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener reporte de CAPAs' });
  }
});

// ── GET /reports/monthly ───────────────────────────────────────────────────────
// Cumplimiento mensual por área: últimos N meses
router.get('/reports/monthly', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 6, 24);

    const since = new Date();
    since.setMonth(since.getMonth() - months + 1);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const audits = await prisma.audit.findMany({
      where: {
        status: { in: ['COMPLETED', 'CLOSED'] },
        completedAt: { gte: since },
        score: { not: null },
      },
      select: { area: true, score: true, completedAt: true, type: true },
      orderBy: { completedAt: 'asc' },
    });

    // Agrupar por mes y área
    const monthMap: Record<string, Record<string, number[]>> = {};
    for (const a of audits) {
      if (!a.completedAt || a.score === null) continue;
      const d = new Date(a.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = {};
      if (!monthMap[key][a.area]) monthMap[key][a.area] = [];
      monthMap[key][a.area].push(a.score);
    }

    const areas = [...new Set(audits.map(a => a.area))].sort();

    const rows = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, areaScores]) => {
        const entry: Record<string, unknown> = { month };
        for (const area of areas) {
          const scores = areaScores[area];
          entry[area] = scores
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10
            : null;
        }
        return entry;
      });

    // Resumen total por área
    const areaSummary = areas.map(area => {
      const all = audits.filter(a => a.area === area && a.score !== null).map(a => a.score as number);
      return {
        area,
        count: all.length,
        avg: all.length > 0 ? Math.round(all.reduce((s, v) => s + v, 0) / all.length * 10) / 10 : null,
      };
    });

    res.json({ rows, areas, areaSummary, months });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener reporte mensual' });
  }
});

export default router;

