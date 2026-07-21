import { Payment, PaymentStatus, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { CreatePaymentInput, IPaymentRepository } from '../domain/IPaymentRepository';

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(input: CreatePaymentInput): Promise<Payment> {
    return this.db.payment.create({
      data: {
        jobId: input.jobId,
        userId: input.userId,
        gateway: input.gateway,
        gatewayOrderId: input.gatewayOrderId,
        amount: input.amount,
        currency: input.currency,
        status: PaymentStatus.pending,
      },
    });
  }

  findById(id: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { id } });
  }

  findByJobId(jobId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByOrderId(orderId: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { gatewayOrderId: orderId } });
  }

  markCaptured(id: string, gatewayPaymentId: string, method: string): Promise<Payment> {
    return this.db.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.captured,
        gatewayPaymentId,
        method,
        webhookVerified: true,
        capturedAt: new Date(),
      },
    });
  }

  updateStatus(id: string, status: PaymentStatus, failureReason?: string): Promise<Payment> {
    return this.db.payment.update({
      where: { id },
      data: { status, failureReason },
    });
  }
}

export const paymentRepository = new PaymentRepository();
