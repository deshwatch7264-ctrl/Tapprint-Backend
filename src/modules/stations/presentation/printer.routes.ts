import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { printerController } from './printer.controller';

export const printerRouter = Router();

const stationIdParam = z.object({ stationId: z.string().uuid() });

printerRouter.get(
  '/stations/:stationId/printers',
  authenticate('customer', 'admin'),
  validate({ params: stationIdParam }),
  asyncHandler((req, res) => printerController.listByStation(req, res)),
);
