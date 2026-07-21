import { Request, Response } from 'express';
import {
  BadRequestError,
  ForbiddenError,
  UnauthenticatedError,
} from '../../../shared/errors/http-errors';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { AdminPrincipal, CustomerPrincipal } from '../../../shared/types/auth';
import { paymentService } from '../application/PaymentService';
import { refundService } from '../application/RefundService';

function customer(req: Request): CustomerPrincipal {
  if (req.principal?.type !== 'customer') {
    throw new UnauthenticatedError('Customer session required');
  }
  return req.principal;
}

function admin(req: Request): AdminPrincipal {
  if (req.principal?.type !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  return req.principal;
}

export class PaymentController {
  async createOrder(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const { jobId } = req.body as { jobId: string };
    const result = await paymentService.createOrder(jobId, principal.stationId, principal.sessionId);
    sendSuccess(res, result, 201);
  }

  async getPayment(req: Request, res: Response): Promise<void> {
    customer(req);
    const result = await paymentService.getPayment(req.params.paymentId);
    sendSuccess(res, result, 200);
  }

  async verify(req: Request, res: Response): Promise<void> {
    customer(req);
    const { orderId, paymentId, signature } = req.body as {
      orderId: string;
      paymentId: string;
      signature: string;
    };
    const result = await paymentService.verifyClientPayment(orderId, paymentId, signature);
    sendSuccess(res, result, 200);
  }

  async webhook(req: Request, res: Response): Promise<void> {
    const signature = req.header('X-Razorpay-Signature');
    const eventId = req.header('X-Razorpay-Event-Id');
    if (!signature) throw new BadRequestError('Missing signature header');
    if (!req.rawBody) throw new BadRequestError('Missing raw request body');

    await paymentService.handleWebhook(req.rawBody, signature, eventId);
    res.status(200).json({ received: true });
  }

  async refund(req: Request, res: Response): Promise<void> {
    const principal = admin(req);
    const { amount, reason } = req.body as { amount?: number; reason: string };
    const result = await refundService.refundByPayment(
      req.params.paymentId,
      amount,
      reason,
      principal.id,
    );
    sendSuccess(res, result, 201);
  }
}

export const paymentController = new PaymentController();
