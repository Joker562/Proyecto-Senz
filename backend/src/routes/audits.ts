import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../services/upload';
import path from 'path';
import fs from 'fs';

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
  why1: z.string().optional(),
  why2: z.string().optional(),
  why3: z.string().optional(),
  why4: z.string().optional(),
  why5: z.string().optional(),
  ishikawaMachine:     z.string().optional(),
  ishikawaMethod:      z.string().optional(),
  ishikawaMaterial:    z.string().optional(),
  ishikawaManpower:    z.string().optional(),
  ishikawaEnvironment: z.string().optional(),
  ishikawaMeasurement: z.string().optional(),
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
        photos: true,
      },
    });
    res.json(capa);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar acción CAPA' });
  }
});

// ── GET /capa/:id ──────────────────────────────────────────────────────────────
router.get('/capa/:id', async (req, res) => {
  try {
    const capa = await prisma.capaAction.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy:  { select: { id: true, name: true } },
        audit:      { select: { id: true, code: true, title: true, area: true, type: true } },
        auditItem:  { select: { id: true, description: true } },
        photos: true,
      },
    });
    if (!capa) return res.status(404).json({ error: 'CAPA no encontrada' });
    res.json(capa);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener CAPA' });
  }
});

// ── POST /capa/:id/photos ──────────────────────────────────────────────────────
router.post('/capa/:id/photos', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No se recibieron archivos' });

    const photos = await Promise.all(files.map(f =>
      prisma.capaPhoto.create({
        data: {
          capaId: req.params.id,
          filename: f.filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
        },
      })
    ));
    res.status(201).json(photos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
});

