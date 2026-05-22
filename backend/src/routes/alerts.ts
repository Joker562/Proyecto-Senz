/**
 * Fase 6 – Fleet Alerts API
 * Montado en: /api/fleet/alerts
 *
 * Endpoints:
 *   GET   /    – Alertas activas de la flota (generadas dinámicamente)
 *   PATCH /:id/acknowledge – Marca una alerta como leída para el usuario autenticado
 *
 * Estrategia de persistencia:
 *   Las alertas son dinámicas (calculadas en cada request).
 *   Los "acknowledgements" se almacenan en el modelo Notification existente:
 *     type       = 'FLEET_ALERT'
 *     referenceId= alertId  (formato: "doc:{vehicleId}" | "maint:{vehicleId}:{planId}" | "fuel:{vehicleId}")
 *     userId     = req.user!.userId
 *     read       = true
 *   El GET filtra las alertas ya reconocidas por el usuario autenticado.
 *
 * Tipos de alerta:
 *   DOC   – Documento del vehículo vencido o por vencer (≤ 15 días)
 *   MAINT – Plan de mantenimiento vehicular vencido sin OT completada
 *   FUEL  – Último FuelLog del vehículo tiene bandera [ALERTA] por rendimiento anormal
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Tipos internos ───────────────────────────────────────────────────────────

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

interface FleetAlert {
  id:          string;          // "doc:{vehicleId}" | "maint:{vehicleId}:{planId}" | "fuel:{vehicleId}"
  type:        'DOC' | 'MAINT' | 'FUEL';
  severity:    AlertSeverity;
  vehicleId:   string;
  vehicleCode: string;
  vehiclePlate:string;
  title:       string;
  message:     string;
  /** Fecha del evento que origina la alerta (vencimiento, generación del plan, etc.) */
  triggeredAt: Date | null;
  /** Campo extra para documentos: qué campo del vehículo disparó la alerta */
  field?:      string;
  /** Extra para mantenimiento: plan y OT relacionados */
  planId?:     string;
  planName?:   string;
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const now    = new Date();
    const in15d  = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    // ── Consultas en paralelo ─────────────────────────────────────────────
    const [vehicles, overduePlans, ackSet] = await Promise.all([
      // Vehículos activos con sus documentos y último FuelLog
      prisma.vehicle.findMany({
        where: { deletedAt: null },
        select: {
          id: true, code: true, plate: true, brand: true, model: true,
          insuranceExpiry:    true,
          verificationExpiry: true,
          licenseExpiry:      true,
          circulationCard:    true,
          fuelLogs: {
            orderBy: { kmAtFuel: 'desc' },
            take:    1,
            select:  { id: true, notes: true, date: true },
          },
        },
      }),

      // Planes vehiculares activos sin OT completada
      prisma.maintenancePlan.findMany({
        where: {
          active:    true,
          vehicleId: { not: null },
          OR: [
            { nextDue: { lte: now } },                        // tiempo vencido
            { usageThreshold: { not: null } },                // verificaremos km en JS
          ],
        },
        include: {
          vehicle: {
            select: { id: true, code: true, plate: true, brand: true, model: true, currentKm: true },
          },
          workOrders: {
            where:  { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            select: { id: true, status: true },
            take:   1,
          },
        },
      }),

      // IDs de alertas ya reconocidas por este usuario
      prisma.notification.findMany({
        where: { type: 'FLEET_ALERT', userId, read: true },
        select: { referenceId: true },
      }).then(rows => new Set(rows.map(r => r.referenceId))),
    ]);

    const alerts: FleetAlert[] = [];

    // ── 1. Alertas de documentos ──────────────────────────────────────────
    const DOC_FIELDS: Array<{ key: keyof typeof vehicles[0]; label: string }> = [
      { key: 'insuranceExpiry',    label: 'Seguro vehicular'      },
      { key: 'verificationExpiry', label: 'Verificación vehicular' },
      { key: 'licenseExpiry',      label: 'Licencia'              },
      { key: 'circulationCard',    label: 'Tarjeta de circulación' },
    ];

    for (const v of vehicles) {
      for (const { key, label } of DOC_FIELDS) {
        const expiry = v[key] as Date | null;
        if (!expiry) continue;

        const msLeft    = expiry.getTime() - now.getTime();
        const daysLeft  = Math.ceil(msLeft / 86400000);
        const isExpired = daysLeft < 0;
        const isSoon    = daysLeft >= 0 && expiry <= in15d;

        if (!isExpired && !isSoon) continue;

        const alertId = `doc:${v.id}:${key}`;
        if (ackSet.has(alertId)) continue;   // reconocida por este usuario

        alerts.push({
          id:           alertId,
          type:         'DOC',
          severity:     isExpired ? 'CRITICAL' : daysLeft <= 5 ? 'CRITICAL' : 'WARNING',
          vehicleId:    v.id,
          vehicleCode:  v.code,
          vehiclePlate: v.plate,
          title:        isExpired
            ? `Documento vencido: ${label}`
            : `Documento próximo a vencer: ${label}`,
          message:      isExpired
            ? `${v.code} (${v.plate}) – ${label} venció hace ${Math.abs(daysLeft)} día(s).`
            : `${v.code} (${v.plate}) – ${label} vence en ${daysLeft} día(s) (${expiry.toLocaleDateString('es-MX')}).`,
          triggeredAt:  expiry,
          field:        key as string,
        });
      }
    }

    // ── 2. Alertas de mantenimiento vencido ───────────────────────────────
    for (const plan of overduePlans) {
      if (!plan.vehicle) continue;
      const v = plan.vehicle;

      // Tiempo vencido
      const timeOverdue = plan.nextDue != null && plan.nextDue <= now;

      // Km superado (umbral absoluto)
      const kmOverdue =
        plan.usageUnit === 'km' &&
        plan.usageThreshold != null &&
        v.currentKm >= plan.usageThreshold;

      if (!timeOverdue && !kmOverdue) continue;

      // Si ya tiene OT abierta no generar la alerta de mantenimiento
      // (solo alerta si no hay OT abierta)
      if (plan.workOrders.length > 0) continue;

      const alertId = `maint:${v.id}:${plan.id}`;
      if (ackSet.has(alertId)) continue;

      const daysLate = plan.nextDue
        ? Math.abs(Math.ceil((plan.nextDue.getTime() - now.getTime()) / 86400000))
        : null;
      const kmOver = kmOverdue && plan.usageThreshold != null
        ? Math.round(v.currentKm - plan.usageThreshold)
        : null;

      const messageParts: string[] = [];
      if (timeOverdue && daysLate != null) messageParts.push(`${daysLate} día(s) de retraso`);
      if (kmOverdue && kmOver != null) messageParts.push(`${kmOver.toLocaleString()} km por encima del umbral`);

      alerts.push({
        id:           alertId,
        type:         'MAINT',
        severity:     'CRITICAL',
        vehicleId:    v.id,
        vehicleCode:  v.code,
        vehiclePlate: v.plate,
        title:        'Mantenimiento vencido sin OT',
        message:      `${v.code} (${v.plate}) – "${plan.name}": ${messageParts.join(', ')}.`,
        triggeredAt:  plan.nextDue,
        planId:       plan.id,
        planName:     plan.name,
      });
    }

    // ── 3. Alertas de rendimiento de combustible ──────────────────────────
    // Un vehículo tiene alerta de fuel si su FuelLog más reciente contiene "[ALERTA]"
    for (const v of vehicles) {
      const lastLog = v.fuelLogs[0];
      if (!lastLog) continue;
      if (!lastLog.notes?.startsWith('[ALERTA]')) continue;

      const alertId = `fuel:${v.id}`;
      if (ackSet.has(alertId)) continue;

      alerts.push({
        id:           alertId,
        type:         'FUEL',
        severity:     'WARNING',
        vehicleId:    v.id,
        vehicleCode:  v.code,
        vehiclePlate: v.plate,
        title:        'Rendimiento de combustible anormal',
        message:      `${v.code} (${v.plate}) – ${lastLog.notes.split('\n')[0]}`,
        triggeredAt:  lastLog.date,
      });
    }

    // ── Ordenar: CRITICAL primero, luego por fecha ────────────────────────
    const sevOrder: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => {
      const diff = sevOrder[a.severity] - sevOrder[b.severity];
      if (diff !== 0) return diff;
      return (b.triggeredAt?.getTime() ?? 0) - (a.triggeredAt?.getTime() ?? 0);
    });

    return res.json({
      total:    alerts.length,
      critical: alerts.filter(a => a.severity === 'CRITICAL').length,
      warning:  alerts.filter(a => a.severity === 'WARNING').length,
      alerts,
    });
  } catch (err) {
    console.error('[alerts GET /]', err);
    return res.status(500).json({ error: 'Error al obtener alertas de flota' });
  }
});

