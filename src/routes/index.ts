import { Router } from 'express';
import { authRouter } from '../modules/auth/presentation/auth.routes';
import { uploadRouter } from '../modules/uploads/presentation/upload.routes';
import { jobRouter } from '../modules/jobs/presentation/job.routes';
import { paymentRouter } from '../modules/payments/presentation/payment.routes';
import { printerRouter } from '../modules/stations/presentation/printer.routes';
import { agentAuthRouter, agentRouter } from '../modules/agent/presentation/agent.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/auth', agentAuthRouter); // POST /auth/agent/token
apiRouter.use('/uploads', uploadRouter);
apiRouter.use('/jobs', jobRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/', printerRouter);
