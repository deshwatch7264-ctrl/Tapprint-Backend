import { Refund, RefundStatus } from '@prisma/client';

export interface CreateRefundInput {
  paymentId: string;
  jobId: string;
  amount: number;
  reason?: string;
  initiatedBy?: string;
}

export interface IRefundRepository {
  create(input: CreateRefundInput): Promise<Refund>;
  findById(id: string): Promise<Refund | null>;
  findByJobId(jobId: string): Promise<Refund | null>;
  markResult(
    id: string,
    status: RefundStatus,
    gatewayRefundId?: string,
  ): Promise<Refund>;
}
