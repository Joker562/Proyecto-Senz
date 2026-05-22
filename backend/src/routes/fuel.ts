/**
 * Fase 3 – Fleet Fuel API
 * Montado en: /api/fleet/fuel
 *
 * Endpoints:
 *   POST   /             – Registra carga con cálculo de rendimiento y alerta ±20 %
 *   GET    /             – Lista global con filtros (vehicleId, startDate, endDate)
 *   GET    /summary      – Resumen mensual por vehículo (query: month, year)
 *   GET    /:vehicleId   – Historial cronológico de un vehículo específico
 *
 * NOTA: /summary está declarado ANTES de /:vehicleId para que Express no lo
 * resuelva con vehicleId = "summary".
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const CreateFuelLogSchema = z.object({
  vehicleId:     z.string().cuid('vehicleId debe ser un CUID válido'),
  date:          z.string().min(1, 'La fecha es obligatoria'),
  liters:        z.number({ required_error: 'liters es obligatorio' }).positive('Debe ser mayor a 0'),
  pricePerLiter: z.number({ required_error: 'pricePerLiter es obligatorio' }).positive('Debe ser mayor a 0'),
  kmAtFuel:      z.number({ required_error: 'kmAtFuel es obligatorio' }).min(0),
  station:       z.string().max(120).optional().nullable(),
  invoiceNumber: z.string().max(60).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
  /** En producción debería tomarse de req.user.userId; se acepta en body por compatibilidad */
  loggedById:    z.string().cuid('loggedById debe ser un CUID válido'),
});

type CreateFuelLogInput = z.infer<typeof CreateFuelLogSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: object } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.flatten() };
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Dado un array de logs ordenados por kmAtFuel ASC pertenecientes a UN vehículo,
 * devuelve un mapa { id → rendimiento (km/L) | null }.
 * El primer registro siempre tiene null (no hay referencia anterior).
 */
function buildRendimientoMap(
  sortedLogs: { id: string; kmAtFuel: number; liters: number }[],
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (let i = 0; i < sortedLogs.length; i++) {
    if (i === 0) { map.set(sortedLogs[i].id, null); continue; }
    const curr = sortedLogs[i];
    const prev = sortedLogs[i - 1];
    const kmDiff = curr.kmAtFuel - prev.kmAtFuel;
    map.set(
      curr.id,
      kmDiff > 0 && curr.liters > 0
        ? Number((kmDiff / curr.liters).toFixed(3))
        : null,
    );
  }
  return map;
}

// ─── POST / ───────────────────────────────────────────────────────────────────
/**
 * Registra una carga de combustible con la siguiente lógica secuencial:
 *  1. Verifica que el vehículo existe.
 *  2. totalCost = liters × pricePerLiter (calculado siempre en backend).
 *  3. Encuentra el FuelLog inmediatamente anterior (por kmAtFuel < actual).
 *  4. Calcula rendimiento de esta carga: (kmActual - kmAnterior) / liters.
 *  5. Calcula promedio histórico de rendimiento del vehículo.
 *  6. Si la desviación es ≥ 20 %, agrega [ALERTA] en notes.
 *  7. Persiste el FuelLog e incluye rendimiento en la respuesta.
 */
