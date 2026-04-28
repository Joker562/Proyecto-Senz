export type Role = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'EXECUTIVE';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
