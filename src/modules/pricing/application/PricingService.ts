import { ColorMode, PricingRule } from '@prisma/client';
import { NotFoundError, UnprocessableError } from '../../../shared/errors/http-errors';
import { IPricingRepository } from '../domain/IPricingRepository';
import { pricingRepository } from '../infrastructure/PricingRepository';

export interface PriceInput {
  pages: number;
  copies: number;
  color: ColorMode;
  paperSize: string;
  duplex: boolean;
}

export interface PriceBreakdownLine {
  label: string;
  amount: number;
}

export interface PriceResult {
  pricingRuleId: string;
  currency: string;
  subtotal: number;
  discount: number;
  amount: number;
  breakdown: PriceBreakdownLine[];
}

/**
 * Deterministic pricing computation. All amounts are integers in the smallest
 * currency unit (paise). The applied pricing rule id is returned so the job can
 * record the exact version used.
 */
export class PricingService {
  constructor(private readonly pricing: IPricingRepository = pricingRepository) {}

  async quote(stationId: string, input: PriceInput): Promise<PriceResult> {
    const rule = await this.pricing.findActiveByStation(stationId);
    if (!rule) {
      throw new NotFoundError('No active pricing rule for this station');
    }
    return this.compute(rule, input);
  }

  compute(rule: PricingRule, input: PriceInput): PriceResult {
    if (input.pages <= 0 || input.copies <= 0) {
      throw new UnprocessableError('Pages and copies must be positive');
    }

    const multiplier = this.paperMultiplier(rule, input.paperSize);
    const perPage = input.color === ColorMode.color ? rule.colorPagePrice : rule.bwPagePrice;

    const breakdown: PriceBreakdownLine[] = [];

    const lineBase = Math.round(perPage * multiplier);
    const pagesTotal = lineBase * input.pages * input.copies;
    breakdown.push({
      label: `${input.color === ColorMode.color ? 'Color' : 'B&W'} pages (${input.pages} × ${input.copies} copies)`,
      amount: pagesTotal,
    });

    let subtotal = pagesTotal;
    let discount = 0;

    if (input.duplex && rule.duplexDiscount > 0) {
      discount = Math.round(subtotal * rule.duplexDiscount);
      breakdown.push({
        label: `Duplex discount (-${Math.round(rule.duplexDiscount * 100)}%)`,
        amount: -discount,
      });
    }

    let amount = subtotal - discount;

    if (amount < rule.minimumCharge) {
      const topUp = rule.minimumCharge - amount;
      breakdown.push({ label: 'Minimum charge adjustment', amount: topUp });
      amount = rule.minimumCharge;
      subtotal = amount + discount;
    }

    return {
      pricingRuleId: rule.id,
      currency: rule.currency,
      subtotal,
      discount,
      amount,
      breakdown,
    };
  }

  private paperMultiplier(rule: PricingRule, paperSize: string): number {
    const map = (rule.paperMultiplier ?? {}) as Record<string, number>;
    return typeof map[paperSize] === 'number' ? map[paperSize] : 1;
  }
}

export const pricingService = new PricingService();
