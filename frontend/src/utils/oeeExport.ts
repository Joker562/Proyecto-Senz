/**
 * oeeExport.ts — Utilidades de exportación CSV y PDF para el módulo OEE
 *
 * PDF: jsPDF 4.2.1 + jspdf-autotable 5.0.7 (sin html2canvas — construcción programática)
 * CSV: Blob nativo del navegador
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OEERecord, OEESummary, OEETrendPoint } from '@/services/api';

// ─── Colores corporativos ─────────────────────────────────────────────────────

const C = {
  sidebar:  [28,  28,  28]  as [number, number, number],
  accent:   [230, 126,  34] as [number, number, number],
  blue:     [ 41, 128, 185] as [number, number, number],
  green:    [ 39, 174,  96] as [number, number, number],
  purple:   [142,  68, 173] as [number, number, number],
  red:      [192,  57,  43] as [number, number, number],
  muted:    [136, 136, 136] as [number, number, number],
  border:   [228, 228, 228] as [number, number, number],
  bg:       [249, 249, 249] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
};

// ─── Helpers de color semáforo ────────────────────────────────────────────────

function oeeRgb(v: number | null): [number, number, number] {
  if (v === null) return C.muted;
  return v >= 85 ? C.green : v >= 65 ? C.accent : C.red;
}
function availRgb(v: number | null): [number, number, number] {
  if (v === null) return C.muted;
  return v >= 90 ? C.green : v >= 75 ? C.accent : C.red;
}
function perfRgb(v: number | null): [number, number, number] {
  if (v === null) return C.muted;
  return v >= 95 ? C.green : v >= 80 ? C.accent : C.red;
}
function qualRgb(v: number | null): [number, number, number] {
  if (v === null) return C.muted;
  return v >= 99 ? C.green : v >= 95 ? C.accent : C.red;
}

// ─── Formateadores ────────────────────────────────────────────────────────────

const fmt = (v: number | null, dec = 1) =>
  v !== null && v !== undefined ? v.toFixed(dec) : '—';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SHIFT_LABEL: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

export interface CsvFilters {
  startDate: string;
  endDate:   string;
  shift?:    string;
  area?:     string;
  assetName?: string;
}

export function exportOEEtoCSV(records: OEERecord[], filters: CsvFilters): void {
  const BOM = '﻿'; // UTF-8 BOM para Excel
  const sep = ',';

  const headers = [
    'Fecha', 'Activo', 'Código', 'Área', 'Turno',
    'T.Planificado (min)', 'Break (min)', 'Downtime Est. (min)',
    'Und. Totales', 'Und. Buenas', 'Und. Defectuosas',
    'Disponibilidad (%)', 'Rendimiento (%)', 'Calidad (%)', 'OEE (%)',
  ].join(sep);

  const rows = records.map(r => {
    const downtime = r.availability !== null
      ? Math.round((r.plannedTime - r.breakTime) * (1 - r.availability / 100))
      : '—';
    return [
      fmtDate(r.date),
      `"${r.asset?.name ?? ''}"`,
      r.asset?.code ?? '',
      `"${r.asset?.area ?? ''}"`,
      SHIFT_LABEL[r.shift] ?? r.shift,
      r.plannedTime,
      r.breakTime,
      downtime,
      r.totalCount,
      r.goodCount,
      r.totalCount - r.goodCount,
      fmt(r.availability),
      fmt(r.performance),
      fmt(r.quality),
      fmt(r.oee),
    ].join(sep);
  });

  const csv = BOM + [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `OEE_${filters.startDate}_${filters.endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export interface PdfFilters extends CsvFilters {
  shift?: string;
  area?:  string;
  assetName?: string;
}

export function exportOEEtoPDF(
  summary: OEESummary,
  trend:   OEETrendPoint[],
  records: OEERecord[],
  filters: PdfFilters,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; // ancho A4
  const M = 14;  // margen lateral
  const CW = W - M * 2; // ancho contenido: 182mm

  // ── 1. HEADER ─────────────────────────────────────────────────────────────

  // Barra superior oscura
  doc.setFillColor(...C.sidebar);
  doc.rect(0, 0, W, 22, 'F');

  // Acento naranja (borde inferior)
  doc.setFillColor(...C.accent);
  doc.rect(0, 20, W, 2, 'F');

  // Logo "S"
  doc.setFillColor(...C.accent);
  doc.roundedRect(M, 4, 12, 12, 2, 2, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('S', M + 6, 13, { align: 'center' });

  // Título y subtítulo
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text('senz', M + 16, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text('Reporte de Eficiencia Global de Equipo (OEE)', M + 16, 17);

  // Fecha de generación (derecha)
  const genDate = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`Generado: ${genDate}`, W - M, 17, { align: 'right' });

  // ── 2. FILTROS APLICADOS ───────────────────────────────────────────────────

  doc.setFillColor(...C.bg);
  doc.rect(0, 22, W, 12, 'F');

  const filterParts = [
    `Período: ${fmtDate(filters.startDate)} → ${fmtDate(filters.endDate)}`,
    filters.shift    ? `Turno: ${SHIFT_LABEL[filters.shift] ?? filters.shift}` : null,
    filters.area     ? `Área: ${filters.area}`                                  : null,
    filters.assetName ? `Activo: ${filters.assetName}`                          : null,
    `Registros: ${records.length}`,
  ].filter(Boolean).join('   |   ');

  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(filterParts, M, 29);

  // ── 3. KPI CARDS (4 tarjetas) ─────────────────────────────────────────────

  const kpis = [
    { label: 'DISPONIBILIDAD', value: summary.availability, rgb: availRgb(summary.availability), bench: 90 },
    { label: 'RENDIMIENTO',    value: summary.performance,  rgb: perfRgb(summary.performance),   bench: 95 },
    { label: 'CALIDAD',        value: summary.quality,      rgb: qualRgb(summary.quality),        bench: 99 },
    { label: 'OEE GLOBAL',     value: summary.oee,          rgb: oeeRgb(summary.oee),             bench: 85 },
  ];

  const cardY  = 36;
  const cardH  = 34;
  const gap    = 3;
  const cardW  = (CW - gap * 3) / 4; // ≈43.25 mm

  kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap);

    // Barra superior de color
    doc.setFillColor(...k.rgb);
    doc.roundedRect(x, cardY, cardW, 6, 1.5, 1.5, 'F');

    // Cuerpo tarjeta
    doc.setFillColor(255, 255, 255);
    doc.rect(x, cardY + 5, cardW, cardH - 5, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.rect(x, cardY, cardW, cardH, 'S');

    // Etiqueta (en barra de color)
    doc.setTextColor(...C.white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(k.label, x + cardW / 2, cardY + 4, { align: 'center' });

    // Valor principal
    const valStr = k.value !== null ? `${k.value.toFixed(1)}%` : '—';
    doc.setTextColor(...k.rgb);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(valStr, x + cardW / 2, cardY + 21, { align: 'center' });

    // Benchmark y delta
    const diff = k.value !== null ? k.value - k.bench : null;
    const diffStr = diff !== null
      ? `Meta ≥${k.bench}%  ${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pp`
      : `Meta ≥${k.bench}%`;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...(diff !== null && diff < 0 ? C.red : C.muted));
    doc.text(diffStr, x + cardW / 2, cardY + 28, { align: 'center' });

    // Mini barra de progreso
    const barW = cardW - 10;
    const barX = x + 5;
    const barY = cardY + 30.5;
    doc.setFillColor(...C.border);
    doc.roundedRect(barX, barY, barW, 2, 0.5, 0.5, 'F');
    if (k.value !== null) {
      doc.setFillColor(...k.rgb);
      doc.roundedRect(barX, barY, Math.min(k.value / 100, 1) * barW, 2, 0.5, 0.5, 'F');
    }

    // Totales al pie del KPI OEE
    if (k.label === 'OEE GLOBAL') {
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text(`${summary.recordCount} reg.`, x + cardW / 2, cardY + 34.5, { align: 'center' });
    }
  });

  // ── 4. GRÁFICA DE TENDENCIA OEE ───────────────────────────────────────────

  const chartTopY = cardY + cardH + 8;
  const chartH    = 44;
  const chartW    = CW;
  const chartX    = M;
  const chartBotY = chartTopY + chartH;

  // Título
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.sidebar);
  doc.text('Tendencia OEE', chartX, chartTopY - 2);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text(`${fmtDate(filters.startDate)} → ${fmtDate(filters.endDate)}`, W - M, chartTopY - 2, { align: 'right' });

  // Fondo del área de gráfica
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(chartX, chartTopY, chartW, chartH, 1.5, 1.5, 'FD');

  // Eje Y: líneas de cuadrícula + etiquetas (0%, 25%, 50%, 75%, 100%)
  const innerL = chartX + 10; // espacio para etiqueta Y
  const innerW = chartW - 12;
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = chartBotY - (pct / 100) * chartH;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(innerL, y, innerL + innerW, y);
    doc.setFontSize(5.5);
    doc.setTextColor(...C.muted);
    doc.text(`${pct}%`, innerL - 1, y + 1.5, { align: 'right' });
  }

  // Línea benchmark 85%
  const benchY = chartBotY - 0.85 * chartH;
  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.4);
  doc.line(innerL, benchY, innerL + innerW, benchY);
  doc.setFontSize(5.5);
  doc.setTextColor(...C.muted);
  doc.text('85%', innerL + innerW + 1, benchY + 1.5);

  // Trazar línea OEE
  if (trend.length >= 2) {
    const points = trend.map((p, i) => ({
      x: innerL + (i / (trend.length - 1)) * innerW,
      y: chartBotY - (Math.max(0, Math.min(100, p.oee ?? 0)) / 100) * chartH,
    }));

    // Área rellena bajo la curva (semitransparente usando rect muy delgados)
    doc.setFillColor(...C.accent);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(1.8);
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // Puntos
    doc.setFillColor(...C.accent);
    points.forEach(p => { doc.circle(p.x, p.y, 0.8, 'F'); });

    // Etiqueta en último punto
    const last = points[points.length - 1];
    const lastVal = trend[trend.length - 1].oee ?? 0;
    doc.setFontSize(6);
    doc.setTextColor(...oeeRgb(lastVal));
    doc.setFont('helvetica', 'bold');
    doc.text(`${lastVal.toFixed(1)}%`, last.x, last.y - 2, { align: 'center' });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('Sin datos de tendencia en el período', chartX + chartW / 2, chartTopY + chartH / 2, { align: 'center' });
  }

  // Etiquetas eje X (hasta 8 fechas)
  if (trend.length > 0) {
    const step  = Math.max(1, Math.floor(trend.length / 8));
    const shown = trend.filter((_, i) => i % step === 0 || i === trend.length - 1);
    shown.forEach(p => {
      const i = trend.indexOf(p);
      const x = innerL + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
      doc.setFontSize(5.5);
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(p.period.slice(5), x, chartBotY + 3.5, { align: 'center' });
    });
  }

  // ── 5. TOTALES GLOBALES ────────────────────────────────────────────────────

  const totY = chartBotY + 9;
  const cols = [
    { label: 'Horas planificadas', value: `${summary.totalPlannedHours ?? '—'} h` },
    { label: 'Piezas buenas',      value: (summary.totalGood ?? 0).toLocaleString() },
    { label: 'Defectos',           value: (summary.totalDefects ?? 0).toLocaleString() },
    { label: 'Registros',          value: String(summary.recordCount) },
  ];

  const colW = CW / cols.length;
  cols.forEach((c, i) => {
    const x = M + i * colW + colW / 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.sidebar);
    doc.text(c.value, x, totY + 5, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(c.label, x, totY + 9, { align: 'center' });
  });

  // Separador
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(M, totY + 11, M + CW, totY + 11);

  // ── 6. TABLA DE DATOS DETALLADOS (autoTable) ───────────────────────────────

  const tableStartY = totY + 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.sidebar);
  doc.text('Detalle de Registros OEE', M, tableStartY - 2);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: M, right: M },
    head: [[
      'Fecha', 'Activo', 'Área', 'Turno',
      'T.Plan.', 'Break', 'D.Est.',
      'Buenas', 'Defectos',
      'D.%', 'R.%', 'C.%', 'OEE%',
    ]],
    body: records.map(r => {
      const downtime = r.availability !== null
        ? Math.round((r.plannedTime - r.breakTime) * (1 - r.availability / 100))
        : '—';
      return [
        fmtDate(r.date),
        r.asset?.name  ?? '—',
        r.asset?.area  ?? '—',
        SHIFT_LABEL[r.shift] ?? r.shift,
        `${r.plannedTime}m`,
        `${r.breakTime}m`,
        typeof downtime === 'number' ? `${downtime}m` : '—',
        r.goodCount,
        r.totalCount - r.goodCount,
        fmt(r.availability),
        fmt(r.performance),
        fmt(r.quality),
        fmt(r.oee),
      ];
    }),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.8, font: 'helvetica', overflow: 'ellipsize' },
    headStyles: {
      fillColor: C.sidebar,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: {
      0:  { cellWidth: 18 },  // Fecha
      1:  { cellWidth: 28 },  // Activo
      2:  { cellWidth: 22 },  // Área
      3:  { cellWidth: 14 },  // Turno
      4:  { cellWidth: 12 },  // T.Plan.
      5:  { cellWidth: 10 },  // Break
      6:  { cellWidth: 12 },  // Downtime
      7:  { cellWidth: 12 },  // Buenas
      8:  { cellWidth: 12 },  // Defectos
      9:  { cellWidth: 10, halign: 'right' },  // D%
      10: { cellWidth: 10, halign: 'right' },  // R%
      11: { cellWidth: 10, halign: 'right' },  // C%
      12: { cellWidth: 10, halign: 'right', fontStyle: 'bold' }, // OEE%
    },
    didDrawCell: (data) => {
      // Colorear celdas OEE% según semáforo
      if (data.section === 'body' && data.column.index === 12) {
        const v = parseFloat(String(data.cell.raw));
        if (!isNaN(v)) {
          const [r, g, b] = oeeRgb(v);
          data.doc.setTextColor(r, g, b);
        }
      }
    },
  });

  // ── 7. FOOTER CON NÚMERO DE PÁGINAS ───────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.bg);
    doc.rect(0, 289, W, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `SENZ — Sistema de Gestión Industrial   |   Página ${p} de ${pageCount}`,
      W / 2, 294, { align: 'center' },
    );
  }

  // ── 8. GUARDAR ────────────────────────────────────────────────────────────

  doc.save(`OEE_Reporte_${filters.startDate}_${filters.endDate}.pdf`);
}
