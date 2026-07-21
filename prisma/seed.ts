import { AdminRole, PrinterStatus, PrismaClient, StationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Bootstraps a demo environment so the customer app and admin dashboard have
 * real data to work against:
 *  - 1 admin (owner)
 *  - 1 active station (slug: demo-station)
 *  - 1 color-capable printer
 *  - 1 active pricing rule
 *
 * Idempotent: safe to run multiple times (upserts by unique keys).
 */
async function main(): Promise<void> {
  const adminEmail = 'admin@tapprint.app';
  const adminPassword = 'demo1234';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Demo Owner',
      role: AdminRole.owner,
      isActive: true,
    },
  });
  console.log(`✔ Admin: ${admin.email} (password: ${adminPassword})`);

  const station = await prisma.station.upsert({
    where: { slug: 'demo-station' },
    update: { status: StationStatus.active },
    create: {
      ownerId: admin.id,
      name: 'Demo Print Station',
      slug: 'demo-station',
      address: 'Ground Floor, Demo Building',
      timezone: 'Asia/Kolkata',
      status: StationStatus.active,
    },
  });
  console.log(`✔ Station: ${station.name} (slug: ${station.slug})`);

  // Printer — only create if the station has none yet.
  const existingPrinter = await prisma.printer.findFirst({ where: { stationId: station.id } });
  const printer =
    existingPrinter ??
    (await prisma.printer.create({
      data: {
        stationId: station.id,
        name: 'Front Desk Printer',
        model: 'HP LaserJet Pro (demo)',
        systemName: 'HP-LaserJet',
        supportsColor: true,
        supportsDuplex: true,
        paperSizes: ['A4', 'A3', 'Letter', 'Legal'],
        currentStatus: PrinterStatus.online,
        isDefault: true,
      },
    }));
  console.log(`✔ Printer: ${printer.name} (color: ${printer.supportsColor}, duplex: ${printer.supportsDuplex})`);

  // Active pricing rule — amounts are in paise (smallest currency unit).
  const pricing = await prisma.pricingRule.upsert({
    where: { stationId_version: { stationId: station.id, version: 1 } },
    update: { isActive: true },
    create: {
      stationId: station.id,
      version: 1,
      bwPagePrice: 200, // ₹2.00 / page
      colorPagePrice: 500, // ₹5.00 / page
      duplexDiscount: 0.1, // 10%
      minimumCharge: 500, // ₹5.00
      paperMultiplier: { A4: 1, A5: 1, Letter: 1, Legal: 1.2, A3: 2 },
      currency: 'INR',
      isActive: true,
    },
  });
  console.log(`✔ Pricing rule v${pricing.version} (B&W ₹${pricing.bwPagePrice / 100}, Color ₹${pricing.colorPagePrice / 100})`);

  // A demo color-capable and a mono printer help exercise capability checks.
  console.log('\nSeed complete. Try it:');
  console.log('  POST /v1/auth/session   { "stationSlug": "demo-station" }');
  console.log(`  Admin login             ${adminEmail} / ${adminPassword}`);
  console.log(`  Station id              ${station.id}`);
  console.log(`  Printer id              ${printer.id}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