// ─── PATCH /:id/acknowledge ───────────────────────────────────────────────────
/**
 * Marca una alerta como reconocida para el usuario autenticado.
 * El id de alerta viene en formato: "doc:{vehicleId}:{field}"
 *                                   "maint:{vehicleId}:{planId}"
 *                                   "fuel:{vehicleId}"
 *
 * Persiste en la tabla Notification con type='FLEET_ALERT' y read=true.
 * La restricción @@unique([type, referenceId, userId]) garantiza un upsert limpio.
 */
router.patch('/:id/acknowledge', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const alertId = req.params.id;
    const userId  = req.user!.userId;

    // Validación mínima del formato del ID
    const parts = alertId.split(':');
    if (parts.length < 2 || !['doc', 'maint', 'fuel'].includes(parts[0])) {
      return res.status(400).json({ error: 'ID de alerta inválido' });
    }

    // Upsert en la tabla Notification
    await prisma.notification.upsert({
      where: {
        type_referenceId_userId: {
          type:        'FLEET_ALERT',
          referenceId: alertId,
          userId,
        },
      },
      update: { read: true },
      create: {
        type:        'FLEET_ALERT',
        referenceId: alertId,
        userId,
        read:        true,
        message:     `Alerta de flota reconocida: ${alertId}`,
      },
    });

    return res.json({
      acknowledged: true,
      alertId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.code === 'P2003') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    console.error('[alerts PATCH /:id/acknowledge]', err);
    return res.status(500).json({ error: 'Error al reconocer la alerta' });
  }
});

export default router;
