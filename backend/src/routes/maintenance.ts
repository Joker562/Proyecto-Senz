/**
 * Fase 4 – Fleet Vehicle Maintenance API
 * Montado en: /api/fleet/maintenance
 *
 * Endpoints:
 *   POST  /plan          – Crea un plan preventivo vehicular (reutiliza MaintenancePlan)
 *   GET   /upcoming      – Próximos mantenimientos (30 días o próximos por km)
 *   GET   /:vehicleId    – Historial de OTs de un vehículo (reutiliza WorkOrder)
 *
 * Estrategia de integración con modelos existentes:
 *   • MaintenancePlan y WorkOrder tienen assetId NOT NULL por diseño.
 *   • Para satisfacer esta restricción sin tocar el schema core se crea un
 *     "Asset sombra" por vehículo (code = VEH-{vehicleCode}).
 *   • Los planes vehiculares también almacenan vehicleId en la nueva columna
 *     opcional, lo que permite filtrarlos directamente sin tocar los planes
 *     de activos de planta.
 *
 * NOTA: /upcoming debe declararse ANTES de /:vehicleId.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Tipos de servicio vehicular ─────────────────────────────────────────────

const VEHICLE_SERVICE_TYPES = [
  'OIL_CHANGE',      // Cambio de aceite y filtros
  'TUNE_UP',         // Afinación
  'TIRES',           // Llantas (rotación / cambio)
  'BRAKES',          // Frenos
  'VERIFICATION',    // Verificación vehicular
  'GENERAL_SERVICE', // Servicio general
  'OTHER',
] as const;

type VehicleServiceType = typeof VEHICLE_SERVICE_TYPES[number];

const SERVICE_TYPE_LABELS: Record<VehicleServiceType, string> = {
  OIL_CHANGE:      'Cambio de aceite y filtros',
  TUNE_UP:         'Afinación',
  TIRES:           'Llantas',
  BRAKES:          'Frenos',
  VERIFICATION:    'Verificación vehicular',
  GENERAL_SERVICE: 'Servicio general',
  OTHER:           'Otro',
};

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const CreateMaintenancePlanSchema = z.object({
  vehicleId:   z.string().cuid('vehicleId debe ser un CUID válido'),
  serviceType: z.enum(VEHICLE_SERVICE_TYPES),
  name:        z.string().min(3).max(120).optional(), // si omite, se genera del serviceType
  description: z.string().max(500).optional().nullable(),
  createdById: z.string().cuid('createdById debe ser un CUID válido'),

  // Disparador por tiempo
  frequencyMonths: z.number().int().positive().optional(),
  nextDueDate:     z.string().optional(), // ISO date string

  // Disparador por kilometraje
  kmThreshold:     z.number().positive().optional(), // ej. 10000 = cada 10 000 km
  currentVehicleKm:z.number().min(0).optional(),     // km actuales del vehículo al crear el plan
}).refine(
  data => data.frequencyMonths != null || data.kmThreshold != null,
  { message: 'Se requiere al menos un disparador: frequencyMonths o kmThreshold' },
);

type CreateMaintenancePlanInput = z.infer<typeof CreateMaintenancePlanSchema>;

// ─── Helper: Asset sombra ─────────────────────────────────────────────────────

/**
 * Obtiene o crea el Asset sombra de un vehículo.
 * Permite satisfacer la restricción NOT NULL de assetId en MaintenancePlan y WorkOrder.
 * El asset sombra usa code = "VEH-{vehicle.code}" para ser identificable.
 */
async function getOrCreateVehicleAsset(vehicle: {
  code: string; brand: string; model: string; plate: string; area: string | null;
}) {
  const assetCode = `VEH-${vehicle.code}`;
  return prisma.asset.upsert({
    where:  { code: assetCode },
    update: {},
    create: {
      code:     assetCode,
      name:     `[Flota] ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`,
      location: 'Flota',
      area:     vehicle.area ?? 'Logística',
      status:   'OPERATIONAL',
      model:    vehicle.model,
    },
  });
}

