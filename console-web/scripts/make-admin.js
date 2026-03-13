#!/usr/bin/env node
/**
 * Grant or revoke admin access for a user by email.
 *
 * Usage (inside Docker container or locally with DATABASE_URL set):
 *   node scripts/make-admin.js admin@example.com
 *   node scripts/make-admin.js admin@example.com --revoke
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email> [--revoke]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { isAdmin: !revoke },
  });

  if (revoke) {
    console.log(`✓ Admin access REVOKED for ${updated.email}`);
  } else {
    console.log(`✓ Admin access GRANTED to ${updated.email}`);
    console.log(`  They will be redirected to /admin/dashboard on next login.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
