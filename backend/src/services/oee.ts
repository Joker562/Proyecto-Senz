/**
 * OEE Calculation Service
 * Funciones puras para calcular los 4 pilares del OEE.
 * Sin efectos secundarios — se pueden reutilizar desde rutas y cron jobs.
 *
 * Fórmulas (valores en minutos y unidades consistentes):
 *   actualTime   = plannedTime − breakTime − Σ availabilityLossMin
 *   Availability = actualTime / plannedTime × 100
 *   Performance  = min(idealCycleTime × totalCount / actualTime × 100, 100)
 *   Quality      = goodCount / totalCount × 100
 *   OEE          = A × P × Q / 10 000
 */

export interface OEEInputs {
  plannedTime:        number; // minutos
  breakTime:          number; // minutos (paros planificados: comidas, cambio turno)
  availabilityLossMin: number; // Σ duration de DowntimeEvents con lossType AVAILABILITY
  totalCount:         number; // piezas totales producidas
  goodCount:          number; // piezas buenas/conformes
  idealCycleTime:     number; // minutos / pieza
}

export interface OEEComponents {
  availability: number; // 0–100 %
  performance:  number; // 0–100 %
  quality:      number; // 0–100 %
  oee:          number; // 0–100 %
}

/** Redondea a 1 decimal */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Calcula los 4 componentes OEE.
 * Devuelve ceros si los inputs son inválidos (evita divisiones por cero).
 */
export function calcOEEComponents(inputs: OEEInputs): OEEComponents {
  const { plannedTime, breakTime, availabilityLossMin, totalCount, goodCount, idealCycleTime } = inputs;

  const actualTime = plannedTime - breakTime - availabilityLossMin;

  // Guardia: entradas degeneradas → OEE = 0
  if (plannedTime <= 0 || actualTime <= 0 || totalCount <= 0) {
    return { availability: 0, performance: 0, quality: 0, oee: 0 };
  }

  const availability = r1((actualTime / plannedTime) * 100);
  const performance  = r1(Math.min((idealCycleTime * totalCount / actualTime) * 100, 100));
  const quality      = r1((goodCount / totalCount) * 100);
  const oee          = r1((availability / 100) * (performance / 100) * (quality / 100) * 100);

  return { availability, performance, quality, oee };
}

/**
 * Promedio ponderado de OEE sobre un conjunto de registros.
 * Pondera por plannedTime para que turnos más largos tengan más peso.
 */
export function weightedOEESummary(records: {
  plannedTime:  number;
  availability: number | null;
  performance:  number | null;
  quality:      number | null;
  oee:          number | null;
}[]): OEEComponents & { recordCount: number } {
  const valid = records.filter(
    r => r.availability !== null && r.performance !== null && r.quality !== null && r.oee !== null,
  );

  if (valid.length === 0) {
    return { availability: 0, performance: 0, quality: 0, oee: 0, recordCount: 0 };
  }

  const totalWeight = valid.reduce((s, r) => s + r.plannedTime, 0);

  const wa = (field: 'availability' | 'performance' | 'quality' | 'oee') =>
    r1(valid.reduce((s, r) => s + (r[field] as number) * r.plannedTime, 0) / totalWeight);

  return {
    availability: wa('availability'),
    performance:  wa('performance'),
    quality:      wa('quality'),
    oee:          wa('oee'),
    recordCount:  valid.length,
  };
}

/** Construye el filtro Prisma de fecha a partir de query params */
export function buildDateRange(
  startDate?: string,
  endDate?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!startDate && !endDate) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
}
