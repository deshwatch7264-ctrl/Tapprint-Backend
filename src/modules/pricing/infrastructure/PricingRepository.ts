import { PricingRule, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { IPricingRepository } from '../domain/IPricingRepository';

export class PricingRepository implements IPricingRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findActiveByStation(stationId: string): Promise<PricingRule | null> {
    return this.db.pricingRule.findFirst({
      where: { stationId, isActive: true },
      orderBy: { version: 'desc' },
    });
  }
}

export const pricingRepository = new PricingRepository();
