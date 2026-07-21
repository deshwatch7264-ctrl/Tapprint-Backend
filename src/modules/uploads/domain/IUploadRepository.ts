import { FileStatus, UploadedFile } from '@prisma/client';

export interface CreateUploadInput {
  stationId: string;
  userId?: string;
  sessionId?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  expiresAt: Date;
}

export interface UpdateProcessingInput {
  status: FileStatus;
  pageCount?: number;
  normalizedKey?: string;
  rejectReason?: string;
}

export interface IUploadRepository {
  create(input: CreateUploadInput): Promise<UploadedFile>;
  findById(id: string): Promise<UploadedFile | null>;
  updateStatus(id: string, status: FileStatus): Promise<UploadedFile>;
  updateProcessing(id: string, input: UpdateProcessingInput): Promise<UploadedFile>;
  markPurged(id: string): Promise<void>;
}
