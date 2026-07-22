import crypto from 'crypto';
import { AdminRole, PrinterStatus, PrismaClient, StationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Onboards a real shop end-to-end:
 *   ts-node prisma/create-shop.ts "<Shop Name>" <slug> <ownerEmail> <ownerPassword>
 *
 * Creates the owner, station, a printer, an active pricing rule, and a paired
 * Print Agent key. Prints the QR URL, admin login, and AGENT_KEY.
 */
async function main(): Promise<void> {
  const [name, slug, email, password] = process.argv.slice(2);
  if (!name || !slug || !email || !password) {
    console.error('Usage: ts-node prisma/create-shop.ts "<Shop Name>" <slug> <ownerEmail> <ownerPassword>');
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error('slug must be lowercase letters, numbers and hyphens only.');
    process.exit(1);
  }

  const owner = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      fullName: `${name} Owner`,
      role: AdminRole.owner,
    },
  });

  const station = await prisma.station.upsert({
    where: { slug },
    update: { name, status: StationStatus.active },
    create: { ownerId: owner.id, name, slug, status: StationStatus.active, timezone: 'Asia/Kolkata' },
  });

  const existingPrinter = await prisma.printer.findFirst({ where: { stationId: station.id } });
  if (!existingPrinter) {
    await prisma.printer.create({
      data: {
        stationId: station.id,
        name: 'Shop Printer',
        model: 'USB Printer',
        systemName: '', // matched to the real printer via agent heartbeat
        supportsColor: true,
        supportsDuplex: true,
        paperSizes: ['A4', 'A3', 'Letter', 'Legal'],
        currentStatus: PrinterStatus.offline,
        isDefault: true,
      },
    });
  }

  const existingPricing = await prisma.pricingRule.findFirst({ where: { stationId: station.id, isActive: true } });
  if (!existingPricing) {
    await prisma.pricingRule.create({
      data: {
        stationId: station.id,
        version: 1,
        bwPagePrice: 200,
        colorPagePrice: 500,
        duplexDiscount: 0.1,
        minimumCharge: 500,
        paperMultiplier: { A4: 1, A5: 1, Letter: 1, Legal: 1.2, A3: 2 },
        currency: 'INR',
        isActive: true,
      },
    });
  }

  const rawKey = `agt_${crypto.randomBytes(24).toString('hex')}`;
  await prisma.printAgent.create({
    data: {
      stationId: station.id,
      agentTokenHash: crypto.createHash('sha256').update(rawKey).digest('hex'),
    },
  });

  console.log('\n================= SHOP READY =================');
  console.log(`Shop        : ${station.name}`);
  console.log(`Station slug: ${station.slug}`);
  console.log(`QR URL      : https://tapprint.vercel.app/s/${station.slug}`);
  console.log('\nAdmin dashboard login:');
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log('\nPrint Agent .env (for the shop PC):');
  console.log(`  BACKEND_URL=https://tapprint-backend-production.up.railway.app/v1`);
  console.log(`  AGENT_KEY=${rawKey}`);
  console.log('=============================================\n');
}

main()
  .catch((err) => {
    console.error('create-shop failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
