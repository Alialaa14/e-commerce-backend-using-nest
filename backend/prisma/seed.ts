import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const SEED_IDS = {
  admin: '10000000-0000-4000-8000-000000000001',
  buyer: '10000000-0000-4000-8000-000000000002',
  brandOwner: '10000000-0000-4000-8000-000000000003',
  deliveryOwner: '10000000-0000-4000-8000-000000000004',
  courierUser: '10000000-0000-4000-8000-000000000005',
  brand: '20000000-0000-4000-8000-000000000001',
  brandBranch: '20000000-0000-4000-8000-000000000002',
  brandDocument: '20000000-0000-4000-8000-000000000003',
  brandTransaction: '20000000-0000-4000-8000-000000000004',
  deliveryCompany: '30000000-0000-4000-8000-000000000001',
  deliveryTransaction: '30000000-0000-4000-8000-000000000002',
  courier: '30000000-0000-4000-8000-000000000003',
  category: '40000000-0000-4000-8000-000000000001',
  product: '40000000-0000-4000-8000-000000000002',
  cartVariant: '40000000-0000-4000-8000-000000000003',
  orderVariant: '40000000-0000-4000-8000-000000000004',
  review: '50000000-0000-4000-8000-000000000001',
  cart: '50000000-0000-4000-8000-000000000002',
  order: '50000000-0000-4000-8000-000000000003',
} as const;

const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'db',
]);

