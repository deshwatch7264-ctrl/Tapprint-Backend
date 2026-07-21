import { ColorMode } from '@prisma/client';
import { Request, Response } from 'express';
import { UnauthenticatedError } from '../../../shared/errors/http-errors';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { CustomerPrincipal } from '../../../shared/types/auth';
import { jobService } from '../application/JobService';

function customer(req: Request): CustomerPrincipal {
  if (req.principal?.type !== 'customer') {
    throw new UnauthenticatedError('Customer session required');
  }
  return req.principal;
}

interface CreateJobBody {
  fileId: string;
  printerId: string;
  options: {
    color: ColorMode;
    copies: number;
    pageRange?: string;
    paperSize: string;
    duplex: boolean;
    orientation: string;
  };
}

export class JobController {
  async create(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const body = req.body as CreateJobBody;
    const idempotencyKey = req.header('Idempotency-Key') || undefined;

    const result = await jobService.createJob(
      principal.stationId,
      principal.sessionId,
      principal.userId,
      {
        fileId: body.fileId,
        printerId: body.printerId,
        color: body.options.color,
        copies: body.options.copies,
        pageRange: body.options.pageRange,
        paperSize: body.options.paperSize,
        duplex: body.options.duplex,
        orientation: body.options.orientation,
      },
      idempotencyKey,
    );

    sendSuccess(res, { jobId: result.job.jobId, status: result.job.status, pricing: result.pricing }, 201);
  }

  async get(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const job = await jobService.getJob(req.params.jobId, principal.stationId, principal.sessionId);
    sendSuccess(res, job, 200);
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const job = await jobService.cancelJob(req.params.jobId, principal.stationId, principal.sessionId);
    sendSuccess(res, job, 200);
  }
}

export const jobController = new JobController();
