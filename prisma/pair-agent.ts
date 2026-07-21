import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Pairs a Print Agent to a station: generates a station-bound agent key,
 * stores its hash, and prints the raw key (shown once) to put in the agent's
 * .env as AGENT_KEY.
 *
 * Usage: ts-node prisma/pair-agent.ts [stationSlug]
 */
async function main(): Promise<void> {
  const slug = process.argv[2] || 'demo-station';
  const station = await prisma.station.findUnique({ where: { slug } });
  if (!station) {
    console.error(`Station not found for slug "${slug}". Run the seed first.`);
    process.exit(1);
  }

  const rawKey = `agt_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const agent = await prisma.printAgent.create({
    data: { stationId: station.id, agentTokenHash: tokenHash, isConnected: false },
  });

  console.log('\n===== Print Agent paired =====');
  console.log(`Station : ${station.name} (${station.slug})`);
  console.log(`Agent id: ${agent.id}`);
  console.log('\nPut this in the Print Agent .env (shown once):');
  console.log(`AGENT_KEY=${rawKey}`);
  console.log('==============================\n');
}

main()
  .catch((err) => {
    console.error('Pairing failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
