import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { rateLimiters } from '../../../middleware/rateLimit.middleware';
import { validate } from '../../../middleware/validate.middleware';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { agentController } from './agent.controller';
import { heartbeatSchema, jobIdParamSchema, reportStatusSchema } from './agent.validators';

// Token exchange (public, authenticated by the X-Agent-Key header).
export const agentAuthRouter = Router();
agentAuthRouter.post(
  '/agent/token',
  rateLimiters.auth,
  asyncHandler((req, res) => agentController.token(req, res)),
);

// Authenticated agent operations.
export const agentRouter = Router();
agentRouter.use(authenticate('agent'));

agentRouter.post(
  '/heartbeat',
  validate({ body: heartbeatSchema }),
  asyncHandler((req, res) => agentController.heartbeat(req, res)),
);

agentRouter.get(
  '/jobs/next',
  rateLimiters.agentPoll,
  asyncHandler((req, res) => agentController.nextJob(req, res)),
);

agentRouter.post(
  '/jobs/:jobId/status',
  validate({ params: jobIdParamSchema, body: reportStatusSchema }),
  asyncHandler((req, res) => agentController.reportStatus(req, res)),
);
