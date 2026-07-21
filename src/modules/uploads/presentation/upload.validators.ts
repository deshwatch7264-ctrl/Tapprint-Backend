import { z } from 'zod';
import { config } from '../../../config';

export const createUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(config.uploads.allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(config.uploads.maxBytes),
});

export const fileIdParamSchema = z.object({
  fileId: z.string().uuid(),
});
