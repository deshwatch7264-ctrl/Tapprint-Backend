import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthenticatedError } from '../../shared/errors/http-errors';
import {
  AdminJwtPayload,
  AgentJwtPayload,
  AppJwtPayload,
  CustomerJwtPayload,
} from '../../shared/types/auth';

/**
 * Central JWT signing/verification for all three auth contexts.
 */
export class TokenService {
  signAdminAccess(payload: Omit<AdminJwtPayload, 'iat' | 'exp'>): string {
    return this.sign(payload, config.jwt.accessSecret, config.jwt.accessTtl);
  }

  signAdminRefresh(sub: string): string {
    return jwt.sign({ sub, type: 'admin', token: 'refresh' }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshTtl,
    });
  }

  signCustomerSession(payload: Omit<CustomerJwtPayload, 'iat' | 'exp'>): string {
    return this.sign(payload, config.jwt.accessSecret, config.jwt.sessionTtl);
  }

  signAgentToken(payload: Omit<AgentJwtPayload, 'iat' | 'exp'>): string {
    return this.sign(payload, config.jwt.accessSecret, config.jwt.agentTtl);
  }

  verifyAccess(token: string): AppJwtPayload {
    return this.verify(token, config.jwt.accessSecret);
  }

  verifyRefresh(token: string): { sub: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as { sub: string };
      return decoded;
    } catch {
      throw new UnauthenticatedError('Invalid or expired refresh token');
    }
  }

  private sign(
    payload: Record<string, unknown>,
    secret: string,
    expiresIn: number,
  ): string {
    const options: SignOptions = { expiresIn };
    return jwt.sign(payload, secret, options);
  }

  private verify(token: string, secret: string): AppJwtPayload {
    try {
      return jwt.verify(token, secret) as AppJwtPayload;
    } catch {
      throw new UnauthenticatedError('Invalid or expired token');
    }
  }
}

export const tokenService = new TokenService();
