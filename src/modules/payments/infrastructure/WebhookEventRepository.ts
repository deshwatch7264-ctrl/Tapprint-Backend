import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';

export interface RecordEventInput {
  eventId: string;
  eventType: string;
  signature?: string;
  payloadHash?: string;
}

/**
 * Persists processed webhook event ids. The unique constraint on `eventId`
 * provides replay-attack protection: a replayed delivery fails to insert.
 */
export class WebhookEventRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Attempts to claim an event id. Returns true if this is the first time we've
   * seen it, false if it was already processed (duplicate/replay).
   */
  async claim(input: RecordEventInput): Promise<boolean> {
    try {
      await this.db.webhookEvent.create({
        data: {
          eventId: input.eventId,
          eventType: input.eventType,
          signature: input.signature,
          payloadHash: input.payloadHash,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false; // already processed
      }
      throw err;
    }
  }

  /**
   * Releases a claimed event id so a legitimate retry can reprocess it after a
   * transient processing failure.
   */
  async release(eventId: string): Promise<void> {
    await this.db.webhookEvent.deleteMany({ where: { eventId } });
  }
}

export const webhookEventRepository = new WebhookEventRepository();
