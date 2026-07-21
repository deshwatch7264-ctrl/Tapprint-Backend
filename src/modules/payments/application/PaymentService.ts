import crypto from 'crypto';
import { JobStatus, PaymentStatus } from '@prisma/client';
import { config } from '../../../config';
import { prisma } from '../../../infrastructure/database/prisma';
import { IPaymentGateway, paymentGateway } from '../../../infrastructure/payment/RazorpayService';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../../shared/errors/http-errors';
import { logger } from '../../../shared/logger/logger';
import { IPaymentRepository } from '../domain/IPaymentRepository';
import { paymentRepository } from '../infrastructure/PaymentRepository';
import { webhookEventRepository, WebhookEventRepository } from '../infrastructure/WebhookEventRepository';

export interface PaymentOrderResult {
  paymentId: string;
  gateway: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  checkout: { key: string; orderId: string };
}

interface RazorpayEntity {
  id: string;
  order_id: string;
  method?: string;
  error_description?: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity?: RazorpayEntity };
  };
}

const CAPTURE_EVENTS = new Set(['payment.captured', 'order.paid']);
const FAILURE_EVENTS = new Set(['payment.failed']);

/**
 * Razorpay payment orchestration.
 *
 * Consistency guarantees:
 *  - A job advances to `queued` only after payment is verified and the charged
 *    amount is reconciled against the job amount.
 *  - The capture is idempotent (guarded by a conditional update) so the webhook
 *    and the client verify call can both run safely.
 *  - Webhook replays are rejected via a unique event-id store.
 */
export class PaymentService {
  constructor(
    private readonly payments: IPaymentRepository = paymentRepository,
    private readonly events: WebhookEventRepository = webhookEventRepository,
    private readonly gateway: IPaymentGateway = paymentGateway,
  ) {}

  // ---- Create Order -------------------------------------------------------

