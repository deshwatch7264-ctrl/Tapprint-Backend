import { AdminRole } from '@prisma/client';

export type PrincipalType = 'admin' | 'customer' | 'agent';

export interface AdminPrincipal {
  type: 'admin';
  id: string;
  role: AdminRole;
  email: string;
}

export interface CustomerPrincipal {
  type: 'customer';
  sessionId: string;
  stationId: string;
  userId?: string;
}

export interface AgentPrincipal {
  type: 'agent';
  agentId: string;
  stationId: string;
}

export type Principal = AdminPrincipal | CustomerPrincipal | AgentPrincipal;

export interface JwtPayloadBase {
  sub: string;
  type: PrincipalType;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload extends JwtPayloadBase {
  type: 'admin';
  role: AdminRole;
  email: string;
}

export interface CustomerJwtPayload extends JwtPayloadBase {
  type: 'customer';
  stationId: string;
  userId?: string;
}

export interface AgentJwtPayload extends JwtPayloadBase {
  type: 'agent';
  stationId: string;
}

export type AppJwtPayload =
  | AdminJwtPayload
  | CustomerJwtPayload
  | AgentJwtPayload;
