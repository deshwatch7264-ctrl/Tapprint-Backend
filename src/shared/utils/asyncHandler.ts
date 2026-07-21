import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so any rejected promise is forwarded to the
 * Express error-handling middleware instead of crashing the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
