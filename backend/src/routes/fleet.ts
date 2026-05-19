import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const VehicleTypeEnum   = z.enum(['TRUCK', 'VAN', 'CAR', 'FORKLIFT', 'OTHER']);
const VehicleStatusEnum = z.enum(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE']);
const FuelTypeEnum      = z.enum(['DIESEL', 'GASOLINE', 'ELECTRIC', 'HYBRID']);

/** Coerce a string ISO or null/undefined → Date | null */
const optionalDate = z.union([z.string().datetime({ offset: true }), z.string().date(), z.literal(''), z.null()])
  .optional()
  .transform(v => (v && v !== '' ? new Date(v) : null));

const CreateVehicleSchema = z.object({
  code:               z.string().min(1).max(20),
  plate:              z.string().min(1).max(20),
  brand:              z.string().min(1).max(60),
  model:              z.string().min(1).max(60),
  year:               z.number().int().min(1900).max(new Date().getFullYear() + 1),
  color:              z.string().max(40).optional().nullable(),
  type:               VehicleTypeEnum,
  status:             VehicleStatusEnum.default('AVAILABLE'),
  fuelType:           FuelTypeEnum.default('DIESEL'),
  tankCapacity:       z.number().positive().optional().nullable(),
  currentKm:          z.number().min(0).default(0),
  area:               z.string().max(80).optional().nullable(),
  insuranceExpiry:    optionalDate,
  verificationExpiry: optionalDate,
  licenseExpiry:      optionalDate,
  circulationCard:    optionalDate,
  driverId:           z.string().cuid().optional().nullable(),
});

const UpdateVehicleSchema = CreateVehicleSchema.partial();

const PatchStatusSchema = z.object({
  status: VehicleStatusEnum,
});

const CreateFuelLogSchema = z.object({
  vehicleId:     z.string().cuid(),
  date:          z.string().datetime({ offset: true }).or(z.string().date()),
  liters:        z.number().positive(),
  pricePerLiter: z.number().positive(),
  kmAtFuel:      z.number().min(0),
  station:       z.string().max(120).optional().nullable(),
  invoiceNumber: z.string().max(60).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
  loggedById:    z.string().cuid(),
});

const CreateTripLogSchema = z.object({
  vehicleId:     z.string().cuid(),
  driverId:      z.string().cuid(),
  origin:        z.string().min(1).max(120),
  destination:   z.string().min(1).max(120),
  purpose:       z.string().max(250).optional().nullable(),
  startKm:       z.number().min(0),
  startTime:     z.string().datetime({ offset: true }),
  notes:         z.string().max(500).optional().nullable(),
  authorizedById:z.string().cuid().optional().nullable(),
});

const UpdateTripLogSchema = z.object({
  endKm:   z.number().min(0).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  status:  z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes:   z.string().max(500).optional().nullable(),
});

const CreateAssignmentSchema = z.object({
  vehicleId:  z.string().cuid(),
  driverId:   z.string().cuid(),
  startDate:  z.string().datetime({ offset: true }).or(z.string().date()),
  endDate:    z.union([z.string().datetime({ offset: true }), z.string().date(), z.null()]).optional(),
  type:       z.enum(['PERMANENT', 'TEMPORARY']).default('PERMANENT'),
  notes:      z.string().max(500).optional().nullable(),
  createdById:z.string().cuid(),
});

// ─── Helper: validar con Zod y devolver 422 en error ─────────────────────────

function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: object } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.flatten() };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now   = new Date();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Inicio y fin del mes actual
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalVehicles,
      byStatus,
      expiringDocs,
      fuelAgg,
      monthKm,
    ] = await Promise.all([
      // 1. Total de vehículos activos
      prisma.vehicle.count({ where: { deletedAt: null } }),

      // 2. Conteo por estado
      prisma.vehicle.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { status: true },
      }),

      // 3. Vehículos con documentos que vencen en ≤ 30 días
      prisma.vehicle.findMany({
        where: {
          deletedAt: null,
          OR: [
            { insuranceExpiry:    { gte: now, lte: in30d } },
            { verificationExpiry: { gte: now, lte: in30d } },
            { licenseExpiry:      { gte: now, lte: in30d } },
            { circulationCard:    { gte: now, lte: in30d } },
          ],
        },
        select: {
          id: true, code: true, plate: true, brand: true, model: true,
          insuranceExpiry: true, verificationExpiry: true,
          licenseExpiry: true, circulationCard: true,
        },
        orderBy: { code: 'asc' },
      }),

      // 4. Rendimiento promedio de combustible (km/L global)
      prisma.fuelLog.aggregate({
        _sum: { liters: true, kmAtFuel: true },
      }),

      // 5. Kilómetros del mes en curso (suma de distance en TripLog COMPLETED)
      prisma.tripLog.aggregate({
        where: {
          status: 'COMPLETED',
          startTime: { gte: monthStart, lte: monthEnd },
          distance: { not: null },
        },
        _sum: { distance: true },
      }),
    ]);

    // Construir mapa de conteo por estado con 0 por defecto
    const statusMap: Record<string, number> = {
      AVAILABLE: 0, IN_USE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0,
    };
    byStatus.forEach(row => { statusMap[row.status] = row._count.status; });

    // Rendimiento promedio: sum(kmAtFuel) / sum(liters) es una aproximación.
    // Mejor calcular con registros consecutivos, pero como global proxy usamos:
    const totalLiters = fuelAgg._sum.liters ?? 0;
    const avgKmPerLiter = totalLiters > 0
      ? Number(((fuelAgg._sum.kmAtFuel ?? 0) / totalLiters).toFixed(2))
      : null;

    res.json({
      vehicles: {
        total: totalVehicles,
        byStatus: statusMap,
      },
      expiringDocuments: {
        count: expiringDocs.length,
        items: expiringDocs,
      },
      fuel: {
        avgKmPerLiter,
        totalLitersLogged: totalLiters,
      },
      currentMonth: {
        totalKm: monthKm._sum.distance ?? 0,
        period: { from: monthStart.toISOString(), to: monthEnd.toISOString() },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching fleet dashboard' });
  }
});

