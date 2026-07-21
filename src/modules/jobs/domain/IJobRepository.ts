import { ColorMode, JobStatus, PrintJob } from '@prisma/client';

export interface CreateJobInput {
  userId?: string;
  sessionId?: string;
  stationId: string;
  printerId: string;
  fileId: string;
  pricingRuleId: string;
  color: ColorMode;
  copies: number;
  pageRange?: string;
  pagesToPrint: number;
  paperSize: string;
  duplex: boolean;
  orientation: string;
  subtotal: number;
  discount: number;
  amount: number;
  currency: string;
  idempotencyKey?: string;
}

export interface JobListFilter {
  stationId?: string;
  status?: JobStatus;
  from?: Date;
  to?: Date;
}

export interface IJobRepository {
  create(input: CreateJobInput): Promise<PrintJob>;
  findById(id: string): Promise<PrintJob | null>;
  findByIdempotencyKey(key: string): Promise<PrintJob | null>;
  updateStatus(
    id: string,
    status: JobStatus,
    extra?: Partial<Pick<PrintJob, 'queuedAt' | 'printedAt' | 'completedAt' | 'failureReason'>>,
  ): Promise<PrintJob>;
  list(
    filter: JobListFilter,
    skip: number,
    take: number,
  ): Promise<{ items: PrintJob[]; total: number }>;
  recordEvent(
    jobId: string,
    from: JobStatus | null,
    to: JobStatus,
    actor: string,
    detail?: string,
  ): Promise<void>;
}
