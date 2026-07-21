import { PrismaClient, Refund, RefundStatus } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { CreateRefundInput, IRefundRepository } from '../domain/IRefundRepository';

export class RefundRepository implements IRefundRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(input: CreateRefundInput): Promise<Refund> {
    return this.db.refund.create({
      data: {
        paymentId: input.paymentId,
        jobId: input.jobId,
        amount: input.amount,
        reason: input.reason,
        initiatedBy: input.initiatedBy,
        status: RefundStatus.initiated,
      },
    });
  }

  findById(id: string): Promise<Refund | null> {
    return this.db.refund.findUnique({ where: { id } });
  }

  findByJobId(jobId: string): Promise<Refund | null> {
    return this.db.refund.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markResult(id: string, status: RefundStatus, gatewayRefundId?: string): Promise<Refund> {
    return this.db.refund.update({
      where: { id },
      data: { status, gatewayRefundId },
    });
  }
}

export const refundRepository = new RefundRepository();
