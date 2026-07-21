import crypto from 'crypto';
import { FileStatus, JobStatus } from '@prisma/client';
import { config } from '../../../config';
import { prisma } from '../../../infrastructure/database/prisma';
import { tokenService } from '../../../infrastructure/auth/TokenService';
import { IStorageService, storageService } from '../../../infrastructure/storage/StorageService';
import {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
} from '../../../shared/errors/http-errors';
import { logger } from '../../../shared/logger/logger';
import { refundService, RefundService } from '../../payments/application/RefundService';
import { IAgentRepository, PrinterReport } from '../domain/IAgentRepository';
import { agentRepository } from '../infrastructure/AgentRepository';

const LEASE_MS = 2 * 60 * 1000; // 2 minutes to print before the lease expires

export interface AgentJobPayload {
  jobId: string;
  printerSystemName: string;
  documentUrl: string;
  options: {
    color: string;
    copies: number;
    pageRange?: string;
    paperSize: string;
    duplex: boolean;
    orientation: string;
  };
  leaseId: string;
  leaseExpiresAt: string;
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export class AgentService {
  constructor(
    private readonly agents: IAgentRepository = agentRepository,
    private readonly storage: IStorageService = storageService,
    private readonly refunds: RefundService = refundService,
  ) {}

  /** Exchanges a station-bound agent key for a short-lived agent token. */
  async authenticate(rawKey: string): Promise<{ agentToken: string; expiresIn: number }> {
    const agent = await this.agents.findByTokenHash(hashKey(rawKey));
    if (!agent) throw new UnauthenticatedError('Invalid agent key');

    const agentToken = tokenService.signAgentToken({
      sub: agent.id,
      type: 'agent',
      stationId: agent.stationId,
    });
    await this.agents.heartbeat(agent.id);
    return { agentToken, expiresIn: config.jwt.agentTtl };
  }

  async heartbeat(
    agentId: string,
    stationId: string,
    agentVersion: string,
    printers: PrinterReport[],
  ): Promise<void> {
    await this.agents.heartbeat(agentId, agentVersion);
    if (printers.length) {
      await this.agents.applyPrinterReports(stationId, printers);
    }
  }

  /**
   * Claims the oldest queued job for the station and leases it to this agent.
   * Returns null if the queue is empty. Runs in a transaction so two polls
   * can't grab the same job.
   */
  async claimNextJob(agentId: string, stationId: string): Promise<AgentJobPayload | null> {
    const now = new Date();

    const job = await prisma.$transaction(async (tx) => {
      const candidate = await tx.printJob.findFirst({
        where: {
          stationId,
          OR: [
            { status: { in: [JobStatus.queued, JobStatus.retrying] } },
            // Reclaim a job whose lease expired (agent crashed mid-print).
            { status: JobStatus.claimed, leaseExpiresAt: { lt: now } },
          ],
        },
        orderBy: { queuedAt: 'asc' },
      });
      if (!candidate) return null;

      // Guarded claim so a concurrent poll can't take the same row.
      const claimed = await tx.printJob.updateMany({
        where: { id: candidate.id, status: candidate.status },
        data: {
          status: JobStatus.claimed,
          leaseOwner: agentId,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        },
      });
      if (claimed.count === 0) return null;

      await tx.jobEvent.create({
        data: {
          jobId: candidate.id,
          fromStatus: candidate.status,
          toStatus: JobStatus.claimed,
          actor: `agent:${agentId}`,
        },
      });
      return tx.printJob.findUnique({ where: { id: candidate.id } });
    });

    if (!job) return null;

    const file = await prisma.uploadedFile.findUnique({ where: { id: job.fileId } });
    const printer = job.printerId
      ? await prisma.printer.findUnique({ where: { id: job.printerId } })
      : null;
    const key = file?.normalizedKey ?? file?.storageKey;
    if (!key) throw new NotFoundError('Document not found for job');

    const documentUrl = await this.storage.createDownloadUrl(key);

    return {
      jobId: job.id,
      printerSystemName: printer?.systemName ?? '',
      documentUrl,
      options: {
        color: job.color,
        copies: job.copies,
        pageRange: job.pageRange ?? undefined,
        paperSize: job.paperSize,
        duplex: job.duplex,
        orientation: job.orientation,
      },
      leaseId: job.id,
      leaseExpiresAt: (job.leaseExpiresAt ?? new Date(now.getTime() + LEASE_MS)).toISOString(),
    };
  }

  /** Records print progress / outcome. On permanent failure, auto-refunds. */
  async reportStatus(
    agentId: string,
    jobId: string,
    status: 'printing' | 'completed' | 'failed',
    failureReason?: string,
  ): Promise<void> {
    const job = await prisma.printJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundError('Job not found');
    if (job.leaseOwner !== agentId) {
      throw new ConflictError('Job is not leased to this agent');
    }

    if (status === 'printing') {
      await prisma.printJob.update({
        where: { id: jobId },
        data: { status: JobStatus.printing, printedAt: new Date() },
      });
      await this.recordEvent(jobId, job.status, JobStatus.printing, agentId);
      return;
    }

    if (status === 'completed') {
      await prisma.printJob.update({
        where: { id: jobId },
        data: { status: JobStatus.completed, completedAt: new Date() },
      });
      await this.recordEvent(jobId, job.status, JobStatus.completed, agentId);
      await this.purgeDocument(job.fileId);
      logger.info('Job completed by agent', { jobId, agentId });
      return;
    }

    // failed → mark failed, then auto-refund
    await prisma.printJob.update({
      where: { id: jobId },
      data: { status: JobStatus.failed, failureReason: failureReason ?? 'Print failed' },
    });
    await this.recordEvent(jobId, job.status, JobStatus.failed, agentId, failureReason);
    try {
      await this.refunds.refundForJob(jobId, `Auto-refund: ${failureReason ?? 'print failed'}`);
    } catch (err) {
      logger.error('Auto-refund failed', { jobId, message: (err as Error).message });
    }
  }

  private async recordEvent(
    jobId: string,
    from: JobStatus,
    to: JobStatus,
    agentId: string,
    detail?: string,
  ): Promise<void> {
    await prisma.jobEvent.create({
      data: { jobId, fromStatus: from, toStatus: to, actor: `agent:${agentId}`, detail },
    });
  }

  private async purgeDocument(fileId: string): Promise<void> {
    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file) return;
    try {
      await this.storage.deleteObject(file.storageKey);
      if (file.normalizedKey && file.normalizedKey !== file.storageKey) {
        await this.storage.deleteObject(file.normalizedKey);
      }
    } catch (err) {
      logger.warn('Document purge failed', { fileId, message: (err as Error).message });
    }
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: FileStatus.purged, purgedAt: new Date() },
    });
  }
}

export const agentService = new AgentService();
