import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { ApiError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization header');
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}
