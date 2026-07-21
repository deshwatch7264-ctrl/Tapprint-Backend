import rateLimit, { Options } from 'express-rate-limit';
import { Request } from 'express';
import { RateLimitError } from '../shared/errors/http-errors';

function keyByPrincipalOrIp(req: Request): string {
  const p = req.principal;
  if (p?.type === 'admin') return `admin:${p.id}`;
  if (p?.type === 'customer') return `session:${p.sessionId}`;
  if (p?.type === 'agent') return `agent:${p.agentId}`;
  return `ip:${req.ip}`;
}

function build(windowMs: number, max: number, extra?: Partial<Options>) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByPrincipalOrIp,
    handler: (_req, _res, next) => next(new RateLimitError()),
    ...extra,
  });
}

export const rateLimiters = {
  auth: build(60_000, 5),
  session: build(60_000, 20),
  upload: build(60_000, 10),
  job: build(60_000, 20),
  payment: build(60_000, 15),
  agentPoll: build(60_000, 60),
  adminRead: build(60_000, 120),
  analytics: build(60_000, 30),
  global: build(60_000, 300),
};
