/**
 * Fase 7 – Fleet Reports API
 * Montado en: /api/fleet/reports
 *
 * Endpoints:
 *   GET /efficiency        – Ranking de eficiencia por vehículo
 *   GET /export/csv        – Exportación CSV de la flota (descarga directa)
 *   GET /export/json       – Sábana de datos en JSON plano (para el cliente)
 *
 * Sin dependencias externas: el CSV se genera con strings nativos de Node.js.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Helpers CSV ──────────────────────────────────────────────────────────────

/** Escapa un valor para CSV: envuelve en comillas si contiene coma, comilla o salto */
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

// ─── GET /efficiency ─────────────────────────────────────────────────────────
/**
 * Ranking de eficiencia de la flota.
 *
 * Por vehículo calcula:
 *   • totalKm         – suma de distance en TripLogs COMPLETED
 *   • totalLiters     – suma de liters en FuelLogs
 *   • avgKmPerLiter   – totalKm / totalLiters (null si no hay combustible)
 *   • fuelCost        – suma de totalCost en FuelLogs
 *   • maintenanceCost – 0 (los WorkOrders no almacenan costo; se muestra slot)
 *   • totalCost       – fuelCost + maintenanceCost
 *
 * Flags:
 *   • bestEfficiency  – vehículo con mayor avgKmPerLiter
 *   • highestSpender  – vehículo con mayor totalCost
 *
 * Query params opcionales:
 *   • startDate / endDate – limita el período de análisis
 */
router.get('/efficiency', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate)   dateFilter.lte = new Date(String(endDate));
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ── Consultas en paralelo ─────────────────────────────────────────────
    const [vehicles, fuelLogs, tripLogs] = await Promise.all([
      prisma.vehicle.findMany({
        where:   { deletedAt: null },
        select:  {
          id: true, code: true, plate: true, brand: true,
          model: true, type: true, currentKm: true, status: true,
          driver: { select: { id: true, name: true } },
        },
        orderBy: { code: 'asc' },
      }),

      prisma.fuelLog.findMany({
        where:   hasDateFilter ? { date: dateFilter } : undefined,
        select:  { vehicleId: true, liters: true, totalCost: true, kmAtFuel: true },
      }),

      prisma.tripLog.findMany({
        where: {
          status:   'COMPLETED',
          distance: { not: null },
          ...(hasDateFilter ? { startTime: dateFilter } : {}),
        },
        select: { vehicleId: true, distance: true },
      }),
    ]);

    // ── Agregación por vehículo ───────────────────────────────────────────
    type VehicleAgg = {
      totalLiters:     number;
      fuelCost:        number;
      totalKm:         number;
    };

    const fuelAgg  = new Map<string, VehicleAgg>();
    const kmAgg    = new Map<string, number>();

    for (const log of fuelLogs) {
      const curr = fuelAgg.get(log.vehicleId) ?? { totalLiters: 0, fuelCost: 0, totalKm: 0 };
      curr.totalLiters += log.liters;
      curr.fuelCost    += log.totalCost;
      fuelAgg.set(log.vehicleId, curr);
    }

    for (const trip of tripLogs) {
      if (trip.distance == null) continue;
      kmAgg.set(trip.vehicleId, (kmAgg.get(trip.vehicleId) ?? 0) + trip.distance);
    }

    // ── Construir ranking ─────────────────────────────────────────────────
    const ranking = vehicles.map(v => {
      const fuel       = fuelAgg.get(v.id);
      const totalKm    = kmAgg.get(v.id)   ?? 0;
      const totalLiters= fuel?.totalLiters  ?? 0;
      const fuelCost   = fuel?.fuelCost     ?? 0;
      // Placeholder para costo de mantenimiento (WorkOrders no tienen campo de costo)
      const maintenanceCost = 0;
      const totalCost  = Number((fuelCost + maintenanceCost).toFixed(2));

      const avgKmPerLiter = totalLiters > 0 && totalKm > 0
        ? Number((totalKm / totalLiters).toFixed(3))
        : null;

      return {
        vehicleId:       v.id,
        code:            v.code,
        plate:           v.plate,
        brand:           v.brand,
        model:           v.model,
        type:            v.type,
        status:          v.status,
        currentKm:       v.currentKm,
        driver:          v.driver,
        totalKm:         Number(totalKm.toFixed(2)),
        totalLiters:     Number(totalLiters.toFixed(2)),
        avgKmPerLiter,
        fuelCost:        Number(fuelCost.toFixed(2)),
        maintenanceCost,
        totalCost,
        // Flags se asignan después
        bestEfficiency:  false,
        highestSpender:  false,
      };
    });

    // ── Asignar flags ─────────────────────────────────────────────────────
    const withEfficiency = ranking.filter(r => r.avgKmPerLiter !== null);
    const withCost       = ranking.filter(r => r.totalCost > 0);

    if (withEfficiency.length > 0) {
      const best = withEfficiency.reduce((a, b) =>
        (a.avgKmPerLiter ?? 0) > (b.avgKmPerLiter ?? 0) ? a : b,
      );
      best.bestEfficiency = true;
    }

    if (withCost.length > 0) {
      const top = withCost.reduce((a, b) => a.totalCost > b.totalCost ? a : b);
      top.highestSpender = true;
    }

    // Ordenar por eficiencia descendente (nulos al final)
    ranking.sort((a, b) => {
      if (a.avgKmPerLiter === null && b.avgKmPerLiter === null) return 0;
      if (a.avgKmPerLiter === null) return 1;
      if (b.avgKmPerLiter === null) return -1;
      return b.avgKmPerLiter - a.avgKmPerLiter;
    });

    // ── Totales globales ──────────────────────────────────────────────────
    const totalKmFleet     = ranking.reduce((s, r) => s + r.totalKm, 0);
    const totalLitersFleet = ranking.reduce((s, r) => s + r.totalLiters, 0);
    const totalCostFleet   = ranking.reduce((s, r) => s + r.totalCost, 0);
    const fleetAvgKmPerL   = totalLitersFleet > 0 && totalKmFleet > 0
      ? Number((totalKmFleet / totalLitersFleet).toFixed(3))
      : null;

    return res.json({
      period: hasDateFilter
        ? { from: startDate ?? null, to: endDate ?? null }
        : 'all_time',
      totals: {
        totalKm:       Number(totalKmFleet.toFixed(2)),
        totalLiters:   Number(totalLitersFleet.toFixed(2)),
        totalCost:     Number(totalCostFleet.toFixed(2)),
        avgKmPerLiter: fleetAvgKmPerL,
      },
      ranking,
    });
  } catch (err) {
    console.error('[reports GET /efficiency]', err);
    return res.status(500).json({ error: 'Error al generar reporte de eficiencia' });
  }
});

