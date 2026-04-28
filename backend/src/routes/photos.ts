import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import { upload, UPLOAD_DIR } from '../services/upload';

const router = Router();
router.use(authenticate);

router.post('/:workOrderId', upload.array('photos', 10), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const { phase } = req.body as { phase: string };

  if (!files?.length) return res.status(400).json({ error: 'No se recibieron archivos' });
  if (!['BEFORE', 'AFTER'].includes(phase)) return res.status(400).json({ error: 'Phase debe ser BEFORE o AFTER' });

  const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.workOrderId } });
  if (!workOrder) return res.status(404).json({ error: 'Orden no encontrada' });

  const photos = await Promise.all(
    files.map((file) =>
      prisma.photo.create({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          phase,
          workOrderId: req.params.workOrderId,
          uploadedById: req.user!.userId,
        },
      })
    )
  );

  res.status(201).json(photos);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });

  const filePath = path.join(UPLOAD_DIR, photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await prisma.photo.delete({ where: { id: req.params.id } });
  res.json({ message: 'Foto eliminada' });
});

export default router;
