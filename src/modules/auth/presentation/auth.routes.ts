import { Router } from 'express';
import { rateLimiters } from '../../../middleware/rateLimit.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { authController } from './auth.controller';
import { adminLoginSchema, refreshSchema, sessionSchema } from './auth.validators';

export const authRouter = Router();

authRouter.post(
  '/session',
  rateLimiters.session,
  validate({ body: sessionSchema }),
  asyncHandler((req, res) => authController.startSession(req, res)),
);

authRouter.post(
  '/admin/login',
  rateLimiters.auth,
  validate({ body: adminLoginSchema }),
  asyncHandler((req, res) => authController.adminLogin(req, res)),
);

authRouter.post(
  '/admin/refresh',
  rateLimiters.auth,
  validate({ body: refreshSchema }),
  asyncHandler((req, res) => authController.refresh(req, res)),
);
