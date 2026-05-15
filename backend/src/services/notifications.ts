import { Server as SocketServer } from 'socket.io';
import { prisma } from './prisma';
import { sendNotificationEmail } from './email';

export type NotifType =
  | 'AUDIT_ASSIGNED'
  | 'CAPA_ASSIGNED'
  | 'AUDIT_REMINDER'
  | 'CAPA_WARNING'
  | 'CAPA_OVERDUE'
  | 'AUDIT_LOW_SCORE';

export interface NotifPayload {
  type: NotifType;
  referenceId: string;
  userId: string;
  message: string;
  link?: string;
  emailSubject?: string;
  emailHtml?: string;
}

let _io: SocketServer | null = null;

export function initNotifications(io: SocketServer) {
  _io = io;
}

export async function sendNotification(payload: NotifPayload): Promise<void> {
  // 1. Persistir — idempotente: si ya existe no se duplica
  let notification: { id: string; createdAt: Date } | null = null;
  try {
    notification = await prisma.notification.upsert({
      where: {
        type_referenceId_userId: {
          type: payload.type,
          referenceId: payload.referenceId,
          userId: payload.userId,
        },
      },
      update: {},
      create: {
        type: payload.type,
        referenceId: payload.referenceId,
        userId: payload.userId,
        message: payload.message,
        link: payload.link ?? null,
      },
    });
  } catch (e) {
    console.error('[Notifications] Error al persistir:', e);
    return;
  }

  // 2. Emitir via Socket.IO al usuario específico (no bloquea)
  if (_io && notification) {
    try {
      _io.to(`user:${payload.userId}`).emit('notification', {
        id: notification.id,
        type: payload.type,
        message: payload.message,
        link: payload.link,
        read: false,
        createdAt: notification.createdAt,
      });
    } catch (e) {
      console.error('[Notifications] Socket emit error (no fatal):', e);
    }
  }

  // 3. Enviar email — completamente aislado, no interrumpe el flujo
  if (payload.emailSubject && payload.emailHtml) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        await sendNotificationEmail({
          to: user.email,
          name: user.name,
          subject: payload.emailSubject,
          html: payload.emailHtml,
        });
      }
    } catch (e) {
      console.error('[Notifications] Email error (no fatal):', e);
    }
  }
}

// Notifica a todos los usuarios de ciertos roles
export async function notifyByRole(
  roles: string[],
  payload: Omit<NotifPayload, 'userId'>,
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: roles }, active: true },
      select: { id: true },
    });
    await Promise.all(users.map((u) => sendNotification({ ...payload, userId: u.id })));
  } catch (e) {
    console.error('[Notifications] notifyByRole error:', e);
  }
}