// ─── Vehicles ────────────────────────────────────────────────────────────────

/**
 * GET /api/fleet/vehicles
 * Query params opcionales: status, type, area, driverId
 */
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const { status, type, area, driverId } = req.query;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status)   where.status   = String(status);
    if (type)     where.type     = String(type);
    if (area)     where.area     = String(area);
    if (driverId) where.driverId = String(driverId);

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(vehicles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching vehicles' });
  }
});

/**
 * GET /api/fleet/vehicles/:id
 * Detalle completo con driver, assignments, últimos fuelLogs y tripLogs.
 */
router.get('/vehicles/:id', async (req: Request, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        driver: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            driver:    { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        fuelLogs: {
          include: { loggedBy: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
          take: 20,
        },
        tripLogs: {
          include: {
            driver:      { select: { id: true, name: true } },
            authorizedBy:{ select: { id: true, name: true } },
          },
          orderBy: { startTime: 'desc' },
          take: 20,
        },
      },
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching vehicle' });
  }
});

/**
 * POST /api/fleet/vehicles  — solo ADMIN o SUPERVISOR
 */
router.post('/vehicles', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = validate(CreateVehicleSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  try {
    const vehicle = await prisma.vehicle.create({ data: parsed.data as any });
    res.status(201).json(vehicle);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'El código o placa ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error creating vehicle' });
  }
});

/**
 * PUT /api/fleet/vehicles/:id  — solo ADMIN o SUPERVISOR
 */
router.put('/vehicles/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = validate(UpdateVehicleSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  // Eliminar campos de solo lectura que el cliente pudiera enviar
  const { ...data } = parsed.data as any;
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.fuelLogs;
  delete data.tripLogs;
  delete data.assignments;
  delete data.driver;

  try {
    const vehicle = await prisma.vehicle.update({ where: { id: req.params.id }, data });
    res.json(vehicle);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'El código o placa ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error updating vehicle' });
  }
});

/**
 * PATCH /api/fleet/vehicles/:id/status
 * Cambia únicamente el status del vehículo.
 */
router.patch('/vehicles/:id/status', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = validate(PatchStatusSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  try {
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    });
    res.json(vehicle);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' });
    console.error(err);
    res.status(500).json({ error: 'Error updating vehicle status' });
  }
});

/**
 * DELETE /api/fleet/vehicles/:id  — borrado lógico, solo ADMIN
 */
router.delete('/vehicles/:id', authorize('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Vehicle not found' });
    console.error(err);
    res.status(500).json({ error: 'Error deleting vehicle' });
  }
});

// ─── Fuel Logs ────────────────────────────────────────────────────────────────

/**
 * GET /api/fleet/fuel-logs?vehicleId=
 */
