// Seed the first ADMIN account. Run: npm run seed
// Credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD) with dev defaults.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@investigator-network.com")
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMe#12345";
  const name = process.env.ADMIN_NAME || "Investigator Network Admin";
  const agency = process.env.ADMIN_AGENCY || "Investigator Network";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "APPROVED" },
    create: {
      email,
      name,
      agency,
      passwordHash,
      role: "ADMIN",
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  console.log(`Admin ready: ${admin.email} (role=${admin.role}, status=${admin.status})`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("NOTE: using default dev password — change it in production.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
