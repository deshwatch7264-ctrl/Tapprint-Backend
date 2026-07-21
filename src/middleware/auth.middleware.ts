import { AdminRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { tokenService } from '../infrastructure/auth/TokenService';
import { ForbiddenError, UnauthenticatedError } from '../shared/errors/http-errors';
import { Principal, PrincipalType } from '../shared/types/auth';

function extractBearer(req: Request): string {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Missing bearer token');
  }
  return header.slice('Bearer '.length).trim();
}

function toPrincipal(token: string): Principal {
  const payload = tokenService.verifyAccess(token);
  switch (payload.type) {
    case 'admin':
      return { type: 'admin', id: payload.sub, role: payload.role, email: payload.email };
    case 'customer':
      return {
        type: 'customer',
        sessionId: payload.sub,
        stationId: payload.stationId,
        userId: payload.userId,
      };
    case 'agent':
      return { type: 'agent', agentId: payload.sub, stationId: payload.stationId };
    default:
      throw new UnauthenticatedError('Unknown token type');
  }
}

/**
 * Requires a valid token of one of the allowed principal types.
 */
export function authenticate(...allowed: PrincipalType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const principal = toPrincipal(extractBearer(req));
      if (allowed.length && !allowed.includes(principal.type)) {
        throw new ForbiddenError('This endpoint is not available for your token type');
      }
      req.principal = principal;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires an admin principal with one of the given roles.
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal = req.principal;
    if (!principal || principal.type !== 'admin') {
      next(new ForbiddenError('Admin access required'));
      return;
    }
    if (roles.length && !roles.includes(principal.role)) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }
    next();
  };
}
