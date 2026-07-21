import { Printer } from '@prisma/client';
import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { stationRepository } from '../infrastructure/StationRepository';

function toPrinterView(p: Printer) {
  return {
    id: p.id,
    name: p.name,
    model: p.model,
    currentStatus: p.currentStatus,
    capabilities: {
      color: p.supportsColor,
      duplex: p.supportsDuplex,
      paperSizes: p.paperSizes,
    },
  };
}

export class PrinterController {
  async listByStation(req: Request, res: Response): Promise<void> {
    const printers = await stationRepository.listPrinters(req.params.stationId);
    sendSuccess(res, printers.map(toPrinterView), 200);
  }
}

export const printerController = new PrinterController();
