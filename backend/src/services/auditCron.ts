import cron from 'node-cron';
import { prisma } from './prisma';
import { sendNotification, notifyByRole } from './notifications';

export function startAuditCron() {
  // Diario a las 9:00am
  cron.schedule('0 9 * * *', async () => {
    console.log('[AuditCron] Revisando reminders y vencimientos...');
    await Promise.all([checkAuditReminders(), checkCapaDeadlines()]);
  });
  console.log('[AuditCron] Scheduler de auditorías iniciado');
}

// ── Recordatorio 24h antes de auditoría ──────────────────────────────────────
async function checkAuditReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow.setHours(0, 0, 0, 0));
  const end   = new Date(tomorrow.setHours(23, 59, 59, 999));

  const audits = await prisma.audit.findMany({
    where: { status: 'DRAFT', scheduledAt: { gte: start, lte: end } },
    select: { id: true, code: true, title: true, area: true, auditorId: true, scheduledAt: true },
  });

  for (const audit of audits) {
    const dateStr = audit.scheduledAt!.toLocaleDateString('es-MX', { dateStyle: 'long' });
    await sendNotification({
      type: 'AUDIT_REMINDER',
      referenceId: audit.id,
      userId: audit.auditorId,
      message: `Recordatorio: "${audit.title}" (${audit.area}) está programada para mañana`,
      link: `/audits/${audit.id}`,
      emailSubject: `[Recordatorio] Auditoría ${audit.code} — mañana`,
      emailHtml: `<p>Tienes una auditoría programada para <strong>mañana ${dateStr}</strong>:</p>
        <ul>
          <li><strong>Código:</strong> ${audit.code}</li>
          <li><strong>Título:</strong> ${audit.title}</li>
          <li><strong>Área:</strong> ${audit.area}</li>
        </ul>`,
    });
  }
  if (audits.length) console.log(`[AuditCron] ${audits.length} reminder(s) de auditoría enviados`);
}

// ── Alertas de vencimiento de CAPAs ─────────────────────────────────────────
async function checkCapaDeadlines() {
  const now = new Date();

  // 3 días antes del vencimiento
  const in3 = new Date();
  in3.setDate(in3.getDate() + 3);
  const warnStart = new Date(in3.setHours(0, 0, 0, 0));
  const warnEnd   = new Date(in3.setHours(23, 59, 59, 999));

  const warning = await prisma.capaAction.findMany({
    where: { status: { notIn: ['CLOSED'] }, dueDate: { gte: warnStart, lte: warnEnd } },
    select: { id: true, code: true, description: true, severity: true, dueDate: true, assignedToId: true },
  });

  for (const capa of warning) {
    const dateStr = capa.dueDate.toLocaleDateString('es-MX', { dateStyle: 'long' });
    const desc = capa.description.length > 80 ? capa.description.slice(0, 80) + '…' : capa.description;
    await sendNotification({
      type: 'CAPA_WARNING',
      referenceId: capa.id,
      userId: capa.assignedToId,
      message: `CAPA ${capa.code} vence en 3 días (${capa.severity})`,
      link: `/audits/capa`,
      emailSubject: `[Alerta] CAPA ${capa.code} vence en 3 días`,
      emailHtml: `<p>La siguiente acción CAPA a tu cargo vence en <strong>3 días (${dateStr})</strong>:</p>
        <ul>
          <li><strong>Código:</strong> ${capa.code}</li>
          <li><strong>Descripción:</strong> ${desc}</li>
          <li><strong>Severidad:</strong> ${capa.severity}</li>
        </ul>
        <p>Actualiza el estado en el sistema para evitar que quede vencida.</p>`,
    });
  }

  // Vencidas (alerta crítica — idempotente: solo dispara una vez por CAPA)
  const overdue = await prisma.capaAction.findMany({
    where: { status: { notIn: ['CLOSED'] }, dueDate: { lt: now } },
    select: { id: true, code: true, description: true, severity: true, dueDate: true, assignedToId: true },
  });

  for (const capa of overdue) {
    const dateStr = capa.dueDate.toLocaleDateString('es-MX', { dateStyle: 'long' });
    const desc = capa.description.length > 80 ? capa.description.slice(0, 80) + '…' : capa.description;
    await sendNotification({
      type: 'CAPA_OVERDUE',
      referenceId: capa.id,
      userId: capa.assignedToId,
      message: `⚠️ CAPA ${capa.code} está VENCIDA — requiere atención inmediata`,
      link: `/audits/capa`,
      emailSubject: `[CRÍTICO] CAPA ${capa.code} — VENCIDA`,
      emailHtml: `<p style="color:#c0392b;font-weight:bold">⚠️ La siguiente CAPA ha vencido y sigue abierta:</p>
        <ul>
          <li><strong>Código:</strong> ${capa.code}</li>
          <li><strong>Descripción:</strong> ${desc}</li>
          <li><strong>Severidad:</strong> ${capa.severity}</li>
          <li><strong>Fecha límite:</strong> ${dateStr}</li>
        </ul>
        <p>Actualiza inmediatamente el estado en el sistema.</p>`,
    });
  }

  const total = warning.length + overdue.length;
  if (total) console.log(`[AuditCron] ${warning.length} warning(s), ${overdue.length} vencidas enviadas`);
}
