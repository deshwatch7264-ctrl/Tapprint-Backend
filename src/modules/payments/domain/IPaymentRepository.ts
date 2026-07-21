import { Payment, PaymentStatus } from '@prisma/client';

export interface CreatePaymentInput {
  jobId: string;
  userId?: string;
  gateway: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export interface IPaymentRepository {
  create(input: CreatePaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByJobId(jobId: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  markCaptured(id: string, gatewayPaymentId: string, method: string): Promise<Payment>;
  updateStatus(id: string, status: PaymentStatus, failureReason?: string): Promise<Payment>;
}
