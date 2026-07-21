import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { logger } from './shared/logger/logger';

/**
 * Starts the HTTP server immediately. The health check (`/v1/health`) does not
 * depend on the database, so binding first means the platform health check
 * passes right away instead of waiting on (or being killed by) DB connection.
 */
function startServer(): http.Server {
  const app = createApp();
  const server = http.createServer(app);
  const port = config.server.port;

  // Bind explicitly to 0.0.0.0 so the container is reachable by the platform.
  server.listen(port, '0.0.0.0', () => {
    // console.log guarantees the line appears in platform logs even if a
    // structured-logging transport buffers.
    // eslint-disable-next-line no-console
    console.log(`TapPrint API listening on 0.0.0.0:${port} (env=${config.env}, prefix=${config.server.apiPrefix})`);
    logger.info('TapPrint API listening', { port, env: config.env });
  });

  return server;
}

/**
 * Connects to the database in the background with retries. Failures are logged
 * loudly (never silently killing the process), so the server stays up and the
 * real error is visible in logs.
 */
async function connectWithRetry(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await connectDatabase();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`Database connect attempt ${attempt}/${retries} failed: ${message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  // eslint-disable-next-line no-console
  console.error('Database not connected after retries. Server is up; DB-backed routes will error until the DB is reachable.');
}

function main(): void {
  const server = startServer();

  // Kick off DB connection without blocking the server from listening.
  void connectWithRetry();

  const shutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', String(reason));
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('Uncaught exception:', err);
  });
}

main();
