import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { sendPartsRequestEmail, PartItem } from '../services/email';
import { prisma } from '../services/prisma';

const router = Router();
router.use(authenticate);

const partSchema = z.object({
  name: z.string().min(1, 'El nombre de la parte es requerido'),
  quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  notes: z.string().optional(),
});

const requestSchema = z.object({
  workOrderId: z.string(),
  parts: z.array(partSchema).min(1, 'Debes agregar al menos una parte'),
  additionalNotes: z.string().optional(),
  recipientEmail: z.string().email('Email destinatario inválido'),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { workOrderId, parts, additionalNotes, recipientEmail } = parsed.data;

  // Obtener orden con activo relacionado
  const order = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { asset: true },
  });
  if (!order) return res.status(404).json({ error: 'Orden de trabajo no encontrada' });

  // Obtener nombre del usuario que solicita
  const requester = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { name: true },
  });

  try {
    const result = await sendPartsRequestEmail({
      workOrderCode: order.code.slice(-8).toUpperCase(),
      workOrderTitle: order.title,
      assetName: order.asset.name,
      assetCode: order.asset.code,
      area: order.asset.area,
      parts: parts as PartItem[],
      additionalNotes,
      requestedBy: requester?.name ?? 'Usuario del sistema',
      recipientEmail,
    });

    // Registrar en el historial de la OT como comentario
    const partsLabel = parts.map((p) => `${p.name} ×${p.quantity}`).join(', ');
    await prisma.comment.create({
      data: {
        content: `📦 Solicitud de partes enviada a ${recipientEmail}: ${partsLabel}`,
        workOrderId,
        authorId: req.user!.userId,
      },
    });

    res.json({ ok: true, message: `Correo enviado a ${recipientEmail}`, previewUrl: result.previewUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
