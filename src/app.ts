import compression from 'compression';
import cors from 'cors';
import express, { Application, Request } from 'express';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './routes';
import './shared/types/express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { rateLimiters } from './middleware/rateLimit.middleware';
import { requestContext } from './middleware/requestContext.middleware';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.server.corsOrigin === '*' ? true : config.server.corsOrigin.split(','),
      credentials: true,
    }),
  );
  app.use(compression());

  // Capture the raw body buffer so webhook handlers can verify signatures.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: Request, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  app.use(requestContext);
  app.use(rateLimiters.global);

  app.use(config.server.apiPrefix, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
