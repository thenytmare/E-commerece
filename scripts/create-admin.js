/**
 * Creates (or promotes) an admin account.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long unique password' node scripts/create-admin.js
 *
 * The password is never stored in this file and is never printed. It must be
 * at least 12 characters. Re-running for an existing email only makes sure the
 * account has the ADMIN role; it does not change that account's password.
 */
const { PrismaClient, RoleName } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !email.includes("@")) {
    throw new Error("Set ADMIN_EMAIL to the admin's email address.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  let passwordHash;
  if (!existing) {
    if (password.length < 12) {
      throw new Error("Set ADMIN_PASSWORD to a password of at least 12 characters.");
    }
    passwordHash = await bcrypt.hash(password, 12);
  }

  const role = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: { name: RoleName.ADMIN, description: "System Administrator" },
  });

  const user =
    existing ||
    (await prisma.user.create({
      data: { email, name: "Administrator", passwordHash },
    }));

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(existing ? `Admin role ensured for ${email}` : `Admin created for ${email}`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
