const { PrismaClient, RoleName } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  const role = await prisma.role.upsert({
    where: {
      name: RoleName.ADMIN,
    },
    update: {},
    create: {
      name: RoleName.ADMIN,
      description: "System Administrator",
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email: "admin@primeaccessories.co.ke",
    },
    update: {},
    create: {
      email: "admin@primeaccessories.co.ke",
      name: "Administrator",
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log("✅ Admin created");
  console.log("Email: admin@primeaccessories.co.ke");
  console.log("Password: Admin123!");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});