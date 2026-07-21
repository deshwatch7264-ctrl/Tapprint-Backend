import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../shared/logger/logger';

/**
 * Singleton Prisma client. In development we attach it to the global object so
 * hot-reloading (ts-node-dev) doesn't exhaust the connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isProduction
      ? [{ emit: 'stdout', level: 'error' }]
      : [
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
