import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// ─── Leer config SMTP desde DB (con fallback a .env) ─────────────────────────

interface SmtpConfig {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; secure: boolean;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'smtp_config' } });
    if (setting) return JSON.parse(setting.value) as SmtpConfig;
  } catch { /* ignorar error de DB */ }
  return null;
}

// ── Transporter factory ───────────────────────────────────────────────────────
async function createTransporter(): Promise<{ t: nodemailer.Transporter; preview: boolean; from: string }> {
  const db = await getSmtpConfig();

  const host     = db?.host     || process.env.SMTP_HOST || '';
  const user     = db?.user     || process.env.SMTP_USER || '';
  const pass     = db?.pass     || process.env.SMTP_PASS || '';
  const port     = db?.port     || Number(process.env.SMTP_PORT) || 587;
  const secure   = db?.secure   ?? (process.env.SMTP_SECURE === 'true');
  const fromAddr = db?.from     || process.env.SMTP_FROM || user || 'notificaciones@senz.mx';
  const fromName = db?.fromName || 'Senz — Gestión Industrial';
  const from     = `"${fromName}" <${fromAddr}>`;

  if (!host || !user || !pass) {
    const testAccount = await nodemailer.createTestAccount();
    return {
      t: nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      }),
      preview: true,
      from,
    };
  }

  return {
    t: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
    preview: false,
    from,
  };
}

// ── Notificación genérica ────────────────────────────────────────────────────
export interface NotificationEmailOptions {
  to: string; name: string; subject: string; html: string;
}

export async function sendNotificationEmail(opts: NotificationEmailOptions): Promise<{ previewUrl?: string }> {
  const { t, preview, from } = await createTransporter();

  const info = await t.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1c1c1c">
  <div style="background:#e67e22;padding:14px 22px;border-radius:6px 6px 0 0">
    <h2 style="color:#fff;margin:0;font-size:16px">Senz — Sistema de Gestión Industrial</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:22px">
    <p style="margin:0 0 10px;font-size:14px">Hola, <strong>${opts.name}</strong></p>
    ${opts.html}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="font-size:11px;color:#bbb;margin:0">Mensaje automático — no responder a este correo.</p>
  </div>
</body>
</html>`,
  });

  if (preview) {
    const url = nodemailer.getTestMessageUrl(info);
    console.log('[Email] Notificación (Ethereal):', url);
    return { previewUrl: url || undefined };
  }
  return {};
}

// ── Partes / Refacciones ─────────────────────────────────────────────────────
export interface PartItem { name: string; quantity: number; notes?: string }

export interface PartsRequestOptions {
  workOrderCode: string; workOrderTitle: string; assetName: string;
  assetCode: string; area: string; parts: PartItem[];
  additionalNotes?: string; requestedBy: string; recipientEmail: string;
}

export async function sendPartsRequestEmail(opts: PartsRequestOptions): Promise<{ previewUrl?: string }> {
  const { t: transporter, preview, from } = await createTransporter();

  if (preview) console.log('⚠️  SMTP no configurado — usando Ethereal (correo de prueba)');

  const partsRows = opts.parts.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
      <td style="padding:8px 12px;border:1px solid #e0e0e0;text-align:center">${i + 1}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0;font-weight:600">${p.name}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0;text-align:center">${p.quantity}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0">${p.notes || '—'}</td>
    </tr>`).join('');

  const notesSection = opts.additionalNotes
    ? `<h3 style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin:20px 0 8px">Notas Adicionales</h3>
       <div style="background:#f9f9f9;border:1px solid #e0e0e0;padding:12px;border-radius:4px;font-size:13px;line-height:1.6">${opts.additionalNotes}</div>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1c1c1c">
  <div style="background:#e67e22;padding:16px 24px;border-radius:6px 6px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">🔧 Solicitud de Partes / Refacciones</h2>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:12px">Sistema de Gestión de Mantenimiento Industrial</p>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px 24px">
    <h3 style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px">Datos de la Orden de Trabajo</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <tr><td style="padding:5px 0;color:#888;width:140px">Código OT</td><td style="padding:5px 0;font-weight:700;color:#e67e22">${opts.workOrderCode}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Título</td><td style="padding:5px 0">${opts.workOrderTitle}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Equipo</td><td style="padding:5px 0">${opts.assetName} <span style="color:#888">(${opts.assetCode})</span></td></tr>
      <tr><td style="padding:5px 0;color:#888">Área</td><td style="padding:5px 0">${opts.area}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Solicitado por</td><td style="padding:5px 0;font-weight:600">${opts.requestedBy}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Fecha / Hora</td><td style="padding:5px 0">${new Date().toLocaleString('es-MX', { dateStyle:'long', timeStyle:'short' })}</td></tr>
    </table>
    <h3 style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">Partes / Refacciones Requeridas</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead>
        <tr style="background:#e67e22;color:#fff">
          <th style="padding:8px 12px;border:1px solid #e0e0e0;width:36px">#</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left">Parte / Refacción</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;width:80px">Cantidad</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left">Notas</th>
        </tr>
      </thead>
      <tbody>${partsRows}</tbody>
    </table>
    ${notesSection}
  </div>
  <p style="font-size:11px;color:#bbb;text-align:center;margin-top:14px">Generado automáticamente por el Sistema de Mantenimiento Industrial</p>
</body>
</html>`;

  const info = await transporter.sendMail({
    from,
    to:      opts.recipientEmail,
    subject: `[PARTES] OT ${opts.workOrderCode} — ${opts.assetName}`,
    html,
  });

  if (preview) {
    const url = nodemailer.getTestMessageUrl(info);
    console.log('\n📧 ─────────────────────────────────────────────');
    console.log('   CORREO DE PRUEBA — ábrelo en el navegador:');
    console.log('  ', url);
    console.log('───────────────────────────────────────────────\n');
    return { previewUrl: url || undefined };
  }
  return {};
}
