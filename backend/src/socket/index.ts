import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export function setupSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      socket.data.user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as JwtPayload;
    socket.join(`role:${user.role}`);
    console.log(`[Socket] ${user.email} conectado`);

    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.email} desconectado`);
    });
  });

  return io;
}
