import { Request, Response } from 'express';
import {
  BadRequestError,
  UnauthenticatedError,
} from '../../../shared/errors/http-errors';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { AgentPrincipal } from '../../../shared/types/auth';
import { agentService } from '../application/AgentService';
import { PrinterReport } from '../domain/IAgentRepository';

function agent(req: Request): AgentPrincipal {
  if (req.principal?.type !== 'agent') {
    throw new UnauthenticatedError('Agent token required');
  }
  return req.principal;
}

export class AgentController {
  async token(req: Request, res: Response): Promise<void> {
    const key = req.header('X-Agent-Key');
    if (!key) throw new BadRequestError('Missing X-Agent-Key header');
    const result = await agentService.authenticate(key);
    sendSuccess(res, result, 200);
  }

  async heartbeat(req: Request, res: Response): Promise<void> {
    const principal = agent(req);
    const { agentVersion, printers } = req.body as {
      agentVersion: string;
      printers: PrinterReport[];
    };
    await agentService.heartbeat(principal.agentId, principal.stationId, agentVersion, printers);
    sendSuccess(res, { acknowledged: true }, 200);
  }

  async nextJob(req: Request, res: Response): Promise<void> {
    const principal = agent(req);
    const job = await agentService.claimNextJob(principal.agentId, principal.stationId);
    if (!job) {
      res.status(204).end();
      return;
    }
    sendSuccess(res, job, 200);
  }

  async reportStatus(req: Request, res: Response): Promise<void> {
    const principal = agent(req);
    const { status, failureReason } = req.body as {
      status: 'printing' | 'completed' | 'failed';
      failureReason?: string;
    };
    await agentService.reportStatus(principal.agentId, req.params.jobId, status, failureReason);
    sendSuccess(res, { acknowledged: true }, 200);
  }
}

export const agentController = new AgentController();
