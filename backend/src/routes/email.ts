import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { sendNotificationEmail } from '../services/email';

const router = Router();
router.use(authenticate);

// POST /api/email/send — envía un correo de notificación genérico (solo ADMIN/SUPERVISOR)
router.post('/send', authorize('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const user = (req as any).user;
  const { to: toBody, name, subject, html } = req.body as {
    to?: string; name?: string; subject?: string; html?: string;
  };

  const to = toBody || user?.email;

  if (!to || !name || !subject || !html) {
    return res.status(400).json({ error: 'Faltan campos: to, name, subject, html' });
  }

  try {
    const { previewUrl } = await sendNotificationEmail({ to, name, subject, html });
    return res.json({ ok: true, previewUrl: previewUrl ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Error al enviar correo', detail: msg });
  }
});

export default router;
