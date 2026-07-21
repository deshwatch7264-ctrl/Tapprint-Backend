import { FileStatus, PrismaClient, UploadedFile } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  CreateUploadInput,
  IUploadRepository,
  UpdateProcessingInput,
} from '../domain/IUploadRepository';

export class UploadRepository implements IUploadRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  create(input: CreateUploadInput): Promise<UploadedFile> {
    return this.db.uploadedFile.create({
      data: {
        stationId: input.stationId,
        userId: input.userId,
        sessionId: input.sessionId,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        storageKey: input.storageKey,
        expiresAt: input.expiresAt,
        status: FileStatus.uploading,
      },
    });
  }

  findById(id: string): Promise<UploadedFile | null> {
    return this.db.uploadedFile.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: FileStatus): Promise<UploadedFile> {
    return this.db.uploadedFile.update({ where: { id }, data: { status } });
  }

  updateProcessing(id: string, input: UpdateProcessingInput): Promise<UploadedFile> {
    return this.db.uploadedFile.update({
      where: { id },
      data: {
        status: input.status,
        pageCount: input.pageCount,
        normalizedKey: input.normalizedKey,
        rejectReason: input.rejectReason,
      },
    });
  }

  async markPurged(id: string): Promise<void> {
    await this.db.uploadedFile.update({
      where: { id },
      data: { status: FileStatus.purged, purgedAt: new Date() },
    });
  }
}

export const uploadRepository = new UploadRepository();