// ── DELETE /capa/photos/:photoId ───────────────────────────────────────────────
router.delete('/capa/photos/:photoId', async (req, res) => {
  try {
    const photo = await prisma.capaPhoto.findUnique({ where: { id: req.params.photoId } });
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });
    const filePath = path.join(process.cwd(), 'uploads', photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.capaPhoto.delete({ where: { id: req.params.photoId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar foto' });
  }
});

// ── PATCH /:id/metadata (solo DRAFT) ──────────────────────────────────────────
const metadataSchema = z.object({
  title:      z.string().min(3).optional(),
  area:       z.string().min(1).optional(),
  scheduledAt: z.string().optional(),
  auditorId:  z.string().optional(),
  notes:      z.string().optional(),
});

router.patch('/:id/metadata', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se puede editar en estado DRAFT' });

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.scheduledAt) data.scheduledAt = new Date(parsed.data.scheduledAt);

    const updated = await prisma.audit.update({
      where: { id: req.params.id },
      data,
      include: { auditor: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar metadata' });
  }
});

// ── POST /:id/sections/:sectionId/items (solo DRAFT) ──────────────────────────
router.post('/:id/sections/:sectionId/items', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const { description, weight } = req.body;
  if (!description) return res.status(400).json({ error: 'Descripción requerida' });

  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se puede editar en estado DRAFT' });

    const lastItem = await prisma.auditItem.findFirst({
      where: { sectionId: req.params.sectionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const item = await prisma.auditItem.create({
      data: {
        sectionId: req.params.sectionId,
        description,
        weight: weight ?? 1,
        order: (lastItem?.order ?? 0) + 1,
      },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar ítem' });
  }
});

// ── DELETE /:id/items/:itemId (solo DRAFT) ────────────────────────────────────
router.delete('/:id/items/:itemId', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  try {
    const audit = await prisma.audit.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status !== 'DRAFT') return res.status(409).json({ error: 'Solo se puede editar en estado DRAFT' });

    await prisma.auditItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar ítem' });
  }
});

// ── GET /calendar ──────────────────────────────────────────────────────────────
router.get('/calendar', async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.scheduledAt = {};
      if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from);
      if (to)   (where.scheduledAt as Record<string, unknown>).lte = new Date(to);
    }

    const audits = await prisma.audit.findMany({
      where,
      select: {
        id: true, code: true, title: true, area: true, type: true,
        status: true, scheduledAt: true,
        auditor: { select: { id: true, name: true } },
        _count: { select: { capaActions: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Detectar conflictos: mismo auditor, mismo día
    const conflictMap: Record<string, boolean> = {};
    const auditorDayMap: Record<string, string[]> = {};
    for (const a of audits) {
      const key = `${a.auditor.id}_${a.scheduledAt.toISOString().slice(0, 10)}`;
      if (!auditorDayMap[key]) auditorDayMap[key] = [];
      auditorDayMap[key].push(a.id);
    }
    for (const ids of Object.values(auditorDayMap)) {
      if (ids.length > 1) ids.forEach(id => { conflictMap[id] = true; });
    }

    const result = audits.map(a => ({ ...a, hasConflict: !!conflictMap[a.id] }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener calendario de auditorías' });
  }
});

// ── PATCH /:id/reschedule ──────────────────────────────────────────────────────
const rescheduleSchema = z.object({
  scheduledAt: z.string(),
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});

router.patch('/:id/reschedule', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const audit = await prisma.audit.findUnique({
      where: { id: req.params.id },
      select: { scheduledAt: true, status: true },
    });
    if (!audit) return res.status(404).json({ error: 'Auditoría no encontrada' });
    if (audit.status === 'CLOSED') return res.status(409).json({ error: 'No se puede reprogramar una auditoría cerrada' });

    const newDate = new Date(parsed.data.scheduledAt);

    await prisma.$transaction([
      prisma.auditRescheduleLog.create({
        data: {
          auditId: req.params.id,
          oldDate: audit.scheduledAt,
          newDate,
          reason: parsed.data.reason,
          changedById: (req as any).user.userId,
        },
      }),
      prisma.audit.update({
        where: { id: req.params.id },
        data: { scheduledAt: newDate },
      }),
    ]);

    const updated = await prisma.audit.findUnique({
      where: { id: req.params.id },
      include: { auditor: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al reprogramar auditoría' });
  }
});

// ── GET /:id/reschedule-history ────────────────────────────────────────────────
router.get('/:id/reschedule-history', async (req, res) => {
  try {
    const logs = await prisma.auditRescheduleLog.findMany({
      where: { auditId: req.params.id },
      include: { changedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener historial de reprogramaciones' });
  }
});

// ── GET /analytics/trend ───────────────────────────────────────────────────────
router.get('/analytics/trend', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months as string) || 6, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1);
    since.setDate(1); since.setHours(0, 0, 0, 0);

    const audits = await prisma.audit.findMany({
      where: { status: { in: ['COMPLETED', 'CLOSED'] }, completedAt: { gte: since }, score: { not: null } },
      select: { area: true, score: true, completedAt: true },
      orderBy: { completedAt: 'asc' },
    });

    const areas = [...new Set(audits.map(a => a.area))].sort();
    const monthMap: Record<string, Record<string, number[]>> = {};

    for (const a of audits) {
      if (!a.completedAt || a.score === null) continue;
      const d = new Date(a.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = {};
      if (!monthMap[key][a.area]) monthMap[key][a.area] = [];
      monthMap[key][a.area].push(a.score);
    }

    const rows = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, areaScores]) => {
        const entry: Record<string, unknown> = { month };
        for (const area of areas) {
          const scores = areaScores[area];
          entry[area] = scores ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : null;
        }
        return entry;
      });

    res.json({ rows, areas });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener tendencia' });
  }
});

// ── GET /analytics/recurrence ──────────────────────────────────────────────────
// Detecta ítems que han fallado en las últimas 3 auditorías de la misma área
router.get('/analytics/recurrence', async (req, res) => {
  try {
    const items = await prisma.auditItem.findMany({
      where: { result: 'FAIL' },
      include: {
        section: {
          include: {
            audit: { select: { area: true, completedAt: true, status: true } },
          },
        },
      },
      orderBy: { section: { audit: { completedAt: 'desc' } } },
    });

    // Agrupar por área + descripción normalizada
    const map: Record<string, { area: string; description: string; failCount: number; lastFail: string | null }> = {};
    for (const item of items) {
      const area = item.section.audit.area;
      const key = `${area}::${item.description.trim().toLowerCase()}`;
      if (!map[key]) map[key] = { area, description: item.description, failCount: 0, lastFail: null };
      map[key].failCount++;
      const at = item.section.audit.completedAt?.toISOString() ?? null;
      if (at && (!map[key].lastFail || at > map[key].lastFail!)) map[key].lastFail = at;
    }

    const recurrent = Object.values(map)
      .filter(r => r.failCount >= 3)
      .sort((a, b) => b.failCount - a.failCount);

    res.json(recurrent);
  } catch (e) {
    res.status(500).json({ error: 'Error al calcular reincidencias' });
  }
});

// ── GET /analytics/efficacy ────────────────────────────────────────────────────
router.get('/analytics/efficacy', async (req, res) => {
  try {
    const capas = await prisma.capaAction.findMany({
      select: { status: true, dueDate: true, closedAt: true, createdAt: true, updatedAt: true },
    });

    const now = new Date();
    const total = capas.length;
    const closed = capas.filter(c => c.status === 'CLOSED');
    const closedOnTime = closed.filter(c => c.closedAt && new Date(c.closedAt) <= new Date(c.dueDate));
    const effective = closed.filter(c => {
      if (!c.closedAt) return false;
      const daysSinceClosed = (now.getTime() - new Date(c.closedAt).getTime()) / 86400000;
      return daysSinceClosed >= 30;
    });

    res.json({
      total,
      closed: closed.length,
      closedOnTime: closedOnTime.length,
      pctOnTime: closed.length > 0 ? Math.round(closedOnTime.length / closed.length * 100) : 0,
      effective: effective.length,
      pctEfficacy: effective.length > 0
        ? Math.round(effective.length / closed.filter(c => {
            if (!c.closedAt) return false;
            return (now.getTime() - new Date(c.closedAt).getTime()) / 86400000 >= 30;
          }).length * 100)
        : 0,
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al calcular eficacia' });
  }
});

// ── GET /analytics/upcoming ────────────────────────────────────────────────────
router.get('/analytics/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);

    const [upcoming, overdueCapas, recentScores] = await Promise.all([
      prisma.audit.findMany({
        where: { scheduledAt: { gte: now, lte: in7 }, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
        include: { auditor: { select: { id: true, name: true } } },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.capaAction.count({
        where: { status: { not: 'CLOSED' }, dueDate: { lt: now } },
      }),
      prisma.audit.findMany({
        where: {
          status: { in: ['COMPLETED', 'CLOSED'] },
          completedAt: { gte: new Date(now.getTime() - 7 * 86400000) },
          score: { not: null },
        },
        select: { score: true },
      }),
    ]);

    const scores = recentScores.map(a => a.score as number);
    const avgScoreWeek = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10
      : null;

    res.json({ upcoming, overdueCapas, avgScoreWeek });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener datos de próximas auditorías' });
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