router.get('/fuel-logs', async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.query;
    const fuelLogs = await prisma.fuelLog.findMany({
      where: vehicleId ? { vehicleId: String(vehicleId) } : undefined,
      include: {
        vehicle:  { select: { id: true, code: true, plate: true } },
        loggedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(fuelLogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching fuel logs' });
  }
});

/** GET /api/fleet/fuel-logs/:id */
router.get('/fuel-logs/:id', async (req: Request, res: Response) => {
  try {
    const fuelLog = await prisma.fuelLog.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle:  { select: { id: true, code: true, plate: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });
    if (!fuelLog) return res.status(404).json({ error: 'Fuel log not found' });
    res.json(fuelLog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching fuel log' });
  }
});

/**
 * POST /api/fleet/fuel-logs
 * Regla de negocio: totalCost = liters * pricePerLiter (siempre calculado en backend).
 */
router.post('/fuel-logs', async (req: Request, res: Response) => {
  const parsed = validate(CreateFuelLogSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  const { liters, pricePerLiter, ...rest } = parsed.data;
  const totalCost = Number((liters * pricePerLiter).toFixed(2));

  try {
    const fuelLog = await prisma.fuelLog.create({
      data: { ...rest, liters, pricePerLiter, totalCost, date: new Date(rest.date) },
      include: {
        vehicle:  { select: { id: true, code: true, plate: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(fuelLog);
  } catch (err: any) {
    if (err.code === 'P2003') return res.status(404).json({ error: 'Vehículo o usuario no encontrado' });
    console.error(err);
    res.status(500).json({ error: 'Error creating fuel log' });
  }
});

// ─── Trip Logs ────────────────────────────────────────────────────────────────

/**
 * GET /api/fleet/trip-logs?vehicleId=&driverId=&status=
 */
router.get('/trip-logs', async (req: Request, res: Response) => {
  try {
    const { vehicleId, driverId, status } = req.query;
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = String(vehicleId);
    if (driverId)  where.driverId  = String(driverId);
    if (status)    where.status    = String(status);

    const tripLogs = await prisma.tripLog.findMany({
      where,
      include: {
        vehicle:      { select: { id: true, code: true, plate: true } },
        driver:       { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'desc' },
    });
    res.json(tripLogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching trip logs' });
  }
});

/** POST /api/fleet/trip-logs — abre un viaje */
router.post('/trip-logs', async (req: Request, res: Response) => {
  const parsed = validate(CreateTripLogSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  try {
    const tripLog = await prisma.tripLog.create({
      data: {
        ...parsed.data,
        startTime: new Date(parsed.data.startTime),
        status: 'IN_PROGRESS',
      } as any,
      include: {
        vehicle: { select: { id: true, code: true, plate: true } },
        driver:  { select: { id: true, name: true } },
      },
    });
    res.status(201).json(tripLog);
  } catch (err: any) {
    if (err.code === 'P2003') return res.status(404).json({ error: 'Vehículo o conductor no encontrado' });
    console.error(err);
    res.status(500).json({ error: 'Error creating trip log' });
  }
});

/**
 * PUT /api/fleet/trip-logs/:id
 * Regla de negocio: al pasar a COMPLETED con endKm, calcula distance y actualiza currentKm del vehículo.
 */
router.put('/trip-logs/:id', async (req: Request, res: Response) => {
  const parsed = validate(UpdateTripLogSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  const data = { ...parsed.data } as any;

  try {
    if (data.status === 'COMPLETED' && data.endKm != null) {
      const existing = await prisma.tripLog.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Trip log not found' });

      const endKm = Number(data.endKm);
      data.distance = Number((endKm - existing.startKm).toFixed(2));
      data.endTime  = data.endTime ? new Date(data.endTime) : new Date();

      const [tripLog] = await prisma.$transaction([
        prisma.tripLog.update({ where: { id: req.params.id }, data }),
        prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { currentKm: endKm } }),
      ]);
      return res.json(tripLog);
    }

    if (data.endTime) data.endTime = new Date(data.endTime);
    const tripLog = await prisma.tripLog.update({ where: { id: req.params.id }, data });
    res.json(tripLog);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Trip log not found' });
    console.error(err);
    res.status(500).json({ error: 'Error updating trip log' });
  }
});

// ─── Vehicle Assignments ──────────────────────────────────────────────────────

/**
 * GET /api/fleet/vehicle-assignments?vehicleId=&driverId=
 */
router.get('/vehicle-assignments', async (req: Request, res: Response) => {
  try {
    const { vehicleId, driverId } = req.query;
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = String(vehicleId);
    if (driverId)  where.driverId  = String(driverId);

    const assignments = await prisma.vehicleAssignment.findMany({
      where,
      include: {
        vehicle:   { select: { id: true, code: true, plate: true } },
        driver:    { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching assignments' });
  }
});

/** POST /api/fleet/vehicle-assignments */
router.post('/vehicle-assignments', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  const parsed = validate(CreateAssignmentSchema, req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', details: parsed.error });

  try {
    const assignment = await prisma.vehicleAssignment.create({
      data: {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate as string),
        endDate:   parsed.data.endDate ? new Date(parsed.data.endDate as string) : null,
      } as any,
      include: {
        vehicle:   { select: { id: true, code: true, plate: true } },
        driver:    { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Si la asignación es PERMANENTE, actualiza el conductor principal del vehículo
    if (parsed.data.type === 'PERMANENT') {
      await prisma.vehicle.update({
        where: { id: parsed.data.vehicleId },
        data:  { driverId: parsed.data.driverId },
      });
    }

    res.status(201).json(assignment);
  } catch (err: any) {
    if (err.code === 'P2003') return res.status(404).json({ error: 'Vehículo o conductor no encontrado' });
    console.error(err);
    res.status(500).json({ error: 'Error creating assignment' });
  }
});

/** PUT /api/fleet/vehicle-assignments/:id */
router.put('/vehicle-assignments/:id', authorize('ADMIN', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    // Eliminamos campos de relación que el cliente pudiera enviar
    const { id: _id, vehicle: _v, driver: _d, createdBy: _cb, ...data } = req.body;
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate)   data.endDate   = new Date(data.endDate);

    const assignment = await prisma.vehicleAssignment.update({
      where: { id: req.params.id },
      data,
    });
    res.json(assignment);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Assignment not found' });
    console.error(err);
    res.status(500).json({ error: 'Error updating assignment' });
  }
});

export default router;
