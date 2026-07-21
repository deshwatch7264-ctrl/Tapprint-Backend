import {
  ColorMode,
  FileStatus,
  JobStatus,
  PrintJob,
  StationStatus,
} from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnprocessableError,
} from '../../../shared/errors/http-errors';
import { logger } from '../../../shared/logger/logger';
import { IStationRepository } from '../../stations/domain/IStationRepository';
import { stationRepository } from '../../stations/infrastructure/StationRepository';
import { IUploadRepository } from '../../uploads/domain/IUploadRepository';
import { uploadRepository } from '../../uploads/infrastructure/UploadRepository';
import { pricingService, PricingService } from '../../pricing/application/PricingService';
import { IJobRepository } from '../domain/IJobRepository';
import { jobRepository } from '../infrastructure/JobRepository';
import { countPagesInRange } from '../domain/pageRange';

export interface CreateJobRequest {
  fileId: string;
  printerId: string;
  color: ColorMode;
  copies: number;
  pageRange?: string;
  paperSize: string;
  duplex: boolean;
  orientation: string;
}

export interface JobView {
  jobId: string;
  status: JobStatus;
  stationId: string;
  printerId: string | null;
  amount: number;
  currency: string;
  createdAt: Date;
  queuedAt: Date | null;
  printedAt: Date | null;
  completedAt: Date | null;
}

export class JobService {
  constructor(
    private readonly jobs: IJobRepository = jobRepository,
    private readonly uploads: IUploadRepository = uploadRepository,
    private readonly stations: IStationRepository = stationRepository,
    private readonly pricing: PricingService = pricingService,
  ) {}

  async createJob(
    stationId: string,
    sessionId: string,
    userId: string | undefined,
    req: CreateJobRequest,
    idempotencyKey?: string,
  ): Promise<{ job: JobView; pricing: Awaited<ReturnType<PricingService['quote']>> }> {
    if (idempotencyKey) {
      const existing = await this.jobs.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          job: this.toView(existing),
          pricing: {
            pricingRuleId: existing.pricingRuleId ?? '',
            currency: existing.currency,
            subtotal: existing.subtotal,
            discount: existing.discount,
            amount: existing.amount,
            breakdown: [],
          },
        };
      }
    }

    const station = await this.stations.findById(stationId);
    if (!station) throw new NotFoundError('Station not found');
    if (station.status !== StationStatus.active) {
      throw new ServiceUnavailableError(`Station is currently ${station.status}`);
    }

    const file = await this.uploads.findById(req.fileId);
    if (!file || file.stationId !== stationId) throw new NotFoundError('File not found');
    // The file must belong to the same customer session that is creating the job.
    if (file.sessionId && file.sessionId !== sessionId) throw new NotFoundError('File not found');
    if (file.status !== FileStatus.ready || file.pageCount == null) {
      throw new UnprocessableError('File is not ready for printing');
    }

    const printer = await this.stations.findPrinterById(req.printerId);
    if (!printer || printer.stationId !== stationId) {
      throw new NotFoundError('Printer not found');
    }

    // Capability checks
    if (req.color === ColorMode.color && !printer.supportsColor) {
      throw new UnprocessableError('Selected printer does not support color');
    }
    if (req.duplex && !printer.supportsDuplex) {
      throw new UnprocessableError('Selected printer does not support duplex');
    }
    if (!printer.paperSizes.includes(req.paperSize)) {
      throw new UnprocessableError(`Selected printer does not support ${req.paperSize}`);
    }

    const pagesToPrint = countPagesInRange(req.pageRange, file.pageCount);

    const price = await this.pricing.quote(stationId, {
      pages: pagesToPrint,
      copies: req.copies,
      color: req.color,
      paperSize: req.paperSize,
      duplex: req.duplex,
    });

    const job = await this.jobs.create({
      userId,
      sessionId,
      stationId,
      printerId: req.printerId,
      fileId: req.fileId,
      pricingRuleId: price.pricingRuleId,
      color: req.color,
      copies: req.copies,
      pageRange: req.pageRange,
      pagesToPrint,
      paperSize: req.paperSize,
      duplex: req.duplex,
      orientation: req.orientation,
      subtotal: price.subtotal,
      discount: price.discount,
      amount: price.amount,
      currency: price.currency,
      idempotencyKey,
    });

    logger.info('Print job created', { jobId: job.id, amount: job.amount });
    return { job: this.toView(job), pricing: price };
  }

  async getJob(jobId: string, stationId: string, sessionId: string): Promise<JobView> {
    const job = await this.requireJob(jobId, stationId, sessionId);
    return this.toView(job);
  }

  async cancelJob(jobId: string, stationId: string, sessionId: string): Promise<JobView> {
    const job = await this.requireJob(jobId, stationId, sessionId);
    const cancellable: JobStatus[] = [
      JobStatus.created,
      JobStatus.awaiting_payment,
      JobStatus.queued,
    ];
    if (!cancellable.includes(job.status)) {
      throw new ConflictError(`Job cannot be cancelled from status ${job.status}`);
    }
    const updated = await this.jobs.updateStatus(jobId, JobStatus.cancelled);
    await this.jobs.recordEvent(jobId, job.status, JobStatus.cancelled, 'customer');
    return this.toView(updated);
  }

  /**
   * Loads a job and verifies the caller owns it (station + customer session),
   * so one customer cannot read or cancel another's job at the same station.
   */
  private async requireJob(jobId: string, stationId: string, sessionId: string): Promise<PrintJob> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundError('Job not found');
    if (job.stationId !== stationId) throw new ForbiddenError('Job does not belong to this station');
    if (job.sessionId && job.sessionId !== sessionId) throw new NotFoundError('Job not found');
    return job;
  }

  private toView(job: PrintJob): JobView {
    return {
      jobId: job.id,
      status: job.status,
      stationId: job.stationId,
      printerId: job.printerId,
      amount: job.amount,
      currency: job.currency,
      createdAt: job.createdAt,
      queuedAt: job.queuedAt,
      printedAt: job.printedAt,
      completedAt: job.completedAt,
    };
  }
}

export const jobService = new JobService();
