/**
 * oeeMonthlyReport.ts
 * Tarea programada: genera y persiste el resumen OEE del mes anterior
 * el 1er día de cada mes a las 00:05 (zona horaria Mexico City).
 *
 * Dependencia: node-cron ^4
 */

import cron from 'node-cron';
import { prisma } from '../services/prisma';
import { weightedOEESummary } from '../services/oee';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface AssetRow {
  assetId:     string;
  id:          string;
  code:        string;
  name:        string;
  area:        string;
  oee:         number | null;
  availability:number | null;
  performance: number | null;
  quality:     number | null;
  recordCount: number;
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function generateMonthlyReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0);
  const endDate   = new Date(year, month,     0, 23, 59, 59); // último día del mes

  const tag = `${year}-${String(month).padStart(2, '0')}`;
  console.log(`\n📊 [OEE Monthly] Generando reporte ${tag}…`);
  console.log(`   Período: ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`);

  const records = await prisma.oEERecord.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: {
      assetId:      true,
      plannedTime:  true,
      availability: true,
      performance:  true,
      quality:      true,
      oee:          true,
      totalCount:   true,
      goodCount:    true,
      asset: { select: { id: true, code: true, name: true, area: true } },
    },
  });

  if (records.length === 0) {
    console.log(`   ⚠️  Sin registros OEE para ${tag}. Reporte omitido.\n`);
    return null;
  }

  // ── Resumen global ponderado ──────────────────────────────────────────────
  const summary          = weightedOEESummary(records);
  const totalGood        = records.reduce((s, r) => s + r.goodCount,   0);
  const totalCount       = records.reduce((s, r) => s + r.totalCount,  0);
  const totalPlannedHours = Math.round(
    records.reduce((s, r) => s + r.plannedTime, 0) / 60 * 10,
  ) / 10;

  // ── Resumen por activo ────────────────────────────────────────────────────
  const assetMap = new Map<string, {
    asset: { id: string; code: string; name: string; area: string };
    recs:  typeof records;
  }>();

  for (const r of records) {
    if (!assetMap.has(r.assetId)) {
      assetMap.set(r.assetId, { asset: r.asset, recs: [] });
    }
    assetMap.get(r.assetId)!.recs.push(r);
  }

  const byAsset: AssetRow[] = Array.from(assetMap.entries())
    .map(([assetId, { asset, recs }]) => ({
      assetId,
      ...asset,
      ...weightedOEESummary(recs),
      recordCount: recs.length,
    }))
    .sort((a, b) => (b.oee ?? 0) - (a.oee ?? 0));

  // ── Persistir en DB (upsert: idempotente si se re-ejecuta) ───────────────
  const report = await prisma.oEEMonthlyReport.upsert({
    where:  { year_month: { year, month } },
    create: {
      year, month,
      oee:               summary.oee          ?? 0,
      availability:      summary.availability ?? 0,
      performance:       summary.performance  ?? 0,
      quality:           summary.quality      ?? 0,
      recordCount:       summary.recordCount,
      totalGood,
      totalDefects:      totalCount - totalGood,
      totalPlannedHours,
      byAsset:           byAsset as unknown as import('@prisma/client').Prisma.JsonArray,
    },
    update: {
      oee:               summary.oee          ?? 0,
      availability:      summary.availability ?? 0,
      performance:       summary.performance  ?? 0,
      quality:           summary.quality      ?? 0,
      recordCount:       summary.recordCount,
      totalGood,
      totalDefects:      totalCount - totalGood,
      totalPlannedHours,
      byAsset:           byAsset as unknown as import('@prisma/client').Prisma.JsonArray,
      generatedAt:       new Date(),
    },
  });

  // ── Log ejecutivo ─────────────────────────────────────────────────────────
  const best  = byAsset[0];
  const worst = byAsset[byAsset.length - 1];

  console.log(`   ✅ Reporte ${tag} guardado (id: ${report.id})`);
  console.log(`   OEE Global:   ${(summary.oee ?? 0).toFixed(2)}%`);
  console.log(`   Disponib.:    ${(summary.availability ?? 0).toFixed(2)}%`);
  console.log(`   Rendimiento:  ${(summary.performance  ?? 0).toFixed(2)}%`);
  console.log(`   Calidad:      ${(summary.quality      ?? 0).toFixed(2)}%`);
  console.log(`   Registros:    ${summary.recordCount}  |  Activos: ${byAsset.length}`);
  console.log(`   T. planif.:   ${totalPlannedHours} h`);
  console.log(`   Piezas buenas:${totalGood.toLocaleString()}  /  Defectos: ${(totalCount - totalGood).toLocaleString()}`);
  if (best)  console.log(`   Mejor activo: ${best.name} (${(best.oee ?? 0).toFixed(1)}%)`);
  if (worst && worst.assetId !== best?.assetId)
             console.log(`   Peor activo:  ${worst.name} (${(worst.oee ?? 0).toFixed(1)}%)`);
  console.log('');

  return report;
}

// ─── Cron ─────────────────────────────────────────────────────────────────────

export function startOEEMonthlyCron() {
  // Ejecuta el 1er día de cada mes a las 00:05 (huso horario MX)
  cron.schedule(
    '5 0 1 * *',
    async () => {
      const now       = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      try {
        await generateMonthlyReport(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
      } catch (e) {
        console.error('❌ [OEE Monthly] Error en cron:', e);
      }
    },
    { timezone: 'America/Mexico_City' },
  );

  console.log('📅 [OEE Monthly] Cron registrado — corre el 1er día de cada mes 00:05 (MX)');
}

// ─── Export manual (útil para testing vía script) ─────────────────────────────
export { generateMonthlyReport };
