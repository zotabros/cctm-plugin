// Seed: ensure the local Account exists. The cctm worker normally does this
// at boot; this script is provided for `pnpm db:seed` parity.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.account.upsert({
    where: { id: "local" },
    update: {},
    create: { id: "local", label: "Local", color: "#0F766E" },
  });
  console.log("seeded local Account");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