  async createOrder(jobId: string, stationId: string, sessionId: string): Promise<PaymentOrderResult> {
    const job = await prisma.printJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError('Job not found');
    if (job.stationId !== stationId) throw new ForbiddenError('Job does not belong to this station');
    if (job.sessionId && job.sessionId !== sessionId) throw new NotFoundError('Job not found');

    const payableStatuses: JobStatus[] = [JobStatus.created, JobStatus.awaiting_payment];
    if (!payableStatuses.includes(job.status)) {
      throw new ConflictError(`Job is not payable in status ${job.status}`);
    }

    const existing = await this.payments.findByJobId(jobId);
    if (existing && existing.status === PaymentStatus.captured) {
      throw new ConflictError('Job has already been paid');
    }
    if (job.amount <= 0) {
      throw new UnprocessableError('Job amount must be positive');
    }

    const order = await this.gateway.createOrder(job.amount, job.currency, `job_${job.id}`);
    const payment = await this.payments.create({
      jobId: job.id,
      userId: job.userId ?? undefined,
      gateway: 'razorpay',
      gatewayOrderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
    });

    await prisma.$transaction([
      prisma.printJob.update({ where: { id: job.id }, data: { status: JobStatus.awaiting_payment } }),
      prisma.jobEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: JobStatus.awaiting_payment,
          actor: 'system',
          detail: 'Payment order created',
        },
      }),
    ]);

    return {
      paymentId: payment.id,
      gateway: payment.gateway,
      gatewayOrderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      checkout: { key: config.razorpay.keyId, orderId: order.orderId },
    };
  }

  async getPayment(paymentId: string): Promise<{
    paymentId: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    webhookVerified: boolean;
  }> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      webhookVerified: payment.webhookVerified,
    };
  }

  // ---- Client-side verification (fast path) -------------------------------

  /**
   * Verifies the checkout signature returned to the client and captures the
   * payment. The webhook remains the authoritative backstop; this just gives
   * the customer a faster confirmation.
   */
  async verifyClientPayment(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<{ status: JobStatus }> {
    if (!this.gateway.verifyPaymentSignature(orderId, paymentId, signature)) {
      throw new BadRequestError('Invalid payment signature');
    }
    const result = await this.capturePayment(orderId, paymentId, 'checkout');
    return { status: result.jobStatus };
  }

  // ---- Webhook (authoritative) --------------------------------------------

  /**
   * Processes a Razorpay webhook. Order of defenses:
   *  1. HMAC signature verification (authenticity)
   *  2. Event-id claim (replay-attack prevention)
   *  3. Amount reconciliation (tamper prevention)
   * If processing fails after the claim, the claim is released so a legitimate
   * retry can reprocess the event.
   */
  async handleWebhook(rawBody: Buffer, signature: string, eventId: string | undefined): Promise<void> {
    if (!this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestError('Invalid webhook signature');
    }
    if (!eventId) {
      throw new BadRequestError('Missing X-Razorpay-Event-Id header');
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestError('Malformed webhook payload');
    }

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const claimed = await this.events.claim({
      eventId,
      eventType: payload.event,
      signature,
      payloadHash,
    });
    if (!claimed) {
      logger.warn('Duplicate/replayed webhook ignored', { eventId, event: payload.event });
      return;
    }

    try {
      await this.route(payload);
    } catch (err) {
      // Release so Razorpay's retry can reprocess a transient failure.
      await this.events.release(eventId);
      throw err;
    }
  }

  private async route(payload: RazorpayWebhookPayload): Promise<void> {
    const entity = payload.payload?.payment?.entity;
    if (!entity?.order_id) {
      logger.info('Webhook without payment entity ignored', { event: payload.event });
      return;
    }

    if (CAPTURE_EVENTS.has(payload.event)) {
      await this.capturePayment(entity.order_id, entity.id, entity.method ?? 'unknown');
      return;
    }
    if (FAILURE_EVENTS.has(payload.event)) {
      await this.handleFailedPayment(entity.order_id, entity.id, entity.error_description ?? 'Payment failed');
      return;
    }
    logger.info('Unhandled webhook event ignored', { event: payload.event });
  }

  // ---- Capture (idempotent, transactional) --------------------------------

  private async capturePayment(
    orderId: string,
    gatewayPaymentId: string,
    method: string,
  ): Promise<{ jobStatus: JobStatus }> {
    const payment = await this.payments.findByOrderId(orderId);
    if (!payment) {
      throw new NotFoundError('Payment not found for order');
    }
    const job = await prisma.printJob.findUnique({ where: { id: payment.jobId } });
    if (!job) {
      throw new NotFoundError('Job not found for payment');
    }

    // Reconcile the charged amount against the job amount.
    if (payment.amount !== job.amount) {
      await this.payments.updateStatus(payment.id, PaymentStatus.failed, 'Amount mismatch');
      throw new ConflictError('Payment amount does not match job amount');
    }

    // Idempotent transition: only the first caller flips the payment to
    // captured and queues the job.
    const captured = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.captured } },
        data: {
          status: PaymentStatus.captured,
          gatewayPaymentId,
          method,
          webhookVerified: true,
          capturedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        return false; // already captured — no-op
      }

      // Queue creation — this is the print trigger. The Print Agent polling
      // GET /agent/jobs/next will pick up the freshly queued job.
      await tx.printJob.update({
        where: { id: job.id },
        data: { status: JobStatus.queued, queuedAt: new Date() },
      });
      await tx.jobEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: JobStatus.queued,
          actor: 'system',
          detail: `Payment captured (${gatewayPaymentId})`,
        },
      });
      return true;
    });

    if (captured) {
      logger.info('Payment captured, job queued for printing', {
        jobId: job.id,
        paymentId: payment.id,
        gatewayPaymentId,
      });
      return { jobStatus: JobStatus.queued };
    }

    logger.info('Capture is a no-op (already captured)', { paymentId: payment.id });
    return { jobStatus: JobStatus.queued };
  }

  // ---- Failed payment -----------------------------------------------------

  private async handleFailedPayment(
    orderId: string,
    gatewayPaymentId: string,
    reason: string,
  ): Promise<void> {
    const payment = await this.payments.findByOrderId(orderId);
    if (!payment) {
      logger.warn('Failed-payment webhook for unknown order', { orderId });
      return;
    }
    // Do not override a successful capture; just record the failed attempt so
    // the customer can retry payment on the same job.
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: [PaymentStatus.captured, PaymentStatus.refunded] } },
      data: { status: PaymentStatus.failed, failureReason: reason, gatewayPaymentId },
    });
    logger.info('Payment failed recorded', { paymentId: payment.id, reason });
  }
}

export const paymentService = new PaymentService();
