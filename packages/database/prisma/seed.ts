import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the database with roles, sample brands, categories, and products.
 * Run via: pnpm db:seed
 */
async function main() {
  console.log('Seeding database...');

  // Roles
  const roles = await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({
        where: { name },
        create: { name, description: `${name} role` },
        update: {},
      })
    )
  );
  console.log(`  ✓ ${roles.length} roles`);

  // Brands
  const anker = await prisma.brand.upsert({
    where: { slug: 'anker' },
    create: {
      name: 'Anker',
      slug: 'anker',
      description: 'Premium charging and audio accessories',
      isActive: true,
    },
    update: {},
  });

  const samsung = await prisma.brand.upsert({
    where: { slug: 'samsung' },
    create: {
      name: 'Samsung',
      slug: 'samsung',
      description: 'Innovative electronics and mobile accessories',
      isActive: true,
    },
    update: {},
  });
  console.log('  ✓ 2 brands');

  // Categories
  const earbuds = await prisma.category.upsert({
    where: { slug: 'earbuds' },
    create: { name: 'Earbuds', slug: 'earbuds', sortOrder: 1, isActive: true },
    update: {},
  });

  const smartWatches = await prisma.category.upsert({
    where: { slug: 'smart-watches' },
    create: { name: 'Smart Watches', slug: 'smart-watches', sortOrder: 2, isActive: true },
    update: {},
  });

  const chargers = await prisma.category.upsert({
    where: { slug: 'chargers' },
    create: { name: 'Chargers', slug: 'chargers', sortOrder: 3, isActive: true },
    update: {},
  });

  const powerBanks = await prisma.category.upsert({
    where: { slug: 'power-banks' },
    create: { name: 'Power Banks', slug: 'power-banks', sortOrder: 4, isActive: true },
    update: {},
  });
  console.log('  ✓ 4 categories');

  // Product: Anker Soundcore Liberty 4 NC
  const libertyProduct = await prisma.product.upsert({
    where: { slug: 'anker-soundcore-liberty-4-nc' },
    create: {
      brandId: anker.id,
      categoryId: earbuds.id,
      name: 'Soundcore Liberty 4 NC',
      slug: 'anker-soundcore-liberty-4-nc',
      shortDescription: 'Adaptive ANC earbuds with premium sound',
      description:
        'Experience immersive audio with adaptive active noise cancellation, 50-hour playtime, and crystal-clear calls.',
      basePrice: 12999,
      compareAtPrice: 15999,
      isFeatured: true,
      isActive: true,
      variants: {
        create: [
          {
            sku: 'ANK-LIB4NC-BLK',
            price: 12999,
            compareAtPrice: 15999,
            attributes: { color: 'Midnight Black' },
            isDefault: true,
            inventory: { create: { quantity: 45, lowStockThreshold: 5 } },
          },
          {
            sku: 'ANK-LIB4NC-WHT',
            price: 12999,
            attributes: { color: 'Pearl White' },
            isDefault: false,
            inventory: { create: { quantity: 22, lowStockThreshold: 5 } },
          },
        ],
      },
      images: {
        create: [
          { url: '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp', alt: 'Soundcore Liberty 4 NC', sortOrder: 0, isFeatured: true },
        ],
      },
      specs: {
        create: [
          { groupName: 'Audio', key: 'Driver Size', value: '11mm', sortOrder: 0 },
          { groupName: 'Battery', key: 'Playtime', value: '50 hours (with case)', sortOrder: 1 },
          { groupName: 'Connectivity', key: 'Bluetooth', value: '5.3', sortOrder: 2 },
        ],
      },
      features: {
        create: [
          { text: 'Adaptive ANC 2.0', sortOrder: 0 },
          { text: 'HearID Sound Personalization', sortOrder: 1 },
          { text: 'IPX4 water resistance', sortOrder: 2 },
        ],
      },
      boxContents: {
        create: [
          { item: 'Liberty 4 NC Earbuds', sortOrder: 0 },
          { item: 'Charging Case', sortOrder: 1 },
          { item: 'USB-C Cable', sortOrder: 2 },
          { item: 'Ear Tips (XS/S/M/L)', sortOrder: 3 },
        ],
      },
    },
    update: {
      images: {
        deleteMany: {},
        create: [
          { url: '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp', alt: 'Soundcore Liberty 4 NC', sortOrder: 0, isFeatured: true },
        ],
      },
    },
  });

  // Product: Samsung Galaxy Watch 6
  await prisma.product.upsert({
    where: { slug: 'samsung-galaxy-watch-6' },
    create: {
      brandId: samsung.id,
      categoryId: smartWatches.id,
      name: 'Galaxy Watch 6',
      slug: 'samsung-galaxy-watch-6',
      shortDescription: 'Advanced health tracking in a sleek design',
      description: 'Track your fitness, sleep, and heart health with Samsung\'s most advanced smartwatch.',
      basePrice: 34999,
      compareAtPrice: 39999,
      isFeatured: true,
      isActive: true,
      variants: {
        create: [
          {
            sku: 'SAM-GW6-44-BLK',
            price: 34999,
            compareAtPrice: 39999,
            attributes: { color: 'Graphite', size: '44mm' },
            isDefault: true,
            inventory: { create: { quantity: 18, lowStockThreshold: 3 } },
          },
        ],
      },
      images: {
        create: [
          { url: '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp', alt: 'Samsung Galaxy Watch 6', sortOrder: 0, isFeatured: true },
        ],
      },
    },
    update: {
      images: {
        deleteMany: {},
        create: [
          { url: '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp', alt: 'Samsung Galaxy Watch 6', sortOrder: 0, isFeatured: true },
        ],
      },
    },
  });

  // Product: Anker 737 Power Bank
  await prisma.product.upsert({
    where: { slug: 'anker-737-power-bank' },
    create: {
      brandId: anker.id,
      categoryId: powerBanks.id,
      name: 'Anker 737 Power Bank (PowerCore 24K)',
      slug: 'anker-737-power-bank',
      shortDescription: '140W two-way fast charging power bank',
      description: '24,000mAh capacity with 140W bi-directional charging for laptops, tablets, and phones.',
      basePrice: 18999,
      isFeatured: false,
      isActive: true,
      variants: {
        create: [
          {
            sku: 'ANK-737-PB',
            price: 18999,
            attributes: { capacity: '24000mAh' },
            isDefault: true,
            inventory: { create: { quantity: 30, lowStockThreshold: 5 } },
          },
        ],
      },
      images: {
        create: [
          { url: '/images/products/oraimo-Power-Bank-PowerNova-Q31-OPB-7300Q-mainimage.webp', alt: 'Anker 737 Power Bank', sortOrder: 0, isFeatured: true },
        ],
      },
    },
    update: {
      images: {
        deleteMany: {},
        create: [
          { url: '/images/products/oraimo-Power-Bank-PowerNova-Q31-OPB-7300Q-mainimage.webp', alt: 'Anker 737 Power Bank', sortOrder: 0, isFeatured: true },
        ],
      },
    },
  });

  console.log('  ✓ 3 products (including variants & inventory)');

  // Site settings
  await prisma.siteSetting.upsert({
    where: { key: 'store' },
    create: {
      key: 'store',
      value: {
        name: 'TechVault',
        currency: 'KES',
        phone: '+254 700 000 000',
        email: 'hello@techvault.co.ke',
        address: 'Nairobi, Kenya',
      },
    },
    update: {},
  });
  console.log('  ✓ Site settings');

  // Admin user
  const adminEmail = 'admin@techvault.co.ke';
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.default.hash('Admin123!', 12);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'TechVault Admin',
      passwordHash,
      roles: {
        create: {
          role: {
            connect: { name: RoleName.ADMIN }
          }
        }
      }
    },
    update: {
      name: 'TechVault Admin',
      passwordHash,
    }
  });
  console.log('  ✓ Admin account');

  console.log(`\nSeed complete. Featured product: ${libertyProduct.name}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