// ─── Helper genérico de validación ───────────────────────────────────────────

function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: object } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.flatten() };
}

// ─── POST /plan ───────────────────────────────────────────────────────────────
/**
 * Crea un plan preventivo vehicular.
 * Admite disparadores por tiempo (frequencyMonths) y/o por km (kmThreshold).
 * Puede configurarse con ambos (triggerType = 'BOTH') o solo uno.
 */
router.post('/plan', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = validate(CreateMaintenancePlanSchema, req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'Validación fallida', details: parsed.error });
  }

  const {
    vehicleId, serviceType, name, description,
    frequencyMonths, nextDueDate, kmThreshold, currentVehicleKm, createdById,
  }: CreateMaintenancePlanInput = parsed.data;

  try {
    // ── 1. Verificar vehículo ──────────────────────────────────────────────
    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, deletedAt: null },
      select: { id: true, code: true, brand: true, model: true, plate: true, area: true, currentKm: true },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado o dado de baja' });
    }

    // ── 2. Asset sombra ────────────────────────────────────────────────────
    const shadowAsset = await getOrCreateVehicleAsset(vehicle);

    // ── 3. Determinar triggerType ──────────────────────────────────────────
    const hasTriggerTime = frequencyMonths != null;
    const hasTriggerKm   = kmThreshold != null;
    const triggerType: 'TIME' | 'USAGE' | 'BOTH' =
      hasTriggerTime && hasTriggerKm ? 'BOTH' :
      hasTriggerKm                   ? 'USAGE' : 'TIME';

    // ── 4. Calcular nextDue (tiempo) ───────────────────────────────────────
    let nextDue: Date | undefined;
    if (hasTriggerTime) {
      if (nextDueDate) {
        nextDue = new Date(nextDueDate);
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + frequencyMonths!);
        nextDue = d;
      }
    }

    // ── 5. Calcular usageThreshold (km) ───────────────────────────────────
    // El umbral absoluto = km actuales + intervalo de km del plan
    const baseKm        = currentVehicleKm ?? vehicle.currentKm;
    const usageThreshold = hasTriggerKm ? baseKm + kmThreshold! : undefined;

    // ── 6. Crear el plan ───────────────────────────────────────────────────
    const planName = name ?? SERVICE_TYPE_LABELS[serviceType];
    const planDesc = description
      ?? `Mantenimiento preventivo: ${SERVICE_TYPE_LABELS[serviceType]} para ${vehicle.brand} ${vehicle.model} [${vehicle.plate}]`;

    const plan = await prisma.maintenancePlan.create({
      data: {
        name:           planName,
        description:    planDesc,
        type:           'PREVENTIVE',
        triggerType,
        // Tiempo
        frequency:      frequencyMonths ?? null,
        frequencyUnit:  hasTriggerTime ? 'months' : null,
        nextDue:        nextDue ?? null,
        // Km
        usageThreshold: usageThreshold ?? null,
        usageUnit:      hasTriggerKm ? 'km' : null,
        // Relaciones
        assetId:        shadowAsset.id,
        vehicleId,
        active:         true,
      },
      include: {
        vehicle: { select: { id: true, code: true, plate: true, brand: true, model: true } },
        asset:   { select: { id: true, code: true, name: true } },
      },
    });

    return res.status(201).json({
      ...plan,
      serviceType,
      serviceTypeLabel: SERVICE_TYPE_LABELS[serviceType],
      triggerSummary: [
        hasTriggerTime ? `Cada ${frequencyMonths} mes(es)` : null,
        hasTriggerKm   ? `Cada ${kmThreshold?.toLocaleString()} km` : null,
      ].filter(Boolean).join(' / '),
    });
  } catch (err: any) {
    console.error('[maintenance POST /plan]', err);
    return res.status(500).json({ error: 'Error al crear plan de mantenimiento vehicular' });
  }
});

