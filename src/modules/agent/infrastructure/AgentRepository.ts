import { PrintAgent, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { IAgentRepository, PrinterReport } from '../domain/IAgentRepository';

export class AgentRepository implements IAgentRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findByTokenHash(tokenHash: string): Promise<PrintAgent | null> {
    return this.db.printAgent.findFirst({ where: { agentTokenHash: tokenHash } });
  }

  create(stationId: string, tokenHash: string): Promise<PrintAgent> {
    return this.db.printAgent.create({
      data: { stationId, agentTokenHash: tokenHash, isConnected: true },
    });
  }

  async heartbeat(agentId: string, version?: string, hostname?: string): Promise<void> {
    await this.db.printAgent.update({
      where: { id: agentId },
      data: { lastHeartbeatAt: new Date(), isConnected: true, version, hostname },
    });
  }

  /**
   * Updates the status and capabilities of the station's printers based on what
   * the agent reports, matched by the printer's OS system name.
   */
  async applyPrinterReports(stationId: string, reports: PrinterReport[]): Promise<void> {
    for (const report of reports) {
      await this.db.printer.updateMany({
        where: { stationId, systemName: report.systemName },
        data: {
          currentStatus: report.status,
          supportsColor: report.capabilities.color,
          supportsDuplex: report.capabilities.duplex,
          paperSizes: report.capabilities.paperSizes,
        },
      });
    }
  }
}

export const agentRepository = new AgentRepository();