// ─── GET /export/csv ─────────────────────────────────────────────────────────
/**
 * Exporta la sábana de datos de la flota en formato CSV.
 * Incluye: vehículo, estado, km actuales, conductor asignado y alertas activas.
 *
 * Responde con Content-Disposition: attachment para forzar descarga en el navegador.
 * Sin dependencias externas – generación nativa con strings.
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const now   = new Date();
    const in15d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [vehicles, fuelAgg, tripAgg] = await Promise.all([
      prisma.vehicle.findMany({
        where:   { deletedAt: null },
        include: {
          driver:   { select: { id: true, name: true, email: true } },
          fuelLogs: { orderBy: { kmAtFuel: 'desc' }, take: 1, select: { notes: true, totalCost: true } },
          _count:   { select: { tripLogs: true, fuelLogs: true, assignments: true } },
        },
        orderBy: { code: 'asc' },
      }),

      // Costo total de combustible por vehículo (all-time)
      prisma.fuelLog.groupBy({
        by:    ['vehicleId'],
        _sum:  { totalCost: true, liters: true },
      }),

      // Km totales por vehículo desde TripLog COMPLETED
      prisma.tripLog.groupBy({
        by:    ['vehicleId'],
        where: { status: 'COMPLETED', distance: { not: null } },
        _sum:  { distance: true },
      }),
    ]);

    // Lookup maps
    const fuelMap = new Map(fuelAgg.map(r => [r.vehicleId, r._sum]));
    const tripMap = new Map(tripAgg.map(r => [r.vehicleId, r._sum]));

    // ── Cabecera CSV ──────────────────────────────────────────────────────
    const headers = [
      'Código', 'Placas', 'Marca', 'Modelo', 'Año', 'Tipo',
      'Estado', 'Tipo combustible', 'Km actuales',
      'Conductor', 'Email conductor',
      'Km recorridos (registros)', 'Litros consumidos', 'Costo total combustible',
      'Viajes registrados', 'Cargas combustible',
      'Seguro vence', 'Verificación vence', 'Licencia vence', 'Tarjeta circulación vence',
      'Alertas activas', 'Área',
    ];

    const rows: string[] = [csvRow(headers)];

    for (const v of vehicles) {
      // Detectar alertas activas para este vehículo
      const alertFlags: string[] = [];

      const docFields: Array<{ date: Date | null; label: string }> = [
        { date: v.insuranceExpiry,    label: 'Seguro'       },
        { date: v.verificationExpiry, label: 'Verificación' },
        { date: v.licenseExpiry,      label: 'Licencia'     },
        { date: v.circulationCard,    label: 'T.Circulación'},
      ];
      for (const { date, label } of docFields) {
        if (!date) continue;
        if (date <= now)   alertFlags.push(`${label} VENCIDO`);
        else if (date <= in15d) alertFlags.push(`${label} por vencer`);
      }

      const lastFuelLog = v.fuelLogs[0];
      if (lastFuelLog?.notes?.startsWith('[ALERTA]')) {
        alertFlags.push('Rendimiento combustible anormal');
      }

      const fuel  = fuelMap.get(v.id);
      const trips = tripMap.get(v.id);

      rows.push(csvRow([
        v.code,
        v.plate,
        v.brand,
        v.model,
        v.year,
        v.type,
        v.status,
        v.fuelType,
        v.currentKm,
        v.driver?.name  ?? '',
        v.driver?.email ?? '',
        trips?.distance?.toFixed(2) ?? '0',
        fuel?.liters?.toFixed(2)    ?? '0',
        fuel?.totalCost?.toFixed(2) ?? '0',
        v._count.tripLogs,
        v._count.fuelLogs,
        v.insuranceExpiry    ? v.insuranceExpiry.toLocaleDateString('es-MX')    : '',
        v.verificationExpiry ? v.verificationExpiry.toLocaleDateString('es-MX') : '',
        v.licenseExpiry      ? v.licenseExpiry.toLocaleDateString('es-MX')      : '',
        v.circulationCard    ? v.circulationCard.toLocaleDateString('es-MX')    : '',
        alertFlags.join(' | '),
        v.area ?? '',
      ]));
    }

    const csvContent = '﻿' + rows.join('\r\n'); // BOM para Excel en español
    const filename   = `flota_${now.toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('[reports GET /export/csv]', err);
    return res.status(500).json({ error: 'Error al exportar datos de flota' });
  }
});

// ─── GET /export/json ─────────────────────────────────────────────────────────
/**
 * Sábana de datos en JSON plano (flat) lista para ser consumida por el cliente
 * y transformada a Excel/tabla. Misma información que el CSV pero en JSON.
 */
