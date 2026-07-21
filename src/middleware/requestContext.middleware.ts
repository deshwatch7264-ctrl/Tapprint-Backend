import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique request id used for log correlation and error responses.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-Id');
  req.requestId = incoming && incoming.length <= 128 ? incoming : `req_${randomUUID()}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
