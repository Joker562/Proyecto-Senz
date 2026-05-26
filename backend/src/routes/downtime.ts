/**
 * Downtime Routes — /api/downtime
 *
 * CRUD de eventos de paro de producción.
 * Al cerrar un evento (PATCH con endTime) se calcula duration automáticamente
 * y se recalcula el OEE del OEERecord padre.
 *
 *   POST   /          Abre un nuevo paro
 *   GET    /          Lista con filtros
 *   GET    /:id       Detalle de un paro
 *   PATCH  /:id       Actualiza / cierra el paro (recalcula OEE padre)
 *   DELETE /:id       Elimina (ADMIN / SUPERVISOR, también recalcula OEE)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { recalcAndSave } from './oee';

const router = Router();
router.use(authenticate);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CATEGORIES  = ['PLANNED', 'UNPLANNED', 'SETUP', 'MINOR_STOP'] as const;
const LOSS_TYPES  = ['AVAILABILITY', 'PERFORMANCE', 'QUALITY']       as const;

const createSchema = z.object({
  startTime:   z.string().datetime({ message: 'startTime debe ser ISO 8601' }),
  endTime:     z.string().datetime({ message: 'endTime debe ser ISO 8601' }).optional(),
  category:    z.enum(CATEGORIES),
  lossType:    z.enum(LOSS_TYPES),
  reason:      z.string().min(3, 'reason debe tener al menos 3 caracteres'),
  notes:       z.string().optional(),
  oeeRecordId: z.string().min(1, 'oeeRecordId es requerido'),
  assetId:     z.string().min(1, 'assetId es requerido'),
}).refine(d => {
  if (!d.endTime) return true;
  return new Date(d.endTime) > new Date(d.startTime);
}, { message: 'endTime debe ser posterior a startTime', path: ['endTime'] });

const patchSchema = z.object({
  endTime:   z.string().datetime().optional(),
  category:  z.enum(CATEGORIES).optional(),
  lossType:  z.enum(LOSS_TYPES).optional(),
  reason:    z.string().min(3).optional(),
  notes:     z.string().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'Envía al menos un campo para actualizar' });

// ─── Helper: calcula duración en minutos entre dos fechas ─────────────────────

function durationMinutes(start: Date, end: Date): number {
  return Math.round(((end.getTime() - start.getTime()) / 60_000) * 10) / 10;
}

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { oeeRecordId, assetId, startTime, endTime, ...rest } = parsed.data;

  try {
    // Verificar que el OEERecord existe
    const oeeRecord = await prisma.oEERecord.findUnique({ where: { id: oeeRecordId } });
    if (!oeeRecord) return res.status(404).json({ error: 'OEERecord no encontrado' });

    // Verificar consistencia: el assetId debe coincidir con el del OEERecord
    if (oeeRecord.assetId !== assetId) {
      return res.status(400).json({ error: 'El assetId no coincide con el del OEERecord indicado' });
    }

    // Calcular duration si se proporciona endTime
    const startDt = new Date(startTime);
    const endDt   = endTime ? new Date(endTime) : undefined;
    const duration = endDt ? durationMinutes(startDt, endDt) : null;

    const event = await prisma.downtimeEvent.create({
      data: {
        ...rest,
        startTime: startDt,
        endTime:   endDt,
        duration,
        oeeRecordId,
        assetId,
        reportedById: req.user!.userId,
      },
      include: {
        oeeRecord: { select: { id: true, date: true, shift: true } },
        asset:     { select: { id: true, code: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
    });

    // Recalcular OEE del registro padre (nuevo paro puede afectar availability)
    await recalcAndSave(oeeRecordId);

    res.status(201).json(event);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear el evento de paro' });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { oeeRecordId, assetId, category, lossType, open, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {};
    if (oeeRecordId) where.oeeRecordId = oeeRecordId as string;
    if (assetId)     where.assetId     = assetId as string;
    if (category)    where.category    = category as string;
    if (lossType)    where.lossType    = lossType as string;
    // Filtro de paros abiertos (sin endTime)
    if (open === 'true')  where.endTime = null;
    if (open === 'false') where.endTime = { not: null };

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      prisma.downtimeEvent.findMany({
        where, skip, take: Number(limit),
        orderBy: { startTime: 'desc' },
        include: {
          asset:      { select: { id: true, code: true, name: true } },
          reportedBy: { select: { id: true, name: true } },
          oeeRecord:  { select: { id: true, date: true, shift: true } },
        },
      }),
      prisma.downtimeEvent.count({ where }),
    ]);

    res.json({ data: events, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener eventos de paro' });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await prisma.downtimeEvent.findUnique({
      where: { id: req.params.id },
      include: {
        asset:      { select: { id: true, code: true, name: true, area: true } },
        reportedBy: { select: { id: true, name: true } },
        oeeRecord:  {
          select: {
            id: true, date: true, shift: true,
            availability: true, performance: true, quality: true, oee: true,
          },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Evento de paro no encontrado' });
    res.json(event);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener el evento de paro' });
  }
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const existing = await prisma.downtimeEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Evento de paro no encontrado' });

    // Si ya estaba cerrado y no se envía nuevo endTime, mantener el existente
    const updateData: Record<string, unknown> = { ...parsed.data };

    if (parsed.data.endTime) {
      const startDt = existing.startTime;
      const endDt   = new Date(parsed.data.endTime);

      if (endDt <= startDt) {
        return res.status(400).json({ error: 'endTime debe ser posterior a startTime' });
      }

      updateData.endTime  = endDt;
      updateData.duration = durationMinutes(startDt, endDt);
    }

    const updated = await prisma.downtimeEvent.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        asset:      { select: { id: true, code: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
        oeeRecord:  { select: { id: true, date: true, shift: true } },
      },
    });

    // Recalcular OEE del registro padre (duration o lossType cambiaron)
    await recalcAndSave(existing.oeeRecordId);

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar el evento de paro' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.downtimeEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Evento de paro no encontrado' });

    const { oeeRecordId } = existing;
    await prisma.downtimeEvent.delete({ where: { id: req.params.id } });

    // Recalcular OEE sin este paro
    await recalcAndSave(oeeRecordId);

    res.json({ message: 'Evento de paro eliminado y OEE recalculado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar el evento de paro' });
  }
});

export default router;
