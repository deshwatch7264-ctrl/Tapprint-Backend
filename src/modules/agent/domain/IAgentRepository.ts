import { PrintAgent, PrinterStatus } from '@prisma/client';

export interface PrinterReport {
  systemName: string;
  status: PrinterStatus;
  capabilities: { color: boolean; duplex: boolean; paperSizes: string[] };
}

export interface IAgentRepository {
  findByTokenHash(tokenHash: string): Promise<PrintAgent | null>;
  create(stationId: string, tokenHash: string): Promise<PrintAgent>;
  heartbeat(agentId: string, version?: string, hostname?: string): Promise<void>;
  applyPrinterReports(stationId: string, reports: PrinterReport[]): Promise<void>;
}
