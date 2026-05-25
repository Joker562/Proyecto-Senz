import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// ─── Config SMTP desde DB ─────────────────────────────────────────────────────

interface SmtpConfig {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; secure: boolean;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'smtp_config' } });
    if (setting) return JSON.parse(setting.value) as SmtpConfig;
  } catch { /* ignorar */ }
  return null;
}

// ─── Interfaces públicas ──────────────────────────────────────────────────────

export interface NotificationEmailOptions {
  to: string; name: string; subject: string; html: string;
}

export interface PartItem { name: string; quantity: number; notes?: string }

export interface PartsRequestOptions {
  workOrderCode: string; workOrderTitle: string; assetName: string;
  assetCode: string; area: string; parts: PartItem[];
  additionalNotes?: string; requestedBy: string; recipientEmail: string;
}

// ─── HTML wrapper común ───────────────────────────────────────────────────────

function wrapHtml(name: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1c1c1c">
  <div style="background:#e67e22;padding:14px 22px;border-radius:6px 6px 0 0">
    <h2 style="color:#fff;margin:0;font-size:16px">Senz — Sistema de Gestión Industrial</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:22px">
    <p style="margin:0 0 10px;font-size:14px">Hola, <strong>${name}</strong></p>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="font-size:11px;color:#bbb;margin:0">Mensaje automático — no responder a este correo.</p>
  </div>
</body>
</html>`;
}

// ─── Envío via Resend (HTTP API — sin SMTP) ───────────────────────────────────

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  cfg: SmtpConfig | null,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;
  const resend  = new Resend(apiKey);
  const fromName = cfg?.fromName || 'Senz — Gestión Industrial';

  // Resend requiere dominio verificado. gmail.com no se puede verificar,
  // así que usamos el dominio de Resend hasta que el usuario verifique el suyo.
  const fromAddr = (cfg?.from && !cfg.from.toLowerCase().includes('@gmail.com'))
    ? cfg.from
    : 'onboarding@resend.dev';

  console.log(`[Email/Resend] "${subject}" → ${to} (from: ${fromAddr})`);
  const { data, error } = await resend.emails.send({
    from:    `${fromName} <${fromAddr}>`,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  console.log(`[Email/Resend] OK id=${data?.id}`);
}

// ─── Envío via SMTP (fallback) ────────────────────────────────────────────────

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  cfg: SmtpConfig | null,
): Promise<{ previewUrl?: string }> {
  const host     = cfg?.host     || process.env.SMTP_HOST || '';
  const user     = cfg?.user     || process.env.SMTP_USER || '';
  const pass     = cfg?.pass     || process.env.SMTP_PASS || '';
  const port     = cfg?.port     || Number(process.env.SMTP_PORT) || 587;
  const secure   = cfg?.secure   ?? (process.env.SMTP_SECURE === 'true');
  const fromAddr = cfg?.from     || process.env.SMTP_FROM || user || 'notificaciones@senz.mx';
  const fromName = cfg?.fromName || 'Senz — Gestión Industrial';
  const from     = `"${fromName}" <${fromAddr}>`;
  const timeouts = { connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 25000 };

  if (!host || !user || !pass) {
    console.warn('[Email/SMTP] Sin credenciales — usando Ethereal (prueba).');
    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Ethereal timeout')), 8000)),
    ]);
    const t = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      ...timeouts,
    });
    const info = await t.sendMail({ from, to, subject, html });
    const url  = nodemailer.getTestMessageUrl(info);
    console.log('[Email/Ethereal] Preview URL:', url);
    return { previewUrl: url || undefined };
  }

  const transport = host === 'smtp.gmail.com'
    ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, ...timeouts })
    : nodemailer.createTransport({ host, port, secure, auth: { user, pass }, ...timeouts });

  console.log(`[Email/SMTP] "${subject}" → ${to}`);
  const info = await transport.sendMail({ from, to, subject, html });
  console.log(`[Email/SMTP] OK messageId=${info.messageId}`);
  return {};
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function sendNotificationEmail(
  opts: NotificationEmailOptions,
): Promise<{ previewUrl?: string }> {
  const cfg  = await getSmtpConfig();
  const html = wrapHtml(opts.name, opts.html);

  // Resend tiene prioridad si la variable de entorno está configurada
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(opts.to, opts.subject, html, cfg);
    return {};
  }

  return sendViaSmtp(opts.to, opts.subject, html, cfg);
}

export async function sendPartsRequestEmail(opts: PartsRequestOptions): Promise<{ previewUrl?: string }> {
  const cfg = await getSmtpConfig();

  const partsRows = opts.parts.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
      <td style="padding:8px 12px;border:1px solid #e0e0e0;text-align:center">${i + 1}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0;font-weight:600">${p.name}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0;text-align:center">${p.quantity}</td>
      <td style="padding:8px 12px;border:1px solid #e0e0e0">${p.notes || '—'}</td>
    </tr>`).join('');

  const notesSection = opts.additionalNotes
    ? `<h3 style="font-size:13px;color:#666;margin:20px 0 8px">Notas Adicionales</h3>
       <div style="background:#f9f9f9;border:1px solid #e0e0e0;padding:12px;font-size:13px">${opts.additionalNotes}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1c1c1c">
  <div style="background:#e67e22;padding:16px 24px;border-radius:6px 6px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">🔧 Solicitud de Partes / Refacciones</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px 24px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <tr><td style="padding:5px 0;color:#888;width:140px">Código OT</td><td style="font-weight:700;color:#e67e22">${opts.workOrderCode}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Título</td><td>${opts.workOrderTitle}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Equipo</td><td>${opts.assetName} (${opts.assetCode})</td></tr>
      <tr><td style="padding:5px 0;color:#888">Área</td><td>${opts.area}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Solicitado por</td><td style="font-weight:600">${opts.requestedBy}</td></tr>
      <tr><td style="padding:5px 0;color:#888">Fecha / Hora</td><td>${new Date().toLocaleString('es-MX', { dateStyle:'long', timeStyle:'short' })}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead>
        <tr style="background:#e67e22;color:#fff">
          <th style="padding:8px 12px;border:1px solid #e0e0e0;width:36px">#</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left">Parte</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;width:80px">Cant.</th>
          <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left">Notas</th>
        </tr>
      </thead>
      <tbody>${partsRows}</tbody>
    </table>
    ${notesSection}
  </div>
</body></html>`;

  if (process.env.RESEND_API_KEY) {
    await sendViaResend(opts.recipientEmail, `[PARTES] OT ${opts.workOrderCode} — ${opts.assetName}`, html, cfg);
    return {};
  }
  return sendViaSmtp(opts.recipientEmail, `[PARTES] OT ${opts.workOrderCode} — ${opts.assetName}`, html, cfg);
}
