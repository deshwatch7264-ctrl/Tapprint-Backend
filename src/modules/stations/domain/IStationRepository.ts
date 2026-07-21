import { Printer, Station } from '@prisma/client';

export interface IStationRepository {
  findById(id: string): Promise<Station | null>;
  findBySlug(slug: string): Promise<Station | null>;
  findPrinterById(printerId: string): Promise<Printer | null>;
  listPrinters(stationId: string): Promise<Printer[]>;
}
