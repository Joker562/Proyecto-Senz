/**
 * OEE Routes — /api/oee
 *
 * CRUD:
 *   POST   /                        Crea un OEERecord y calcula A/P/Q/OEE
 *   GET    /                        Lista con filtros (assetId, shift, fechas, área, página)
 *   GET    /summary/plant           OEE global ponderado de la planta
 *   GET    /summary/trend           Serie temporal para gráficas (día o semana)
 *   GET    /summary/asset/:assetId  OEE ponderado de un activo específico
 *   GET    /:id                     Detalle con downtime events
 *   PATCH  /:id                     Actualiza y recalcula OEE
 *   DELETE /:id                     Elimina (ADMIN / SUPERVISOR)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { calcOEEComponents, weightedOEESummary, buildDateRange } from '../services/oee';

const router = Router();
router.use(authenticate);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;

// Schema base sin refinements (permite .partial() en patchSchema)
const baseOEESchema = z.object({
  date:           z.string().datetime({ message: 'date debe ser ISO 8601' }),
  shift:          z.enum(SHIFTS),
  plannedTime:    z.number({ required_error: 'plannedTime es requerido' }).positive('plannedTime debe ser > 0'),
  breakTime:      z.number().min(0, 'breakTime no puede ser negativo').default(0),
  totalCount:     z.number().int().min(0, 'totalCount no puede ser negativo'),
  goodCount:      z.number().int().min(0, 'goodCount no puede ser negativo'),
  idealCycleTime: z.number().positive('idealCycleTime debe ser > 0'),
  notes:          z.string().optional(),
  assetId:        z.string().min(1, 'assetId es requerido'),
  operatorId:     z.string().optional(),
});

const createSchema = baseOEESchema
  .refine(d => d.goodCount <= d.totalCount, {
    message: 'goodCount no puede superar totalCount',
    path: ['goodCount'],
  })
  .refine(d => d.breakTime < d.plannedTime, {
    message: 'breakTime no puede ser mayor o igual a plannedTime',
    path: ['breakTime'],
  });

// assetId inmutable tras crear → se omite del patch
const patchSchema = baseOEESchema
  .omit({ assetId: true })
  .partial()
  .refine(
    d => d.goodCount === undefined || d.totalCount === undefined || d.goodCount <= d.totalCount,
    { message: 'goodCount no puede superar totalCount', path: ['goodCount'] },
  );

// ─── Helper: suma duración de paros de disponibilidad de un registro ─────────

async function getAvailabilityLoss(oeeRecordId: string): Promise<number> {
  const events = await prisma.downtimeEvent.findMany({
    where: { oeeRecordId, lossType: 'AVAILABILITY' },
    select: { duration: true },
  });
  return events.reduce((s, e) => s + (e.duration ?? 0), 0);
}

// ─── Helper: recalcula y persiste OEE para un registro existente ──────────────

async function recalcAndSave(recordId: string) {
  const record = await prisma.oEERecord.findUnique({ where: { id: recordId } });
  if (!record) return;
  const availabilityLossMin = await getAvailabilityLoss(recordId);
  const components = calcOEEComponents({
    plannedTime:        record.plannedTime,
    breakTime:          record.breakTime,
    availabilityLossMin,
    totalCount:         record.totalCount,
    goodCount:          record.goodCount,
    idealCycleTime:     record.idealCycleTime,
  });
  return prisma.oEERecord.update({ where: { id: recordId }, data: components });
}

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { assetId, operatorId, ...data } = parsed.data;

  try {
    // Verificar que el activo existe
    const asset = await prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    // Calcular OEE (sin paros aún — se podrán añadir después vía /downtime)
    const components = calcOEEComponents({
      plannedTime:        data.plannedTime,
      breakTime:          data.breakTime ?? 0,
      availabilityLossMin: 0,
      totalCount:         data.totalCount,
      goodCount:          data.goodCount,
      idealCycleTime:     data.idealCycleTime,
    });

    const record = await prisma.oEERecord.create({
      data: {
        ...data,
        date: new Date(data.date),
        ...components,
        assetId,
        operatorId,
        recordedById: req.user!.userId,
      },
      include: {
        asset:    { select: { id: true, code: true, name: true, area: true } },
        operator: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        downtimeEvents: true,
      },
    });

    res.status(201).json(record);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un registro para este activo, fecha y turno' });
    }
    console.error(e);
    res.status(500).json({ error: 'Error al crear el registro OEE' });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { assetId, shift, startDate, endDate, area, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (assetId) where.assetId = assetId as string;
    if (shift)   where.shift   = shift as string;

    const dateRange = buildDateRange(startDate as string, endDate as string);
    if (dateRange) where.date = dateRange;

    if (area) where.asset = { area: area as string };

    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      prisma.oEERecord.findMany({
        where, skip, take: Number(limit),
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          asset:    { select: { id: true, code: true, name: true, area: true } },
          operator: { select: { id: true, name: true } },
          _count:   { select: { downtimeEvents: true } },
        },
      }),
      prisma.oEERecord.count({ where }),
    ]);

    res.json({ data: records, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener registros OEE' });
  }
});

// ─── GET /summary/plant ───────────────────────────────────────────────────────
// ⚠️ Rutas estáticas ANTES que /:id para que Express no las confunda

router.get('/summary/plant', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, shift, area } = req.query;

    const where: Record<string, unknown> = {};
    if (shift) where.shift = shift as string;
    const dateRange = buildDateRange(startDate as string, endDate as string);
    if (dateRange) where.date = dateRange;
    if (area) where.asset = { area: area as string };

    const records = await prisma.oEERecord.findMany({
      where,
      select: {
        plannedTime: true, breakTime: true,
        availability: true, performance: true, quality: true, oee: true,
        totalCount: true, goodCount: true,
        asset: { select: { area: true } },
      },
    });

    const summary = weightedOEESummary(records);

    // Totales absolutos
    const totalPlannedMin = records.reduce((s, r) => s + r.plannedTime, 0);
    const totalPieces     = records.reduce((s, r) => s + r.totalCount, 0);
    const totalGood       = records.reduce((s, r) => s + r.goodCount, 0);

    // OEE por área (para tabla comparativa)
    const areaMap: Record<string, typeof records> = {};
    for (const r of records) {
      const a = r.asset.area;
      if (!areaMap[a]) areaMap[a] = [];
      areaMap[a].push(r);
    }
    const byArea = Object.entries(areaMap).map(([area, recs]) => ({
      area,
      ...weightedOEESummary(recs),
    })).sort((a, b) => (b.oee ?? 0) - (a.oee ?? 0));

    res.json({
      ...summary,
      totalPlannedHours: Math.round(totalPlannedMin / 60 * 10) / 10,
      totalPieces,
      totalGood,
      totalDefects: totalPieces - totalGood,
      byArea,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al calcular OEE de planta' });
  }
});

// ─── GET /summary/trend ───────────────────────────────────────────────────────

router.get('/summary/trend', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, shift, area, assetId, groupBy = 'day' } = req.query;

    const where: Record<string, unknown> = {};
    if (shift)   where.shift   = shift as string;
    if (assetId) where.assetId = assetId as string;
    const dateRange = buildDateRange(startDate as string, endDate as string);
    if (dateRange) where.date = dateRange;
    if (area) where.asset = { area: area as string };

    const records = await prisma.oEERecord.findMany({
      where,
      orderBy: { date: 'asc' },
      select: {
        date: true, shift: true,
        plannedTime: true, totalCount: true, goodCount: true,
        availability: true, performance: true, quality: true, oee: true,
        asset: { select: { area: true } },
      },
    });

    // Agrupa por día o semana
    const grouped: Record<string, typeof records> = {};
    for (const r of records) {
      let key: string;
      if (groupBy === 'week') {
        const d = new Date(r.date);
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        key = monday.toISOString().slice(0, 10);
      } else {
        key = new Date(r.date).toISOString().slice(0, 10);
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    const trend = Object.entries(grouped).map(([period, recs]) => ({
      period,
      ...weightedOEESummary(recs),
      totalCount: recs.reduce((s, r) => s + r.totalCount, 0),
      goodCount:  recs.reduce((s, r) => s + r.goodCount, 0),
    })).sort((a, b) => a.period.localeCompare(b.period));

    res.json(trend);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al calcular tendencia OEE' });
  }
});

// ─── GET /summary/asset/:assetId ─────────────────────────────────────────────

router.get('/summary/asset/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { startDate, endDate, shift } = req.query;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado' });

    const where: Record<string, unknown> = { assetId };
    if (shift) where.shift = shift as string;
    const dateRange = buildDateRange(startDate as string, endDate as string);
    if (dateRange) where.date = dateRange;

    const [records, recentRecords] = await Promise.all([
      prisma.oEERecord.findMany({
        where,
        select: { plannedTime: true, availability: true, performance: true, quality: true, oee: true, totalCount: true, goodCount: true },
      }),
      prisma.oEERecord.findMany({
        where: { assetId },
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          id: true, date: true, shift: true,
          availability: true, performance: true, quality: true, oee: true,
          totalCount: true, goodCount: true,
          _count: { select: { downtimeEvents: true } },
        },
      }),
    ]);

    const summary = weightedOEESummary(records);

    // OEE por turno para este activo
    const shiftGroups: Record<string, typeof records> = {};
    for (const r of records) {
      const s = (r as unknown as { shift: string }).shift ?? 'UNKNOWN';
      if (!shiftGroups[s]) shiftGroups[s] = [];
      shiftGroups[s].push(r);
    }

    res.json({
      asset: { id: asset.id, code: asset.code, name: asset.name, area: asset.area, status: asset.status },
      ...summary,
      totalPlannedHours: Math.round(records.reduce((s, r) => s + r.plannedTime, 0) / 60 * 10) / 10,
      recentRecords,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al calcular OEE del activo' });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const record = await prisma.oEERecord.findUnique({
      where: { id: req.params.id },
      include: {
        asset:      { select: { id: true, code: true, name: true, area: true, status: true } },
        operator:   { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        downtimeEvents: { orderBy: { startTime: 'asc' } },
      },
    });
    if (!record) return res.status(404).json({ error: 'Registro OEE no encontrado' });
    res.json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener el registro OEE' });
  }
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const existing = await prisma.oEERecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Registro OEE no encontrado' });

    // Mezcla valores actuales con los nuevos para recalcular
    const merged = {
      plannedTime:    parsed.data.plannedTime    ?? existing.plannedTime,
      breakTime:      parsed.data.breakTime      ?? existing.breakTime,
      totalCount:     parsed.data.totalCount     ?? existing.totalCount,
      goodCount:      parsed.data.goodCount      ?? existing.goodCount,
      idealCycleTime: parsed.data.idealCycleTime ?? existing.idealCycleTime,
    };

    // Validación cruzada sobre valores mezclados
    if (merged.goodCount > merged.totalCount) {
      return res.status(400).json({ error: 'goodCount no puede superar totalCount' });
    }

    const availabilityLossMin = await getAvailabilityLoss(req.params.id);
    const components = calcOEEComponents({ ...merged, availabilityLossMin });

    const updateData: Record<string, unknown> = { ...parsed.data, ...components };
    if (parsed.data.date) updateData.date = new Date(parsed.data.date);

    const updated = await prisma.oEERecord.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        asset:      { select: { id: true, code: true, name: true } },
        operator:   { select: { id: true, name: true } },
        downtimeEvents: true,
      },
    });

    res.json(updated);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un registro para ese activo, fecha y turno' });
    }
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar el registro OEE' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.oEERecord.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Registro OEE no encontrado' });

    // Cascade en DB elimina los DowntimeEvents automáticamente
    await prisma.oEERecord.delete({ where: { id: req.params.id } });
    res.json({ message: 'Registro OEE eliminado correctamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar el registro OEE' });
  }
});

export { recalcAndSave };
export default router;