router.get('/export/json', async (req: Request, res: Response) => {
  try {
    const now   = new Date();
    const in15d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [vehicles, fuelAgg, tripAgg] = await Promise.all([
      prisma.vehicle.findMany({
        where:   { deletedAt: null },
        include: {
          driver:   { select: { id: true, name: true, email: true } },
          fuelLogs: { orderBy: { kmAtFuel: 'desc' }, take: 1, select: { notes: true } },
          _count:   { select: { tripLogs: true, fuelLogs: true } },
        },
        orderBy: { code: 'asc' },
      }),
      prisma.fuelLog.groupBy({
        by:   ['vehicleId'],
        _sum: { totalCost: true, liters: true },
      }),
      prisma.tripLog.groupBy({
        by:    ['vehicleId'],
        where: { status: 'COMPLETED', distance: { not: null } },
        _sum:  { distance: true },
      }),
    ]);

    const fuelMap = new Map(fuelAgg.map(r => [r.vehicleId, r._sum]));
    const tripMap = new Map(tripAgg.map(r => [r.vehicleId, r._sum]));

    const rows = vehicles.map(v => {
      const alertFlags: string[] = [];
      const docFields: Array<{ date: Date | null; label: string }> = [
        { date: v.insuranceExpiry,    label: 'Seguro'         },
        { date: v.verificationExpiry, label: 'Verificación'   },
        { date: v.licenseExpiry,      label: 'Licencia'       },
        { date: v.circulationCard,    label: 'T.Circulación'  },
      ];
      for (const { date, label } of docFields) {
        if (!date) continue;
        if (date <= now)        alertFlags.push(`${label} VENCIDO`);
        else if (date <= in15d) alertFlags.push(`${label} por vencer`);
      }
      if (v.fuelLogs[0]?.notes?.startsWith('[ALERTA]')) {
        alertFlags.push('Rendimiento anormal');
      }

      const fuel  = fuelMap.get(v.id);
      const trips = tripMap.get(v.id);

      return {
        id:                v.id,
        codigo:            v.code,
        placas:            v.plate,
        marca:             v.brand,
        modelo:            v.model,
        anio:              v.year,
        tipo:              v.type,
        estado:            v.status,
        tipoCombustible:   v.fuelType,
        kmActuales:        v.currentKm,
        area:              v.area ?? null,
        conductorNombre:   v.driver?.name  ?? null,
        conductorEmail:    v.driver?.email ?? null,
        kmRecorridos:      Number((trips?.distance  ?? 0).toFixed(2)),
        litrosConsumidos:  Number((fuel?.liters     ?? 0).toFixed(2)),
        costoTotalFuel:    Number((fuel?.totalCost  ?? 0).toFixed(2)),
        viajesRegistrados: v._count.tripLogs,
        cargasCombustible: v._count.fuelLogs,
        seguroVence:            v.insuranceExpiry?.toISOString()    ?? null,
        verificacionVence:      v.verificationExpiry?.toISOString() ?? null,
        licenciaVence:          v.licenseExpiry?.toISOString()      ?? null,
        tarjetaCirculacionVence:v.circulationCard?.toISOString()    ?? null,
        alertasActivas:    alertFlags,
        tieneAlertas:      alertFlags.length > 0,
      };
    });

    return res.json({
      generatedAt:    now.toISOString(),
      totalVehiculos: rows.length,
      conAlertas:     rows.filter(r => r.tieneAlertas).length,
      data:           rows,
    });
  } catch (err) {
    console.error('[reports GET /export/json]', err);
    return res.status(500).json({ error: 'Error al exportar datos JSON' });
  }
});

export default router;
