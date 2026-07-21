import { Request, Response } from 'express';
import { UnauthenticatedError } from '../../../shared/errors/http-errors';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { CustomerPrincipal } from '../../../shared/types/auth';
import { uploadService } from '../application/UploadService';

function customer(req: Request): CustomerPrincipal {
  if (req.principal?.type !== 'customer') {
    throw new UnauthenticatedError('Customer session required');
  }
  return req.principal;
}

export class UploadController {
  async create(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const { filename, mimeType, sizeBytes } = req.body as {
      filename: string;
      mimeType: string;
      sizeBytes: number;
    };
    const result = await uploadService.createUpload(
      principal.stationId,
      principal.sessionId,
      principal.userId,
      filename,
      mimeType,
      sizeBytes,
    );
    sendSuccess(res, result, 201);
  }

  async complete(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const result = await uploadService.completeUpload(
      req.params.fileId,
      principal.stationId,
      principal.sessionId,
    );
    sendSuccess(res, result, 202);
  }

  async status(req: Request, res: Response): Promise<void> {
    const principal = customer(req);
    const result = await uploadService.getStatus(
      req.params.fileId,
      principal.stationId,
      principal.sessionId,
    );
    sendSuccess(res, result, 200);
  }
}

export const uploadController = new UploadController();