export async function seedDatabase(
  prisma: PrismaClient,
  seedPassword: string,
): Promise<void> {
  if (seedPassword.length < 12) {
    throw new Error('SEED_PASSWORD must contain at least 12 characters');
  }

  const password = await bcrypt.hash(seedPassword, 12);

  await prisma.$transaction(
    async (tx) => {
      const users = [
        {
          id: SEED_IDS.admin,
          username: 'Seed Admin',
          email: 'seed.admin@example.test',
          role: 'admin' as const,
        },
        {
          id: SEED_IDS.buyer,
          username: 'Seed Customer',
          email: 'seed.customer@example.test',
          role: 'user' as const,
        },
        {
          id: SEED_IDS.brandOwner,
          username: 'Seed Brand Owner',
          email: 'seed.brand@example.test',
          role: 'brand' as const,
        },
        {
          id: SEED_IDS.deliveryOwner,
          username: 'Seed Delivery Company',
          email: 'seed.delivery@example.test',
          role: 'delievryC' as const,
        },
        {
          id: SEED_IDS.courierUser,
          username: 'Seed Courier User',
          email: 'seed.courier@example.test',
          role: 'courier' as const,
        },
      ];

      for (const user of users) {
        await tx.user.upsert({
          where: { id: user.id },
          create: { ...user, password, isVerified: true },
          update: {},
        });
      }

      await tx.brand.upsert({
        where: { id: SEED_IDS.brand },
        create: {
          id: SEED_IDS.brand,
          userId: SEED_IDS.brandOwner,
          name: 'Seed Fashion House',
          balance: '499.00',
        },
        update: {},
      });

      await tx.brandBranch.upsert({
        where: { id: SEED_IDS.brandBranch },
        create: {
          id: SEED_IDS.brandBranch,
          brandId: SEED_IDS.brand,
          name: 'Main Branch',
          city: 'Cairo',
          country: 'Egypt',
          isMain: true,
        },
        update: {},
      });

      await tx.brandDocument.upsert({
        where: { id: SEED_IDS.brandDocument },
        create: {
          id: SEED_IDS.brandDocument,
          brandId: SEED_IDS.brand,
          docType: 'website',
          fileUrl: 'https://example.test/seed-brand-document',
          fileUrl_id: 'seed-brand-document',
          reviewedBy: SEED_IDS.admin,
          reviewedAt: new Date('2026-01-01T00:00:00.000Z'),
          status: 'approved',
        },
        update: {},
      });

      await tx.brandSocialLink.upsert({
        where: {
          brandId_platform: { brandId: SEED_IDS.brand, platform: 'instagram' },
        },
        create: {
          brandId: SEED_IDS.brand,
          platform: 'instagram',
          url: 'https://instagram.com/example',
        },
        update: {},
      });

      await tx.brandFollower.upsert({
        where: {
          brandId_userId: {
            brandId: SEED_IDS.brand,
            userId: SEED_IDS.buyer,
          },
        },
        create: { brandId: SEED_IDS.brand, userId: SEED_IDS.buyer },
        update: {},
      });

      await tx.category.upsert({
        where: { name: 'Seed Clothing' },
        create: {
          id: SEED_IDS.category,
          name: 'Seed Clothing',
          description: 'Seed catalog category',
          media: { url: 'https://example.test/seed-category.jpg' },
        },
        update: {},
      });

      await tx.product.upsert({
        where: { id: SEED_IDS.product },
        create: {
          id: SEED_IDS.product,
          name: 'Seed Cotton T-Shirt',
          media: [{ url: 'https://example.test/seed-shirt.jpg' }],
          description: 'Sample product created by the development seed.',
          brandId: SEED_IDS.brand,
          categoryId: SEED_IDS.category,
          price: 499,
        },
        update: {},
      });

      await tx.variant.upsert({
        where: {
          productId_color_size: {
            productId: SEED_IDS.product,
            color: 'black',
            size: 'M',
          },
        },
        create: {
          id: SEED_IDS.cartVariant,
          productId: SEED_IDS.product,
          color: 'black',
          size: 'M',
          stock: 20,
        },
        update: {},
      });

      await tx.variant.upsert({
        where: {
          productId_color_size: {
            productId: SEED_IDS.product,
            color: 'white',
            size: 'L',
          },
        },
        create: {
          id: SEED_IDS.orderVariant,
          productId: SEED_IDS.product,
          color: 'white',
          size: 'L',
          stock: 10,
        },
        update: {},
      });

      await tx.review.upsert({
        where: { id: SEED_IDS.review },
        create: {
          id: SEED_IDS.review,
          productId: SEED_IDS.product,
          content: 'Seed review for development data.',
          userId: SEED_IDS.buyer,
        },
        update: {},
      });

      await tx.cart.upsert({
        where: { userId: SEED_IDS.buyer },
        create: {
          id: SEED_IDS.cart,
          userId: SEED_IDS.buyer,
          price: 499,
          totalPrice: 499,
        },
        update: {},
      });

      await tx.cartProducts.upsert({
        where: {
          cartId_variantId: {
            cartId: SEED_IDS.cart,
            variantId: SEED_IDS.cartVariant,
          },
        },
        create: {
          cartId: SEED_IDS.cart,
          variantId: SEED_IDS.cartVariant,
          quantity: 1,
          price: 499,
        },
        update: {},
      });

      await tx.wishlist.upsert({
        where: { userId: SEED_IDS.buyer },
        create: {
          userId: SEED_IDS.buyer,
          products: { connect: { id: SEED_IDS.product } },
        },
        update: { products: { connect: { id: SEED_IDS.product } } },
      });

      await tx.d_Company.upsert({
        where: { deliveryCompany: SEED_IDS.deliveryCompany },
        create: {
          deliveryCompany: SEED_IDS.deliveryCompany,
          name: 'Seed Delivery Company',
          address: 'Cairo, Egypt',
          phoneNumber: '+201000000001',
          balance: 4000,
        },
        update: {},
      });

      await tx.courier.upsert({
        where: { delieveryCId: SEED_IDS.deliveryCompany },
        create: {
          id: SEED_IDS.courier,
          photo_url: 'https://example.test/seed-courier.jpg',
          photo_id: 'seed-courier-photo',
          phoneNumber: '+201000000002',
          documents: ['nationalId', 'drivingLicense'],
          plateNumber: 'SEED-001',
          delieveryCId: SEED_IDS.deliveryCompany,
        },
        update: {},
      });

      await tx.order.upsert({
        where: { orderId: SEED_IDS.order },
        create: {
          orderId: SEED_IDS.order,
          userId: SEED_IDS.buyer,
          status: 'delivered',
          otp: 'seed-order-otp',
          price: 499,
          deliveryPrice: 40,
          totalPrice: 539,
          address: 'Cairo, Egypt',
          phoneNumber: '+201000000003',
          deliveryCId: SEED_IDS.deliveryCompany,
          courierId: SEED_IDS.courier,
          checkoutId: 'cs_test_seed_checkout',
          products: { connect: { id: SEED_IDS.orderVariant } },
        },
        update: { products: { connect: { id: SEED_IDS.orderVariant } } },
      });

      await tx.orderBrand.upsert({
        where: {
          orderId_brandId: { orderId: SEED_IDS.order, brandId: SEED_IDS.brand },
        },
        create: { orderId: SEED_IDS.order, brandId: SEED_IDS.brand },
        update: {},
      });

      await tx.brandTransaction.upsert({
        where: { id: SEED_IDS.brandTransaction },
        create: {
          id: SEED_IDS.brandTransaction,
          brandId: SEED_IDS.brand,
          amount: 49900,
          direction: 'credit',
          source: 'adjustment',
          description: 'Development seed balance entry',
        },
        update: {},
      });

      await tx.deliveryCompanyTransaction.upsert({
        where: { id: SEED_IDS.deliveryTransaction },
        create: {
          id: SEED_IDS.deliveryTransaction,
          deliveryCompanyId: SEED_IDS.deliveryCompany,
          amount: 4000,
          direction: 'credit',
          source: 'adjustment',
          description: 'Development seed balance entry',
        },
        update: {},
      });
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

function validateSeedEnvironment(databaseUrl: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the database seed in production');
  }

  const hostname = new URL(databaseUrl).hostname;
  if (
    !LOCAL_DATABASE_HOSTS.has(hostname) &&
    process.env.ALLOW_REMOTE_SEED !== 'true'
  ) {
    throw new Error(
      'Remote database seeding is disabled; set ALLOW_REMOTE_SEED=true only for an intentional development seed',
    );
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DB_URL;
  const seedPassword = process.env.SEED_PASSWORD;

  if (!databaseUrl) throw new Error('DB_URL is required to seed the database');
  if (!seedPassword) throw new Error('SEED_PASSWORD is required to seed users');
  validateSeedEnvironment(databaseUrl);

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedDatabase(prisma, seedPassword);
    console.info('Database seed completed for all Prisma models.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  });
}
