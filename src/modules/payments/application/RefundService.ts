import { JobStatus, PaymentStatus, Refund, RefundStatus } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { IPaymentGateway, paymentGateway } from '../../../infrastructure/payment/RazorpayService';
import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
} from '../../../shared/errors/http-errors';
import { logger } from '../../../shared/logger/logger';
import { IPaymentRepository } from '../domain/IPaymentRepository';
import { paymentRepository } from '../infrastructure/PaymentRepository';
import { IRefundRepository } from '../domain/IRefundRepository';
import { refundRepository } from '../infrastructure/RefundRepository';

export interface RefundView {
  refundId: string;
  status: RefundStatus;
  amount: number;
}

/**
 * Refund use cases. Used for:
 *  - automatic refunds when a print permanently fails (called by the queue /
 *    agent status handler), and
 *  - manual refunds initiated by an admin.
 */
export class RefundService {
  constructor(
    private readonly payments: IPaymentRepository = paymentRepository,
    private readonly refunds: IRefundRepository = refundRepository,
    private readonly gateway: IPaymentGateway = paymentGateway,
  ) {}

  /** Automatic full refund for a failed job. Idempotent per job. */
  async refundForJob(jobId: string, reason: string, initiatedBy?: string): Promise<RefundView> {
    const payment = await this.payments.findByJobId(jobId);
    if (!payment) throw new NotFoundError('No payment found for this job');
    return this.execute(payment.id, payment.jobId, payment.amount, payment.gatewayPaymentId, payment.status, reason, initiatedBy);
  }

  /** Admin-initiated refund against a specific payment. */
  async refundByPayment(
    paymentId: string,
    amount: number | undefined,
    reason: string,
    adminId: string,
  ): Promise<RefundView> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const refundAmount = amount ?? payment.amount;
    if (refundAmount <= 0 || refundAmount > payment.amount) {
      throw new UnprocessableError('Invalid refund amount');
    }
    return this.execute(payment.id, payment.jobId, refundAmount, payment.gatewayPaymentId, payment.status, reason, adminId);
  }

  private async execute(
    paymentId: string,
    jobId: string,
    amount: number,
    gatewayPaymentId: string | null,
    paymentStatus: PaymentStatus,
    reason: string,
    initiatedBy?: string,
  ): Promise<RefundView> {
    if (paymentStatus !== PaymentStatus.captured) {
      throw new ConflictError('Only captured payments can be refunded');
    }
    if (!gatewayPaymentId) {
      throw new ConflictError('Payment has no gateway payment id to refund');
    }

    // Idempotency: if a refund already exists and is progressing, return it.
    const existing = await this.refunds.findByJobId(jobId);
    if (existing && existing.status !== RefundStatus.failed) {
      return this.toView(existing);
    }

    const refund = await this.refunds.create({ paymentId, jobId, amount, reason, initiatedBy });

    try {
      const result = await this.gateway.refund(gatewayPaymentId, amount);
      const status = result.status === 'processed' ? RefundStatus.succeeded : RefundStatus.processing;

      await prisma.$transaction([
        prisma.refund.update({
          where: { id: refund.id },
          data: { status, gatewayRefundId: result.refundId },
        }),
        prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.refunded },
        }),
        prisma.printJob.update({
          where: { id: jobId },
          data: { status: JobStatus.refunded },
        }),
        prisma.jobEvent.create({
          data: {
            jobId,
            toStatus: JobStatus.refunded,
            actor: initiatedBy ? `admin:${initiatedBy}` : 'system',
            detail: `Refund ${result.refundId}: ${reason}`,
          },
        }),
      ]);

      logger.info('Refund completed', { jobId, refundId: refund.id, amount });
      return { refundId: refund.id, status, amount };
    } catch (err) {
      await this.refunds.markResult(refund.id, RefundStatus.failed);
      logger.error('Refund failed at gateway', { jobId, message: (err as Error).message });
      throw err;
    }
  }

  private toView(refund: Refund): RefundView {
    return { refundId: refund.id, status: refund.status, amount: refund.amount };
  }
}

export const refundService = new RefundService();
