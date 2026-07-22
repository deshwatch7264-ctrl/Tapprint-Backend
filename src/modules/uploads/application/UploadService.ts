import { randomUUID } from 'crypto';
import path from 'path';
import { FileStatus, StationStatus, UploadedFile } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { config } from '../../../config';
import { IStorageService, storageService } from '../../../infrastructure/storage/StorageService';
import { logger } from '../../../shared/logger/logger';
import { UpdateProcessingInput } from '../domain/IUploadRepository';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../shared/errors/http-errors';
import { IStationRepository } from '../../stations/domain/IStationRepository';
import { stationRepository } from '../../stations/infrastructure/StationRepository';
import { IUploadRepository } from '../domain/IUploadRepository';
import { uploadRepository } from '../infrastructure/UploadRepository';

export interface CreateUploadResult {
  fileId: string;
  uploadUrl: string;
  method: 'PUT';
  expiresIn: number;
  maxSizeBytes: number;
}

export interface FileStatusResult {
  fileId: string;
  status: FileStatus;
  pageCount: number | null;
  rejectReason: string | null;
  expiresAt: Date | null;
}

export class UploadService {
  constructor(
    private readonly uploads: IUploadRepository = uploadRepository,
    private readonly stations: IStationRepository = stationRepository,
    private readonly storage: IStorageService = storageService,
  ) {}

  async createUpload(
    stationId: string,
    sessionId: string,
    userId: string | undefined,
    filename: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<CreateUploadResult> {
    const station = await this.stations.findById(stationId);
    if (!station) throw new NotFoundError('Station not found');
    if (station.status !== StationStatus.active) {
      throw new ConflictError(`Station is currently ${station.status}`);
    }

    if (sizeBytes > config.uploads.maxBytes) {
      throw new BadRequestError('File exceeds the maximum allowed size');
    }
    if (!(config.uploads.allowedMimeTypes as readonly string[]).includes(mimeType)) {
      throw new BadRequestError('Unsupported file type');
    }

    const ext = path.extname(filename).slice(0, 12);
    const storageKey = `stations/${stationId}/originals/${randomUUID()}${ext}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const file = await this.uploads.create({
      stationId,
      userId,
      sessionId,
      originalFilename: filename,
      mimeType,
      sizeBytes,
      storageKey,
      expiresAt,
    });

    const presigned = await this.storage.createUploadUrl(storageKey, mimeType);

    return {
      fileId: file.id,
      uploadUrl: presigned.uploadUrl,
      method: 'PUT',
      expiresIn: presigned.expiresIn,
      maxSizeBytes: config.uploads.maxBytes,
    };
  }

  /**
   * Called after the client has PUT the object to storage. Transitions the file
   * into the processing pipeline (scan -> convert -> page count), which is
   * handled asynchronously by the File Service worker.
   */
  async completeUpload(fileId: string, stationId: string, sessionId: string): Promise<FileStatusResult> {
    const file = await this.getOwnedFile(fileId, stationId, sessionId);
    if (file.status !== FileStatus.uploading) {
      throw new ConflictError(`File cannot be completed from status ${file.status}`);
    }

    await this.uploads.updateStatus(fileId, FileStatus.scanning);
    logger.info('Upload completed, processing', { fileId, mimeType: file.mimeType });

    // Process inline: read the stored object, detect page count, mark ready.
    // (For higher volume this moves to a dedicated worker; the logic is here.)
    try {
      const result = await this.process(file);
      const updated = await this.uploads.updateProcessing(fileId, result);
      logger.info('File processed', { fileId, status: result.status, pageCount: result.pageCount });
      return this.toStatus(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      logger.error('File processing failed', { fileId, message });
      const updated = await this.uploads.updateProcessing(fileId, {
        status: FileStatus.rejected,
        rejectReason: message,
      });
      return this.toStatus(updated);
    }
  }

  /**
   * Detects the page count of the uploaded document. PDFs are parsed for their
   * real page count; images count as a single page. Office formats need
   * conversion (not enabled in this deployment yet) and are rejected clearly.
   */
  private async process(file: UploadedFile): Promise<UpdateProcessingInput> {
    if (file.mimeType === 'application/pdf') {
      const bytes = await this.storage.getObjectBytes(file.storageKey);
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      const pageCount = doc.getPageCount();
      if (pageCount < 1) {
        return { status: FileStatus.rejected, rejectReason: 'The PDF has no pages.' };
      }
      return { status: FileStatus.ready, pageCount, normalizedKey: file.storageKey };
    }

    if (file.mimeType.startsWith('image/')) {
      // Convert the image into a proper A4 PDF so the print agent (which prints
      // PDFs) produces a real page instead of a blank/garbage one.
      const bytes = await this.storage.getObjectBytes(file.storageKey);
      const pdf = await PDFDocument.create();
      const image =
        file.mimeType === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

      const pageW = 595.28; // A4 width in points
      const pageH = 841.89; // A4 height in points
      const margin = 24;
      const page = pdf.addPage([pageW, pageH]);
      const scale = Math.min(
        (pageW - margin * 2) / image.width,
        (pageH - margin * 2) / image.height,
        1,
      );
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });

      const pdfBytes = Buffer.from(await pdf.save());
      const normalizedKey = `${file.storageKey}.pdf`;
      await this.storage.putObject(normalizedKey, pdfBytes, 'application/pdf');

      return { status: FileStatus.ready, pageCount: 1, normalizedKey };
    }

    return {
      status: FileStatus.rejected,
      rejectReason: 'Only PDF and image files are supported right now. Please upload a PDF.',
    };
  }

  async getStatus(fileId: string, stationId: string, sessionId: string): Promise<FileStatusResult> {
    const file = await this.getOwnedFile(fileId, stationId, sessionId);
    return this.toStatus(file);
  }

  /**
   * Loads a file and verifies the caller owns it. Ownership is scoped by both
   * station and the customer's session, preventing one customer from accessing
   * another's document even at the same station.
   */
  private async getOwnedFile(
    fileId: string,
    stationId: string,
    sessionId: string,
  ): Promise<UploadedFile> {
    const file = await this.uploads.findById(fileId);
    if (!file || file.stationId !== stationId) {
      throw new NotFoundError('File not found');
    }
    if (file.sessionId && file.sessionId !== sessionId) {
      // Do not leak existence to a different session.
      throw new NotFoundError('File not found');
    }
    return file;
  }

  private toStatus(file: UploadedFile): FileStatusResult {
    return {
      fileId: file.id,
      status: file.status,
      pageCount: file.pageCount,
      rejectReason: file.rejectReason,
      expiresAt: file.expiresAt,
    };
  }
}

export const uploadService = new UploadService();
