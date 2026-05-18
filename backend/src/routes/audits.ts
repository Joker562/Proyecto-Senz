import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { sendNotification, notifyByRole } from '../services/notifications';
import { upload } from '../services/upload';

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
  type: z.enum(['FIVE_S', 'PROCESS', 'SAFETY']),
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
    const { type, area, status, startDate, endDate } = req.query;
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (area) where.area = area;
    if (status) where.status = status;
    if (startDate || endDate) {
      const range: Record<string, Date> = {};
      if (startDate) range.gte = new Date(startDate as string);
      if (endDate)   range.lte = new Date(endDate as string);
      where.scheduledAt = range;
    }

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
  type: z.enum(['FIVE_S', 'PROCESS', 'SAFETY']),
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
    // Validar que el auditor no tenga otra auditoría activa el mismo día
    const schedDate = new Date(scheduledAt);
    const dayStart  = new Date(schedDate.getFullYear(), schedDate.getMonth(), schedDate.getDate());
    const dayEnd    = new Date(schedDate.getFullYear(), schedDate.getMonth(), schedDate.getDate() + 1);

    const conflict = await prisma.audit.findFirst({
      where: {
        auditorId,
        status: { in: ['DRAFT', 'IN_PROGRESS'] },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { code: true, title: true, area: true },
    });
    if (conflict) {
      return res.status(409).json({
        error: `Conflicto de horario: ${conflict.code} — "${conflict.title}" (${conflict.area}) ya está asignada al mismo auditor para esa fecha.`,
      });
    }

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
    // Notificar al auditor asignado (no bloquea la respuesta)
    sendNotification({
      type: 'AUDIT_ASSIGNED',
      referenceId: audit.id,
      userId: auditorId,
      message: `Se te asignó la auditoría "${title}" (${area}) — ${audit.code}`,
      link: `/audits/${audit.id}`,
      emailSubject: `[Asignación] Auditoría ${audit.code} — ${area}`,
      emailHtml: `<p>Se te ha asignado una nueva auditoría:</p>
        <ul>
          <li><strong>Código:</strong> ${audit.code}</li>
          <li><strong>Título:</strong> ${title}</li>
          <li><strong>Área:</strong> ${area}</li>
          <li><strong>Fecha programada:</strong> ${new Date(scheduledAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}</li>
        </ul>`,
    }).catch((e) => console.error('[Audit] Notif error:', e));

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
      include: { auditor: { select: { id: true, name: true } } },
    });

    // Alerta a supervisores/admins si score < 60%
    if (score !== null && score < 60) {
      const fullAudit = await prisma.audit.findUnique({
        where: { id: req.params.id },
        select: { code: true, title: true, area: true },
      });
      if (fullAudit) {
        notifyByRole(['SUPERVISOR', 'ADMIN'], {
          type: 'AUDIT_LOW_SCORE',
          referenceId: req.params.id,
          message: `Auditoría ${fullAudit.code} completada con puntaje bajo: ${score}% (${fullAudit.area})`,
          link: `/audits/${req.params.id}`,
          emailSubject: `[Alerta] Auditoría ${fullAudit.code} — Puntaje ${score}%`,
          emailHtml: `<p style="color:#c0392b">Una auditoría fue completada con puntaje <strong>por debajo del 60%</strong>:</p>
            <ul>
              <li><strong>Código:</strong> ${fullAudit.code}</li>
              <li><strong>Título:</strong> ${fullAudit.title}</li>
              <li><strong>Área:</strong> ${fullAudit.area}</li>
              <li><strong>Puntaje:</strong> ${score}%</li>
            </ul>
            <p>Se recomienda revisar los hallazgos y crear acciones CAPA.</p>`,
        }).catch((e) => console.error('[Audit] Low-score notif error:', e));
      }
    }

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
  // 5 Por Qués
  why1: z.string().optional(),
  why2: z.string().optional(),
  why3: z.string().optional(),
  why4: z.string().optional(),
  why5: z.string().optional(),
  // Ishikawa
  ishikawaMachine:     z.string().optional(),
  ishikawaMethod:      z.string().optional(),
  ishikawaMaterial:    z.string().optional(),
  ishikawaManpower:    z.string().optional(),
  ishikawaEnvironment: z.string().optional(),
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
        why1: parsed.data.why1,
        why2: parsed.data.why2,
        why3: parsed.data.why3,
        why4: parsed.data.why4,
        why5: parsed.data.why5,
        ishikawaMachine:     parsed.data.ishikawaMachine,
        ishikawaMethod:      parsed.data.ishikawaMethod,
        ishikawaMaterial:    parsed.data.ishikawaMaterial,
        ishikawaManpower:    parsed.data.ishikawaManpower,
        ishikawaEnvironment: parsed.data.ishikawaEnvironment,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        auditItem: { select: { id: true, description: true } },
        audit: { select: { code: true, title: true, area: true } },
      },
    });

    // Notificar al responsable asignado
    const desc = capa.description.length > 80 ? capa.description.slice(0, 80) + '…' : capa.description;
    sendNotification({
      type: 'CAPA_ASSIGNED',
      referenceId: capa.id,
      userId: parsed.data.assignedToId,
      message: `Se te asignó CAPA ${capa.code} (${capa.severity}) — vence ${new Date(parsed.data.dueDate).toLocaleDateString('es-MX')}`,
      link: `/audits/capa`,
      emailSubject: `[Asignación] CAPA ${capa.code} — ${capa.severity}`,
      emailHtml: `<p>Se te ha asignado una nueva acción CAPA:</p>
        <ul>
          <li><strong>Código:</strong> ${capa.code}</li>
          <li><strong>Tipo:</strong> ${capa.type}</li>
          <li><strong>Severidad:</strong> ${capa.severity}</li>
          <li><strong>Descripción:</strong> ${desc}</li>
          <li><strong>Auditoría:</strong> ${capa.audit.code} — ${capa.audit.area}</li>
          <li><strong>Fecha límite:</strong> ${new Date(parsed.data.dueDate).toLocaleDateString('es-MX', { dateStyle: 'long' })}</li>
        </ul>`,
    }).catch((e) => console.error('[CAPA] Notif error:', e));

    res.status(201).json(capa);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear acción CAPA' });
  }
});

