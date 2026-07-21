import crypto from 'crypto';
import Razorpay from 'razorpay';
import { config } from '../../config';
import { logger } from '../../shared/logger/logger';

export interface CreatedOrder {
  orderId: string;
  amount: number;
  currency: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

/**
 * Wraps the Razorpay SDK: order creation, webhook signature verification,
 * and refunds. All amounts are in the smallest currency unit (paise).
 */
export interface IPaymentGateway {
  createOrder(amount: number, currency: string, receipt: string): Promise<CreatedOrder>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean;
  refund(paymentId: string, amount: number): Promise<RefundResult>;
}

export class RazorpayService implements IPaymentGateway {
  private readonly client: Razorpay;

  constructor() {
    this.client = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }

  async createOrder(
    amount: number,
    currency: string,
    receipt: string,
  ): Promise<CreatedOrder> {
    const order = await this.client.orders.create({
      amount,
      currency,
      receipt,
      payment_capture: true,
    });
    return {
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  /**
   * Verifies the webhook payload against the shared secret using a constant-time
   * comparison to prevent timing attacks.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return this.timingSafeEqualHex(expected, signature);
  }

  /**
   * Verifies the checkout success signature returned to the client:
   * HMAC_SHA256(order_id + "|" + payment_id, key_secret). This lets the app
   * confirm payment immediately while the webhook remains the authoritative
   * backstop.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return this.timingSafeEqualHex(expected, signature);
  }

  private timingSafeEqualHex(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided ?? '', 'utf8');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    const refund = await this.client.payments.refund(paymentId, { amount });
    logger.info('Refund issued', { paymentId, refundId: refund.id });
    return { refundId: refund.id, status: String(refund.status) };
  }
}

export const paymentGateway: IPaymentGateway = new RazorpayService();
