import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { rateLimiters } from '../../../middleware/rateLimit.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { uploadController } from './upload.controller';
import { createUploadSchema, fileIdParamSchema } from './upload.validators';

export const uploadRouter = Router();

uploadRouter.use(authenticate('customer'));

uploadRouter.post(
  '/',
  rateLimiters.upload,
  validate({ body: createUploadSchema }),
  asyncHandler((req, res) => uploadController.create(req, res)),
);

uploadRouter.post(
  '/:fileId/complete',
  validate({ params: fileIdParamSchema }),
  asyncHandler((req, res) => uploadController.complete(req, res)),
);

uploadRouter.get(
  '/:fileId',
  validate({ params: fileIdParamSchema }),
  asyncHandler((req, res) => uploadController.status(req, res)),
);