// ── PATCH /capa/:id ────────────────────────────────────────────────────────────
const updateCapaSchema = z.object({
  status:       z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED']).optional(),
  closingNotes: z.string().optional(),
  rootCause:    z.string().optional(),
  why1:         z.string().optional(),
  why2:         z.string().optional(),
  why3:         z.string().optional(),
  why4:         z.string().optional(),
  why5:         z.string().optional(),
  ishikawaMachine:     z.string().optional(),
  ishikawaMethod:      z.string().optional(),
  ishikawaMaterial:    z.string().optional(),
  ishikawaManpower:    z.string().optional(),
  ishikawaEnvironment: z.string().optional(),
  evidencePhotos: z.array(z.string()).optional(),
});

const TRACKED_FIELDS = ['status', 'rootCause', 'why1', 'why2', 'why3', 'why4', 'why5',
  'ishikawaMachine', 'ishikawaMethod', 'ishikawaMaterial', 'ishikawaManpower', 'ishikawaEnvironment'];

router.patch('/capa/:id', async (req, res) => {
  const parsed = updateCapaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const existing = await prisma.capaAction.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'CAPA no encontrada' });

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === 'CLOSED') updateData.closedAt = new Date();
    if (parsed.data.evidencePhotos !== undefined) {
      updateData.evidencePhotos = JSON.stringify(parsed.data.evidencePhotos);
    }

    const capa = await prisma.capaAction.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy:  { select: { id: true, name: true } },
        audit:      { select: { id: true, code: true, title: true, area: true } },
        changeLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { changedAt: 'desc' },
          take: 20,
        },
      },
    });

    // Registrar cambios auditables en segundo plano
    const userId = (req as any).user.userId;
    const logs = TRACKED_FIELDS
      .filter(f => parsed.data[f as keyof typeof parsed.data] !== undefined)
      .map(f => ({
        capaId:   req.params.id,
        userId,
        field:    f,
        oldValue: String((existing as any)[f] ?? ''),
        newValue: String(parsed.data[f as keyof typeof parsed.data] ?? ''),
      }))
      .filter(l => l.oldValue !== l.newValue);

    if (logs.length > 0) {
      prisma.capaChangeLog.createMany({ data: logs }).catch(console.error);
    }

    res.json(capa);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar acción CAPA' });
  }
});

