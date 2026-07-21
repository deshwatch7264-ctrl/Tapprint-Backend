import { PricingRule } from '@prisma/client';

export interface IPricingRepository {
  findActiveByStation(stationId: string): Promise<PricingRule | null>;
}