router.post('/', async (req: Request, res: Response) => {
  const parsed = validate(CreateFuelLogSchema, req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'Validación fallida', details: parsed.error });
  }

  const {
    vehicleId, liters, pricePerLiter, kmAtFuel, notes, date, ...rest
  }: CreateFuelLogInput = parsed.data;

  try {
    // ── 1. Verificar vehículo ──────────────────────────────────────────────
    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, deletedAt: null },
      select: { id: true, code: true, plate: true },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado o dado de baja' });
    }

    // ── 2. Costo total (regla de negocio) ─────────────────────────────────
    const totalCost = Number((liters * pricePerLiter).toFixed(2));

    // ── 3. Log anterior + todos los logs históricos (en paralelo) ─────────
    const [previousLog, historicalLogs] = await Promise.all([
      prisma.fuelLog.findFirst({
        where:   { vehicleId, kmAtFuel: { lt: kmAtFuel } },
        orderBy: { kmAtFuel: 'desc' },
        select:  { id: true, kmAtFuel: true },
      }),
      prisma.fuelLog.findMany({
        where:   { vehicleId },
        select:  { id: true, kmAtFuel: true, liters: true },
        orderBy: { kmAtFuel: 'asc' },
      }),
    ]);

    // ── 4. Rendimiento de esta carga ───────────────────────────────────────
    let rendimiento: number | null = null;
    let notesWithAlert = notes ?? null;

    if (previousLog && kmAtFuel > previousLog.kmAtFuel) {
      const kmRecorridos = kmAtFuel - previousLog.kmAtFuel;
      rendimiento = Number((kmRecorridos / liters).toFixed(3));

      // ── 5. Promedio histórico (pares consecutivos) ─────────────────────
      const histRendimientos = buildRendimientoMap(historicalLogs);
      const histValues = [...histRendimientos.values()].filter(
        (v): v is number => v !== null && v > 0,
      );
      const avgRendimiento = histValues.length > 0 ? mean(histValues) : null;

      // ── 6. Alerta ±20 % ───────────────────────────────────────────────
      if (avgRendimiento !== null && avgRendimiento > 0) {
        const desviacion = Math.abs(rendimiento - avgRendimiento) / avgRendimiento;
        if (desviacion >= 0.20) {
          const flecha   = rendimiento > avgRendimiento ? '▲' : '▼';
          const pct      = (desviacion * 100).toFixed(1);
          const alertMsg =
            `[ALERTA] ${flecha} Rendimiento anormal: ` +
            `${rendimiento.toFixed(2)} km/l vs promedio ${avgRendimiento.toFixed(2)} km/l` +
            ` (${pct}% de desviación)`;
          notesWithAlert = notesWithAlert
            ? `${alertMsg}\n---\n${notesWithAlert}`
            : alertMsg;
        }
      }
    }

    // ── 7. Persistir ───────────────────────────────────────────────────────
    const fuelLog = await prisma.fuelLog.create({
      data: {
        ...rest,
        vehicleId,
        date:          new Date(date),
        liters,
        pricePerLiter,
        totalCost,
        kmAtFuel,
        notes:         notesWithAlert,
      },
      include: {
        vehicle:  { select: { id: true, code: true, plate: true, brand: true, model: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      ...fuelLog,
      /** Campo calculado dinámicamente; no existe en el schema de la BD */
      rendimiento,
      hasAlert: notesWithAlert?.startsWith('[ALERTA]') ?? false,
    });
  } catch (err: any) {
    if (err.code === 'P2003') {
      return res.status(404).json({ error: 'Usuario registrador no encontrado' });
    }
    console.error('[fuel POST]', err);
    return res.status(500).json({ error: 'Error al registrar carga de combustible' });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────
/**
 * Lista global de registros de combustible.
 * Query params opcionales: vehicleId, startDate (ISO), endDate (ISO).
 * Cada registro incluye el campo dinámico `rendimiento`.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { vehicleId, startDate, endDate } = req.query;

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate)   dateFilter.lte = new Date(String(endDate));

    const where: Record<string, unknown> = {};
    if (vehicleId)                        where.vehicleId = String(vehicleId);
    if (Object.keys(dateFilter).length)   where.date      = dateFilter;

    const logs = await prisma.fuelLog.findMany({
      where,
      include: {
        vehicle:  { select: { id: true, code: true, plate: true, brand: true, model: true } },
        loggedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // ── Calcula rendimiento por vehículo en una sola pasada ───────────────
    // Agrupa todos los logs por vehicleId y los ordena por kmAtFuel ASC
    const byVehicle = new Map<
      string,
      { id: string; kmAtFuel: number; liters: number }[]
    >();
    for (const l of logs) {
      (byVehicle.get(l.vehicleId) ?? (() => {
        const arr: { id: string; kmAtFuel: number; liters: number }[] = [];
        byVehicle.set(l.vehicleId, arr);
        return arr;
      })()).push({ id: l.id, kmAtFuel: l.kmAtFuel, liters: l.liters });
    }

    const globalRendMap = new Map<string, number | null>();
    byVehicle.forEach(vehicleLogs => {
      const sorted = [...vehicleLogs].sort((a, b) => a.kmAtFuel - b.kmAtFuel);
      buildRendimientoMap(sorted).forEach((v, k) => globalRendMap.set(k, v));
    });

    const enriched = logs.map(l => ({
      ...l,
      rendimiento: globalRendMap.get(l.id) ?? null,
    }));

    return res.json(enriched);
  } catch (err) {
    console.error('[fuel GET /]', err);
    return res.status(500).json({ error: 'Error al obtener registros de combustible' });
  }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
/**
 * Resumen mensual de consumo por vehículo.
 * Query params: month (1-12), year (YYYY) — por defecto el mes actual.
 *
 * Por vehículo retorna:
 *   vehicleId, code, plate, brand, model,
 *   totalLiters, totalCost, totalKm, costPerKm (totalCost / totalKm)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const now   = new Date();
    const month = parseInt(String(req.query.month ?? now.getMonth() + 1), 10);
    const year  = parseInt(String(req.query.year  ?? now.getFullYear()), 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'month debe ser un número entre 1 y 12' });
    }
    if (isNaN(year) || year < 2000) {
      return res.status(400).json({ error: 'year debe ser un número válido (ej. 2025)' });
    }

    const periodStart = new Date(year, month - 1, 1);
    // último instante del mes
    const periodEnd   = new Date(year, month, 0, 23, 59, 59, 999);

    // ── Consultas en paralelo ─────────────────────────────────────────────
    const [fuelLogs, tripLogs] = await Promise.all([
      prisma.fuelLog.findMany({
        where:   { date: { gte: periodStart, lte: periodEnd } },
        include: {
          vehicle: { select: { id: true, code: true, plate: true, brand: true, model: true } },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.tripLog.findMany({
        where: {
          status:    'COMPLETED',
          startTime: { gte: periodStart, lte: periodEnd },
          distance:  { not: null },
        },
        select: { vehicleId: true, distance: true },
      }),
    ]);

    // ── Agregación de combustible por vehículo ────────────────────────────
    type VehicleInfo = {
      id: string; code: string; plate: string; brand: string; model: string;
    };
    const fuelByVehicle = new Map<
      string,
      { info: VehicleInfo; totalLiters: number; totalCost: number }
    >();

    for (const log of fuelLogs) {
      const v = log.vehicle;
      const entry = fuelByVehicle.get(v.id);
      if (entry) {
        entry.totalLiters += log.liters;
        entry.totalCost   += log.totalCost;
      } else {
        fuelByVehicle.set(v.id, {
          info:        { id: v.id, code: v.code, plate: v.plate, brand: v.brand, model: v.model },
          totalLiters: log.liters,
          totalCost:   log.totalCost,
        });
      }
    }

    // ── Agregación de km por vehículo ─────────────────────────────────────
    const kmByVehicle = new Map<string, number>();
    for (const trip of tripLogs) {
      if (trip.distance == null) continue;
      kmByVehicle.set(
        trip.vehicleId,
        (kmByVehicle.get(trip.vehicleId) ?? 0) + trip.distance,
      );
    }

    // ── Construir respuesta ───────────────────────────────────────────────
    const vehicles = [...fuelByVehicle.entries()].map(([vid, agg]) => {
      const totalKm   = kmByVehicle.get(vid) ?? 0;
      const costPerKm = totalKm > 0
        ? Number((agg.totalCost / totalKm).toFixed(4))
        : null;

      return {
        vehicleId:   vid,
        ...agg.info,
        totalLiters: Number(agg.totalLiters.toFixed(2)),
        totalCost:   Number(agg.totalCost.toFixed(2)),
        totalKm:     Number(totalKm.toFixed(2)),
        costPerKm,
      };
    });

    vehicles.sort((a, b) => b.totalCost - a.totalCost);

    return res.json({
      period: {
        month,
        year,
        label: `${year}-${String(month).padStart(2, '0')}`,
        from:  periodStart.toISOString(),
        to:    periodEnd.toISOString(),
      },
      vehicles,
      totals: {
        totalLiters: Number(vehicles.reduce((s, v) => s + v.totalLiters, 0).toFixed(2)),
        totalCost:   Number(vehicles.reduce((s, v) => s + v.totalCost, 0).toFixed(2)),
        totalKm:     Number(vehicles.reduce((s, v) => s + v.totalKm, 0).toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[fuel GET /summary]', err);
    return res.status(500).json({ error: 'Error al generar resumen de combustible' });
  }
});

// ─── GET /:vehicleId ─────────────────────────────────────────────────────────
/**
 * Historial completo de cargas de combustible de un vehículo.
 * Ordena de la más reciente a la más antigua.
 * Enriquece cada registro con `rendimiento` (km/L calculado dinámicamente).
 */
router.get('/:vehicleId', async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, deletedAt: null },
      select: {
        id: true, code: true, plate: true,
        brand: true, model: true, currentKm: true,
      },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const logs = await prisma.fuelLog.findMany({
      where:   { vehicleId },
      include: { loggedBy: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });

    // Calcula rendimiento por pares consecutivos (orden ASC por kmAtFuel)
    const sortedAsc = [...logs]
      .sort((a, b) => a.kmAtFuel - b.kmAtFuel)
      .map(l => ({ id: l.id, kmAtFuel: l.kmAtFuel, liters: l.liters }));

    const rendMap = buildRendimientoMap(sortedAsc);

    // Promedio histórico del vehículo
    const rendValues = [...rendMap.values()].filter(
      (v): v is number => v !== null && v > 0,
    );
    const avgRendimiento = rendValues.length > 0
      ? Number(mean(rendValues).toFixed(3))
      : null;

    // Enriquece en el orden original (DESC por fecha)
    const enriched = logs.map(l => ({
      ...l,
      rendimiento: rendMap.get(l.id) ?? null,
    }));

    return res.json({
      vehicle,
      avgRendimiento,
      totalRegistros: logs.length,
      logs: enriched,
    });
  } catch (err) {
    console.error('[fuel GET /:vehicleId]', err);
    return res.status(500).json({ error: 'Error al obtener historial de combustible' });
  }
});

export default router;
