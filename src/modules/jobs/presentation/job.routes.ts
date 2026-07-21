import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { rateLimiters } from '../../../middleware/rateLimit.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { jobController } from './job.controller';
import { createJobSchema, jobIdParamSchema } from './job.validators';

export const jobRouter = Router();

jobRouter.use(authenticate('customer'));

jobRouter.post(
  '/',
  rateLimiters.job,
  validate({ body: createJobSchema }),
  asyncHandler((req, res) => jobController.create(req, res)),
);

jobRouter.get(
  '/:jobId',
  validate({ params: jobIdParamSchema }),
  asyncHandler((req, res) => jobController.get(req, res)),
);

jobRouter.post(
  '/:jobId/cancel',
  validate({ params: jobIdParamSchema }),
  asyncHandler((req, res) => jobController.cancel(req, res)),
);
