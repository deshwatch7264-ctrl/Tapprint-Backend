import { z } from 'zod';

export const createOrderSchema = z.object({
  jobId: z.string().uuid(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const paymentIdParamSchema = z.object({
  paymentId: z.string().uuid(),
});

export const refundSchema = z.object({
  amount: z.number().int().positive().optional(),
  reason: z.string().min(1).max(500),
});
