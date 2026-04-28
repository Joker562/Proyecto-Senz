import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Audit, CapaAction } from '@/types';

// ─── Paleta corporativa ───────────────────────────────────────────────────────
const C = {
  primary:   [39, 174, 96]  as [number, number, number],
  dark:      [26, 26, 26]   as [number, number, number],
  gray:      [120, 120, 120] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
  border:    [220, 220, 220] as [number, number, number],
  red:       [231, 76, 60]  as [number, number, number],
  yellow:    [230, 126, 18] as [number, number, number],
  green:     [39, 174, 96]  as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

function scoreColor(score: number): [number, number, number] {
  if (score >= 90) return C.green;
  if (score >= 70) return C.yellow;
  return C.red;
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'EXCELENTE';
  if (score >= 70) return 'ACEPTABLE';
  return 'CRÍTICO';
}

function resultSymbol(result: string | null): string {
  if (result === 'PASS') return '✓ Pasa';
  if (result === 'FAIL') return '✗ Falla';
  if (result === 'NA')   return '— N/A';
  return 'Sin resp.';
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEV_LABEL: Record<string, string> = {
  CRITICAL: 'Crítico', MAJOR: 'Mayor', MINOR: 'Menor', OBSERVATION: 'Observación',
};
const CAPA_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En Proceso',
  PENDING_VERIFICATION: 'Pend. Verificación', CLOSED: 'Cerrada',
};

// ─── Función principal ────────────────────────────────────────────────────────
export function exportAuditPDF(audit: Audit): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 15; // margin left
  const MR = PW - 15; // margin right

  let y = 0;

  // ── Encabezado verde ──────────────────────────────────────────────────────
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 32, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE AUDITORÍA', ML, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión de Mantenimiento Industrial', ML, 20);

  // Código en esquina derecha
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(audit.code, MR, 14, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${fmtDateTime(new Date().toISOString())}`, MR, 20, { align: 'right' });

  y = 40;

  // ── Datos generales ───────────────────────────────────────────────────────
  doc.setFillColor(...C.lightGray);
  doc.roundedRect(ML, y, PW - 30, 38, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);

  const col1x = ML + 5;
  const col2x = ML + 90;
  const colW  = 80;

  // Columna izquierda
  doc.text('TÍTULO DE AUDITORÍA', col1x, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text(audit.title, col1x, y + 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.text('ÁREA', col1x, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(audit.area, col1x, y + 28);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.text('TIPO', col1x, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(audit.type === 'FIVE_S' ? '5S' : 'Procesos', col1x, y + 40);

  // Columna derecha
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.text('AUDITOR', col2x, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(audit.auditor?.name ?? '—', col2x, y + 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.text('FECHA PROGRAMADA', col2x, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(fmt(audit.scheduledAt), col2x, y + 28);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.text('FECHA COMPLETADA', col2x, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(fmt(audit.completedAt), col2x, y + 40);

  y += 46;

  // ── Resumen ejecutivo (semáforo) ──────────────────────────────────────────
  if (audit.score !== null) {
    const sc = audit.score;
    const color = scoreColor(sc);
    const label = scoreLabel(sc);

    doc.setFillColor(...color);
    doc.roundedRect(ML, y, PW - 30, 22, 2, 2, 'F');

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`${sc}%`, ML + 6, y + 14);

    doc.setFontSize(10);
    doc.text('PUNTAJE FINAL', ML + 30, y + 8);
    doc.setFontSize(14);
    doc.text(`● ${label}`, ML + 30, y + 17);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const desc = sc >= 90
      ? 'La auditoría cumple con los estándares de excelencia operacional.'
      : sc >= 70
        ? 'La auditoría presenta oportunidades de mejora que requieren atención.'
        : 'Se requieren acciones correctivas inmediatas para alcanzar el nivel mínimo.';
    doc.text(desc, MR - 5, y + 13, { align: 'right', maxWidth: colW });

    y += 28;
  }

  // ── Tabla de ítems por sección ────────────────────────────────────────────
  if (audit.sections && audit.sections.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text('DETALLE DE ÍTEMS', ML, y + 5);
    y += 9;

    for (const section of audit.sections) {
      const rows = section.items.map(item => [
        `${item.order}. ${item.description}`,
        resultSymbol(item.result),
        item.weight !== 1 ? `×${item.weight}` : '1',
        item.notes ?? '',
      ]);

      autoTable(doc, {
        startY: y,
        head: [[
          { content: `SECCIÓN: ${section.name.toUpperCase()}`, colSpan: 4,
            styles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 9 } },
        ], ['Ítem', 'Resultado', 'Peso', 'Observaciones']],
        body: rows,
        margin: { left: ML, right: 15 },
        styles: { fontSize: 8, font: 'helvetica', cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 85 },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = data.cell.raw as string;
            if (val.startsWith('✓')) data.cell.styles.textColor = C.green;
            else if (val.startsWith('✗')) data.cell.styles.textColor = C.red;
            else data.cell.styles.textColor = C.gray;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] as [number, number, number] },
      });

      y = (doc as any).lastAutoTable.finalY + 5;
    }
  }

  // ── Sección CAPA ──────────────────────────────────────────────────────────
  const capas: CapaAction[] = audit.capaActions ?? [];
  if (capas.length > 0) {
    // Nueva página si queda poco espacio
    if (y > PH - 70) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text('ACCIONES CORRECTIVAS Y PREVENTIVAS (CAPA)', ML, y + 5);
    y += 9;

    autoTable(doc, {
      startY: y,
      head: [['Código', 'Tipo', 'Descripción', 'Severidad', 'Responsable', 'Vencimiento', 'Estado']],
      body: capas.map(c => [
        c.code,
        c.type === 'CORRECTIVE' ? 'Correctiva' : 'Preventiva',
        c.description,
        SEV_LABEL[c.severity] ?? c.severity,
        c.assignedTo?.name ?? '—',
        fmt(c.dueDate),
        CAPA_STATUS_LABEL[c.status] ?? c.status,
      ]),
      margin: { left: ML, right: 15 },
      styles: { fontSize: 7.5, font: 'helvetica', cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [41, 128, 185] as [number, number, number], textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 55 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const sev = capas[data.row.index]?.severity;
          if (sev === 'CRITICAL') data.cell.styles.textColor = C.red;
          else if (sev === 'MAJOR') data.cell.styles.textColor = C.yellow;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.column.index === 6) {
          const st = capas[data.row.index]?.status;
          if (st === 'CLOSED') data.cell.styles.textColor = C.green;
          else if (st === 'OPEN') data.cell.styles.textColor = C.red;
        }
      },
      alternateRowStyles: { fillColor: [248, 252, 255] as [number, number, number] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Pie de firma ──────────────────────────────────────────────────────────
  const signY = Math.max(y + 10, PH - 45);
  if (signY + 30 > PH) { doc.addPage(); }

  const finalY = signY + 30 > PH ? 20 : signY;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);

  // Línea auditor
  doc.line(ML, finalY + 20, ML + 70, finalY + 20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text('Firma / Nombre del Auditor', ML, finalY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(audit.auditor?.name ?? '', ML, finalY + 31);

  // Línea fecha
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.line(ML + 85, finalY + 20, ML + 140, finalY + 20);
  doc.text('Fecha de emisión', ML + 85, finalY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(fmtDateTime(new Date().toISOString()), ML + 85, finalY + 31);

  // Número de páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(`Página ${i} de ${totalPages}  ·  ${audit.code}`, PW / 2, PH - 6, { align: 'center' });
    doc.setFillColor(...C.primary);
    doc.rect(0, PH - 4, PW, 4, 'F');
  }

  doc.save(`Auditoria_${audit.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
