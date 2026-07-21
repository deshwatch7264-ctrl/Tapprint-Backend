import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../shared/errors/http-errors';

interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Validates and coerces request parts against Zod schemas. On success the
 * parsed values replace the raw request data so handlers receive typed input.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        // req.query is read-only in Express 5-style typings; assign via cast.
        Object.assign(req.query, schemas.query.parse(req.query));
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          issue: issue.message,
        }));
        next(new ValidationError('Request validation failed', details));
        return;
      }
      next(err);
    }
  };
}
