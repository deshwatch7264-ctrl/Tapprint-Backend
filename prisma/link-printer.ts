import { PrinterStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Links a station's printer to the real Windows printer name and marks it
 * online, so the customer app shows the correct status and future agent
 * heartbeats (matched by systemName) keep it accurate.
 *
 * Usage: ts-node prisma/link-printer.ts <stationSlug> "<Windows Printer Name>"
 */
async function main(): Promise<void> {
  const slug = process.argv[2];
  const systemName = process.argv[3];
  if (!slug || !systemName) {
    console.error('Usage: ts-node prisma/link-printer.ts <stationSlug> "<Windows Printer Name>"');
    process.exit(1);
  }

  const station = await prisma.station.findUnique({ where: { slug } });
  if (!station) {
    console.error(`Station not found for slug "${slug}".`);
    process.exit(1);
  }

  const printer = await prisma.printer.findFirst({ where: { stationId: station.id } });
  if (!printer) {
    console.error('No printer found for this station.');
    process.exit(1);
  }

  const updated = await prisma.printer.update({
    where: { id: printer.id },
    data: { systemName, currentStatus: PrinterStatus.online, name: systemName },
  });

  console.log(`Linked printer "${updated.name}" (systemName="${updated.systemName}") -> ${updated.currentStatus}`);
}

main()
  .catch((err) => {
    console.error('link-printer failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
