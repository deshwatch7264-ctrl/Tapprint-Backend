import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors/AppError';
import { NotFoundError } from '../shared/errors/http-errors';
import { logger } from '../shared/logger/logger';
import { config } from '../config';

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Maps a Prisma known-request error to an AppError.
 */
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case 'P2002':
      return new AppError('A record with these values already exists', 409, 'CONFLICT');
    case 'P2025':
      return new AppError('Record not found', 404, 'NOT_FOUND');
    case 'P2003':
      return new AppError('Related record constraint failed', 409, 'CONFLICT');
    default:
      return new AppError('Database error', 500, 'DATABASE_ERROR', undefined, false);
  }
}

/**
 * Global error handler. Produces the standard error envelope and never leaks
 * internal details in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required for Express to treat this as an error handler
  _next: NextFunction,
): void {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    appError = mapPrismaError(err);
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    appError = new AppError('Invalid database query', 400, 'VALIDATION_ERROR');
  } else {
    appError = new AppError(
      err instanceof Error ? err.message : 'Internal server error',
      500,
      'INTERNAL',
      undefined,
      false,
    );
  }

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    code: appError.code,
  };

  if (appError.statusCode >= 500 || !appError.isOperational) {
    logger.error(appError.message, { ...logPayload, stack: appError.stack });
  } else {
    logger.warn(appError.message, logPayload);
  }

  const exposeMessage = appError.isOperational || !config.isProduction;

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: exposeMessage ? appError.message : 'Something went wrong',
      details: appError.details,
      requestId: req.requestId,
    },
  });
}
