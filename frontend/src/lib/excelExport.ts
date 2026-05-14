import * as XLSX from 'xlsx';
import type { Audit, CapaAction } from '@/types';

const TYPE_LABEL: Record<string, string>   = { FIVE_S: '5S', PROCESS: 'Procesos' };
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', IN_PROGRESS: 'En Curso', COMPLETED: 'Completada', CLOSED: 'Cerrada',
};
const SEV_LABEL: Record<string, string> = {
  CRITICAL: 'Crítico', MAJOR: 'Mayor', MINOR: 'Menor', OBSERVATION: 'Observación',
};
const CAPA_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En Proceso',
  PENDING_VERIFICATION: 'Pend. Verificación', CLOSED: 'Cerrada',
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ─── Exportar listado de auditorías ──────────────────────────────────────────
export function exportAuditsExcel(audits: Audit[], filename = 'Auditorias'): void {
  const rows = audits.map(a => ({
    'Código':           a.code,
    'Título / Plantilla': a.title,
    'Tipo':             TYPE_LABEL[a.type] ?? a.type,
    'Área':             a.area,
    'Auditor':          a.auditor?.name ?? '—',
    'Puntaje (%)':      a.score ?? '',
    'Estado':           STATUS_LABEL[a.status] ?? a.status,
    'Fecha Programada': fmt(a.scheduledAt),
    'Fecha Completada': fmt(a.completedAt),
    'CAPAs':            a._count?.capaActions ?? 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 16 }, { wch: 36 }, { wch: 12 }, { wch: 18 },
    { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 8 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Auditorías');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}

// ─── Exportar listado de CAPAs ────────────────────────────────────────────────
export function exportCapasExcel(capas: CapaAction[], filename = 'CAPAs'): void {
  const rows = capas.map(c => ({
    'Código':       c.code,
    'Tipo':         c.type === 'CORRECTIVE' ? 'Correctiva' : 'Preventiva',
    'Descripción':  c.description,
    'Causa Raíz':   c.rootCause ?? '',
    'Severidad':    SEV_LABEL[c.severity] ?? c.severity,
    'Estado':       CAPA_STATUS_LABEL[c.status] ?? c.status,
    'Área':         c.audit?.area ?? '—',
    'Auditoría':    c.audit?.code ?? '—',
    'Responsable':  c.assignedTo?.name ?? '—',
    'Creado por':   c.createdBy?.name ?? '—',
    'Vencimiento':  fmt(c.dueDate),
    'Fecha Cierre': fmt(c.closedAt),
    'Notas Cierre': c.closingNotes ?? '',
    'Creación':     fmt(c.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 30 },
    { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
    { wch: 30 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CAPAs');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}

// ─── Exportar reporte mensual ─────────────────────────────────────────────────
export function exportMonthlyExcel(
  rows: Record<string, unknown>[],
  areas: string[],
  filename = 'Cumplimiento_Mensual',
): void {
  const sheetRows = rows.map(r => {
    const row: Record<string, unknown> = { 'Mes': r.month };
    for (const area of areas) {
      row[area] = r[area] !== null && r[area] !== undefined ? `${r[area]}%` : '—';
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  ws['!cols'] = [{ wch: 12 }, ...areas.map(() => ({ wch: 18 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cumplimiento Mensual');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${date}.xlsx`);
}
