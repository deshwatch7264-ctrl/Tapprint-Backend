import { Printer, PrismaClient, Station } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { IStationRepository } from '../domain/IStationRepository';

export class StationRepository implements IStationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<Station | null> {
    return this.db.station.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Station | null> {
    return this.db.station.findUnique({ where: { slug } });
  }

  findPrinterById(printerId: string): Promise<Printer | null> {
    return this.db.printer.findUnique({ where: { id: printerId } });
  }

  listPrinters(stationId: string): Promise<Printer[]> {
    return this.db.printer.findMany({
      where: { stationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const stationRepository = new StationRepository();