// ── GET /capa/:id ─────────────────────────────────────────────────────────────
router.get('/capa/:id', async (req, res) => {
  try {
    const capa = await prisma.capaAction.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy:  { select: { id: true, name: true } },
        audit:      { select: { id: true, code: true, title: true, area: true } },
        auditItem:  { select: { id: true, description: true } },
        changeLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { changedAt: 'desc' },
        },
      },
    });
    if (!capa) return res.status(404).json({ error: 'CAPA no encontrada' });
    res.json({ ...capa, evidencePhotos: capa.evidencePhotos ? JSON.parse(capa.evidencePhotos) : [] });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener CAPA' });
  }
});

// ── DELETE /:id — eliminación segura de auditoría ─────────────────────────────
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      include: {
        capaActions: { select: { id: true, code: true, status: true } },
      },
    });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });

    // Bloquear si tiene CAPAs abiertas (integridad de negocio)
    const openCapas = audit.capaActions.filter((c) => c.status !== 'CLOSED');
    if (openCapas.length > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: existen ${openCapas.length} acción(es) CAPA sin cerrar (${openCapas.map((c) => c.code).join(', ')}). Ciérralas primero.`,
      });
    }

    // Limpiar en orden correcto:
    // 1. Notificaciones huérfanas de CAPAs y de la auditoría
    const capaIds = audit.capaActions.map((c) => c.id);
    await prisma.notification.deleteMany({
      where: { referenceId: { in: [...capaIds, req.params.id] } },
    });
    // 2. CAPAs (CLOSED, sin restricción)
    await prisma.capaAction.deleteMany({ where: { auditId: req.params.id } });
    // 3. Auditoría — cascade elimina secciones e ítems
    await prisma.audit.delete({ where: { id: req.params.id } });

    console.log(`[Audit] Eliminada ${audit.code} por usuario ${(req as any).user.userId}`);
    res.json({ ok: true, deleted: audit.code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar auditoría' });
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

// ── POST /capa/:id/evidence — subir foto de evidencia ─────────────────────────
router.post('/capa/:id/evidence', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const capa = await prisma.capaAction.findUnique({ where: { id: req.params.id }, select: { evidencePhotos: true } });
    if (!capa) return res.status(404).json({ error: 'CAPA no encontrada' });
    const current: string[] = capa.evidencePhotos ? JSON.parse(capa.evidencePhotos) : [];
    const url = `/uploads/${req.file.filename}`;
    const updated = [...current, url];
    await prisma.capaAction.update({ where: { id: req.params.id }, data: { evidencePhotos: JSON.stringify(updated) } });
    res.json({ url, photos: updated });
  } catch (e) {
    res.status(500).json({ error: 'Error al subir evidencia' });
  }
});

// ── DELETE /capa/:id/evidence — eliminar foto de evidencia ────────────────────
router.delete('/capa/:id/evidence', async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) return res.status(400).json({ error: 'Falta url' });
  try {
    const capa = await prisma.capaAction.findUnique({ where: { id: req.params.id }, select: { evidencePhotos: true } });
    if (!capa) return res.status(404).json({ error: 'CAPA no encontrada' });
    const current: string[] = capa.evidencePhotos ? JSON.parse(capa.evidencePhotos) : [];
    const updated = current.filter(u => u !== url);
    await prisma.capaAction.update({ where: { id: req.params.id }, data: { evidencePhotos: JSON.stringify(updated) } });
    // Borrar archivo físico
    const filename = path.basename(url);
    const filepath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(filepath)) fs.unlink(filepath, () => {});
    res.json({ photos: updated });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar evidencia' });
  }
});

// ── Backend endpoints para historial y trazabilidad ───────────────────────────

// GET /reports/history?area=X — puntajes históricos por auditoría en un área
router.get('/reports/history', async (req, res) => {
  try {
    const { area } = req.query as { area?: string };
    const where: Record<string, unknown> = { status: { in: ['COMPLETED', 'CLOSED'] }, score: { not: null } };
    if (area) where.area = area;

    const audits = await prisma.audit.findMany({
      where,
      select: { id: true, code: true, area: true, score: true, completedAt: true, type: true, auditor: { select: { name: true } } },
      orderBy: { completedAt: 'asc' },
    });

    // Áreas disponibles para el filtro
    const areas = [...new Set(audits.map(a => a.area))].sort();

    res.json({ audits, areas });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /reports/recurrence?area=X — ítems con alta tasa de fallo
router.get('/reports/recurrence', async (req, res) => {
  try {
    const { area, threshold = '0.5' } = req.query as { area?: string; threshold?: string };
    const failRate = parseFloat(threshold);

    const where: Record<string, unknown> = {};
    if (area) where.audit = { area };

    const items = await prisma.auditItem.findMany({
      where,
      select: { description: true, result: true, section: { select: { audit: { select: { area: true } } } } },
    });

    // Agrupar por (descripción + área) y calcular tasa de fallo
    const map: Record<string, { total: number; fails: number; area: string }> = {};
    for (const item of items) {
      if (!item.result) continue;
      const key = `${item.section.audit.area}||${item.description}`;
      if (!map[key]) map[key] = { total: 0, fails: 0, area: item.section.audit.area };
      map[key].total++;
      if (item.result === 'FAIL') map[key].fails++;
    }

    const recurrent = Object.entries(map)
      .map(([key, v]) => {
        const [itemArea, description] = key.split('||');
        return { description, area: itemArea, total: v.total, fails: v.fails, failRate: Math.round(v.fails / v.total * 100) };
      })
      .filter(r => r.total >= 2 && r.fails / r.total >= failRate)
      .sort((a, b) => b.failRate - a.failRate);

    res.json({ recurrent });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener reincidencia' });
  }
});

// GET /reports/program-compliance — tasa de cumplimiento del programa
router.get('/reports/program-compliance', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 6, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const audits = await prisma.audit.findMany({
      where: { scheduledAt: { gte: since } },
      select: { status: true, scheduledAt: true, completedAt: true, area: true },
    });

    // Agrupar por mes
    const monthMap: Record<string, { scheduled: number; completed: number }> = {};
    for (const a of audits) {
      const d = new Date(a.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { scheduled: 0, completed: 0 };
      monthMap[key].scheduled++;
      if (['COMPLETED', 'CLOSED'].includes(a.status)) monthMap[key].completed++;
    }

    const rows = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        scheduled: v.scheduled,
        completed: v.completed,
        rate: v.scheduled > 0 ? Math.round(v.completed / v.scheduled * 100) : null,
      }));

    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener cumplimiento del programa' });
  }
});

// ── PATCH /:id — editar datos básicos de auditoría en DRAFT ──────────────────
const editAuditSchema = z.object({
  title:      z.string().min(3).optional(),
  area:       z.string().min(1).optional(),
  scheduledAt: z.string().optional(),
  auditorId:  z.string().optional(),
  notes:      z.string().optional(),
});

router.patch('/:id', async (req, res) => {
  const parsed = editAuditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se pueden editar auditorías en estado BORRADOR' });

    const data: Record<string, unknown> = {};
    if (parsed.data.title)       data.title = parsed.data.title;
    if (parsed.data.area)        data.area = parsed.data.area;
    if (parsed.data.scheduledAt) data.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.auditorId)   data.auditorId = parsed.data.auditorId;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

    const updated = await prisma.audit.update({
      where: { id: req.params.id },
      data,
      include: { auditor: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar auditoría' });
  }
});

// ── PATCH /:id/reschedule — reprogramar auditoría con registro ────────────────
router.patch('/:id/reschedule', async (req, res) => {
  const { scheduledAt, reason } = req.body as { scheduledAt: string; reason?: string };
  if (!scheduledAt) return res.status(400).json({ error: 'Falta nueva fecha' });

  try {
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      select: { status: true, code: true, title: true, area: true, auditorId: true, scheduledAt: true },
    });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (!['DRAFT', 'IN_PROGRESS'].includes(audit.status)) {
      return res.status(409).json({ error: 'Solo se pueden reprogramar auditorías en borrador o en curso' });
    }

    const updated = await prisma.audit.update({
      where: { id: req.params.id },
      data: { scheduledAt: new Date(scheduledAt), notes: reason ? `[Reprogramada] ${reason}` : undefined },
      include: { auditor: { select: { id: true, name: true } } },
    });

    const oldDate = audit.scheduledAt?.toLocaleDateString('es-MX') ?? '—';
    const newDate = new Date(scheduledAt).toLocaleDateString('es-MX');
    sendNotification({
      type: 'AUDIT_REMINDER',
      referenceId: req.params.id,
      userId: audit.auditorId,
      message: `Auditoría ${audit.code} reprogramada: ${oldDate} → ${newDate}${reason ? ` (${reason})` : ''}`,
      link: `/audits/${req.params.id}`,
      emailSubject: `[Reprogramación] Auditoría ${audit.code}`,
      emailHtml: `<p>La auditoría <strong>${audit.title}</strong> (${audit.area}) ha sido reprogramada:</p>
        <ul><li><strong>Fecha anterior:</strong> ${oldDate}</li><li><strong>Nueva fecha:</strong> ${newDate}</li>${reason ? `<li><strong>Motivo:</strong> ${reason}</li>` : ''}</ul>`,
    }).catch(console.error);

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reprogramar auditoría' });
  }
});

// ── POST /:id/items — agregar ítem a sección en DRAFT ────────────────────────
router.post('/:id/items', async (req, res) => {
  const { sectionId, description, weight = 1 } = req.body as { sectionId: string; description: string; weight?: number };
  if (!sectionId || !description) return res.status(400).json({ error: 'Faltan campos requeridos' });

  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se pueden modificar auditorías en BORRADOR' });

    const lastItem = await prisma.auditItem.findFirst({ where: { sectionId }, orderBy: { order: 'desc' }, select: { order: true } });
    const item = await prisma.auditItem.create({
      data: { sectionId, description, weight, order: (lastItem?.order ?? 0) + 1 },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar ítem' });
  }
});

// ── DELETE /:id/items/:itemId — quitar ítem en DRAFT ─────────────────────────
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se pueden modificar auditorías en BORRADOR' });

    await prisma.auditItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar ítem' });
  }
});

// ── Dashboard ampliado con métricas de eficacia ────────────────────────────────
router.get('/reports/efficacy', async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const capas = await prisma.capaAction.findMany({
      select: { status: true, dueDate: true, closedAt: true, severity: true },
    });

    const total    = capas.length;
    const closed   = capas.filter(c => c.status === 'CLOSED');
    const onTime   = closed.filter(c => c.closedAt && c.closedAt <= c.dueDate).length;
    const overdue  = capas.filter(c => c.status !== 'CLOSED' && c.dueDate < now).length;
    const effective = closed.filter(c => c.closedAt && new Date(c.closedAt) < thirtyDaysAgo).length;

    // Programadas vs realizadas (últimos 3 meses)
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const [scheduled, completed] = await Promise.all([
      prisma.audit.count({ where: { scheduledAt: { gte: threeMonthsAgo } } }),
      prisma.audit.count({ where: { scheduledAt: { gte: threeMonthsAgo }, status: { in: ['COMPLETED', 'CLOSED'] } } }),
    ]);

    res.json({
      capaTotal: total,
      capaClosed: closed.length,
      capaOnTime: onTime,
      capaOverdue: overdue,
      capaEffective: effective,
      onTimeRate:   closed.length > 0 ? Math.round(onTime   / closed.length * 100) : null,
      effectiveRate: closed.length > 0 ? Math.round(effective / closed.length * 100) : null,
      programScheduled: scheduled,
      programCompleted: completed,
      programRate: scheduled > 0 ? Math.round(completed / scheduled * 100) : null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener métricas de eficacia' });
  }
});

export default router;

