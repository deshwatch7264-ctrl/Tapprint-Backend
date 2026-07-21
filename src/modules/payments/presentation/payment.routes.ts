import { Router } from 'express';
import { authenticate, requireRole } from '../../../middleware/auth.middleware';
import { rateLimiters } from '../../../middleware/rateLimit.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminRole } from '@prisma/client';
import { paymentController } from './payment.controller';
import {
  createOrderSchema,
  paymentIdParamSchema,
  refundSchema,
  verifyPaymentSchema,
} from './payment.validators';

export const paymentRouter = Router();

// Webhook is public (verified by HMAC signature). The raw body buffer is
// captured globally by the express.json `verify` hook and read from req.rawBody.
paymentRouter.post(
  '/webhook',
  asyncHandler((req, res) => paymentController.webhook(req, res)),
);

paymentRouter.post(
  '/order',
  authenticate('customer'),
  rateLimiters.payment,
  validate({ body: createOrderSchema }),
  asyncHandler((req, res) => paymentController.createOrder(req, res)),
);

paymentRouter.post(
  '/verify',
  authenticate('customer'),
  rateLimiters.payment,
  validate({ body: verifyPaymentSchema }),
  asyncHandler((req, res) => paymentController.verify(req, res)),
);

paymentRouter.get(
  '/:paymentId',
  authenticate('customer'),
  validate({ params: paymentIdParamSchema }),
  asyncHandler((req, res) => paymentController.getPayment(req, res)),
);

paymentRouter.post(
  '/:paymentId/refund',
  authenticate('admin'),
  requireRole(AdminRole.super_admin, AdminRole.owner, AdminRole.support),
  validate({ params: paymentIdParamSchema, body: refundSchema }),
  asyncHandler((req, res) => paymentController.refund(req, res)),
);
