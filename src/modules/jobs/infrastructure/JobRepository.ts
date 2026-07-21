import { JobStatus, Prisma, PrintJob, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  CreateJobInput,
  IJobRepository,
  JobListFilter,
} from '../domain/IJobRepository';

export class JobRepository implements IJobRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(input: CreateJobInput): Promise<PrintJob> {
    // Create the job and its initial event atomically.
    return this.db.$transaction(async (tx) => {
      const job = await tx.printJob.create({ data: input });
      await tx.jobEvent.create({
        data: { jobId: job.id, fromStatus: null, toStatus: job.status, actor: 'system' },
      });
      return job;
    });
  }

  findById(id: string): Promise<PrintJob | null> {
    return this.db.printJob.findUnique({ where: { id } });
  }

  findByIdempotencyKey(key: string): Promise<PrintJob | null> {
    return this.db.printJob.findUnique({ where: { idempotencyKey: key } });
  }

  updateStatus(
    id: string,
    status: JobStatus,
    extra?: Partial<Pick<PrintJob, 'queuedAt' | 'printedAt' | 'completedAt' | 'failureReason'>>,
  ): Promise<PrintJob> {
    return this.db.printJob.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async list(
    filter: JobListFilter,
    skip: number,
    take: number,
  ): Promise<{ items: PrintJob[]; total: number }> {
    const where: Prisma.PrintJobWhereInput = {
      stationId: filter.stationId,
      status: filter.status,
      createdAt:
        filter.from || filter.to
          ? { gte: filter.from, lte: filter.to }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.db.printJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.db.printJob.count({ where }),
    ]);

    return { items, total };
  }

  async recordEvent(
    jobId: string,
    from: JobStatus | null,
    to: JobStatus,
    actor: string,
    detail?: string,
  ): Promise<void> {
    await this.db.jobEvent.create({
      data: { jobId, fromStatus: from, toStatus: to, actor, detail },
    });
  }
}

export const jobRepository = new JobRepository();
