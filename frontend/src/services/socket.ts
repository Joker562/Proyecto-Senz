import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// En producción usa el backend de Railway; en local usa el origin (Vite proxea /socket.io al puerto 4000)
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
  });

  socket.on('connect_error', (err) => console.error('[Socket]', err.message));
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