// ─── GET /upcoming ────────────────────────────────────────────────────────────
/**
 * Próximos mantenimientos de la flota vehicular.
 * Devuelve planes ordenados por urgencia (más próximos primero).
 *
 * Un plan se considera "próximo" si:
 *   - Tiempo: nextDue está dentro de los próximos 30 días (o ya vencido)
 *   - Km:     currentKm del vehículo supera el 85% del usageThreshold
 *   - BOTH:   alguna de las condiciones anteriores
 */
router.get('/upcoming', async (_req: Request, res: Response) => {
  try {
    const now   = new Date();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Planes vehiculares activos (vehicleId != null)
    const plans = await prisma.maintenancePlan.findMany({
      where: {
        active:    true,
        vehicleId: { not: null },
      },
      include: {
        vehicle: {
          select: {
            id: true, code: true, plate: true, brand: true,
            model: true, currentKm: true, status: true,
          },
        },
        // Verificar si ya existe OT abierta para este plan
        workOrders: {
          where:  { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          select: { id: true, status: true },
          take:   1,
        },
      },
    });

    type UpcomingItem = {
      planId: string;
      planName: string;
      vehicleId: string;
      vehicleCode: string;
      vehiclePlate: string;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleStatus: string;
      currentKm: number;
      triggerType: string;
      // Tiempo
      nextDue: Date | null;
      daysUntilDue: number | null;
      isTimeOverdue: boolean;
      // Km
      usageThreshold: number | null;
      kmRemaining: number | null;
      isKmOverdue: boolean;
      // Urgencia
      urgency: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'OK';
      hasOpenWorkOrder: boolean;
    };

    const upcoming: UpcomingItem[] = [];

    for (const plan of plans) {
      if (!plan.vehicle) continue; // type guard (vehicleId != null garantiza que existe)

      const v           = plan.vehicle;
      const currentKm   = v.currentKm;
      const hasOpenWO   = plan.workOrders.length > 0;

      // ── Análisis tiempo ────────────────────────────────────────────────
      let isTimeDue      = false;
      let isTimeOverdue  = false;
      let daysUntilDue: number | null = null;

      if (plan.nextDue) {
        const msUntilDue = plan.nextDue.getTime() - now.getTime();
        daysUntilDue     = Math.ceil(msUntilDue / 86400000);
        isTimeOverdue    = daysUntilDue < 0;
        isTimeDue        = plan.nextDue <= in30d; // dentro de 30 días o ya vencido
      }

      // ── Análisis km ────────────────────────────────────────────────────
      let isKmDue     = false;
      let isKmOverdue = false;
      let kmRemaining: number | null = null;

      if (plan.usageThreshold != null && plan.usageUnit === 'km') {
        const threshold = plan.usageThreshold;
        kmRemaining     = threshold - currentKm;
        isKmOverdue     = kmRemaining <= 0;
        // "próximo" = faltan ≤ 15 % del umbral o ≤ 1 500 km, lo que sea menor
        const alertKm   = Math.min(threshold * 0.15, 1500);
        isKmDue         = kmRemaining <= alertKm;
      }

      const isDue = isTimeDue || isKmDue;
      if (!isDue) continue; // no es próximo

      // ── Nivel de urgencia ──────────────────────────────────────────────
      const urgency: UpcomingItem['urgency'] =
        isTimeOverdue || isKmOverdue ? 'OVERDUE' :
        (daysUntilDue !== null && daysUntilDue <= 7) || (kmRemaining !== null && kmRemaining <= 500) ? 'CRITICAL' :
        'WARNING';

      upcoming.push({
        planId:          plan.id,
        planName:        plan.name,
        vehicleId:       v.id,
        vehicleCode:     v.code,
        vehiclePlate:    v.plate,
        vehicleBrand:    v.brand,
        vehicleModel:    v.model,
        vehicleStatus:   v.status,
        currentKm,
        triggerType:     plan.triggerType,
        nextDue:         plan.nextDue,
        daysUntilDue,
        isTimeOverdue,
        usageThreshold:  plan.usageThreshold,
        kmRemaining:     kmRemaining !== null ? Number(kmRemaining.toFixed(0)) : null,
        isKmOverdue,
        urgency,
        hasOpenWorkOrder:hasOpenWO,
      });
    }

    // Ordenar: OVERDUE > CRITICAL > WARNING; dentro de cada grupo, por daysUntilDue ASC
    const urgencyOrder = { OVERDUE: 0, CRITICAL: 1, WARNING: 2, OK: 3 };
    upcoming.sort((a, b) => {
      const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (diff !== 0) return diff;
      // Por días restantes (menor primero)
      const aDays = a.daysUntilDue ?? 9999;
      const bDays = b.daysUntilDue ?? 9999;
      return aDays - bDays;
    });

    return res.json({
      total: upcoming.length,
      overdue: upcoming.filter(u => u.urgency === 'OVERDUE').length,
      critical: upcoming.filter(u => u.urgency === 'CRITICAL').length,
      warning: upcoming.filter(u => u.urgency === 'WARNING').length,
      items: upcoming,
    });
  } catch (err) {
    console.error('[maintenance GET /upcoming]', err);
    return res.status(500).json({ error: 'Error al obtener próximos mantenimientos' });
  }
});

// ─── GET /service-types ──────────────────────────────────────────────────────
// Catálogo de tipos de servicio disponibles (debe ir ANTES de /:vehicleId)

router.get('/service-types', (_req: Request, res: Response) => {
  res.json(
    VEHICLE_SERVICE_TYPES.map(t => ({ value: t, label: SERVICE_TYPE_LABELS[t] })),
  );
});

// ─── GET /:vehicleId ─────────────────────────────────────────────────────────
/**
 * Historial completo de Órdenes de Trabajo vinculadas a un vehículo.
 * Filtra por vehicleId en el modelo WorkOrder (columna añadida en Fase 4).
 * Orden: más reciente primero.
 */
router.get('/:vehicleId', async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.params;

    // Verificar vehículo
    const vehicle = await prisma.vehicle.findFirst({
      where:  { id: vehicleId, deletedAt: null },
      select: { id: true, code: true, plate: true, brand: true, model: true, currentKm: true },
    });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const [workOrders, plans] = await Promise.all([
      // OTs directamente vinculadas al vehículo
      prisma.workOrder.findMany({
        where:   { vehicleId },
        include: {
          assignedTo:     { select: { id: true, name: true } },
          createdBy:      { select: { id: true, name: true } },
          maintenancePlan:{ select: { id: true, name: true, triggerType: true } },
          _count:         { select: { comments: true, photos: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Planes activos del vehículo (resumen)
      prisma.maintenancePlan.findMany({
        where:   { vehicleId, active: true },
        select:  {
          id: true, name: true, triggerType: true,
          nextDue: true, usageThreshold: true, usageUnit: true,
          frequency: true, frequencyUnit: true,
        },
        orderBy: { nextDue: 'asc' },
      }),
    ]);

    // Estadísticas rápidas
    const stats = {
      total:       workOrders.length,
      pending:     workOrders.filter(o => o.status === 'PENDING').length,
      inProgress:  workOrders.filter(o => o.status === 'IN_PROGRESS').length,
      completed:   workOrders.filter(o => o.status === 'COMPLETED').length,
      cancelled:   workOrders.filter(o => o.status === 'CANCELLED').length,
    };

    return res.json({
      vehicle,
      stats,
      activePlans:    plans,
      workOrders,
    });
  } catch (err) {
    console.error('[maintenance GET /:vehicleId]', err);
    return res.status(500).json({ error: 'Error al obtener historial de mantenimiento' });
  }
});

export default router;
