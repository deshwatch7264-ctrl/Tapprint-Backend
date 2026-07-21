import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { config } from '../config';

/**
 * Multer configured for in-memory buffering with strict size and MIME limits.
 * Used for endpoints that accept a direct multipart upload (e.g., document
 * scanning fallback). Primary uploads use pre-signed S3 URLs.
 */
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const allowed = config.uploads.allowedMimeTypes as readonly string[];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxBytes,
    files: 10,
  },
  fileFilter,
});
