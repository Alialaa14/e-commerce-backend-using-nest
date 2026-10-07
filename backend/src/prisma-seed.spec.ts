import { PrismaClient } from './generated/prisma/client';
import { seedDatabase } from '../prisma/seed';

describe('seedDatabase', () => {
  it('upserts every model inside one transaction', async () => {
    const modelNames = [
      'user',
      'brand',
      'brandTransaction',
      'brandBranch',
      'brandDocument',
      'brandSocialLink',
      'brandFollower',
      'product',
      'variant',
      'category',
      'review',
      'cart',
      'cartProducts',
      'wishlist',
      'order',
      'orderBrand',
      'd_Company',
      'deliveryCompanyTransaction',
      'courier',
    ];
    const transactionClient = Object.fromEntries(
      modelNames.map((modelName) => [
        modelName,
        { upsert: jest.fn().mockResolvedValue({}) },
      ]),
    );
    const prisma = {
      $transaction: jest.fn((callback) => callback(transactionClient)),
    };

    await seedDatabase(
      prisma as unknown as PrismaClient,
      'local-seed-password-123',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
    for (const modelName of modelNames) {
      expect(transactionClient[modelName].upsert).toHaveBeenCalled();
    }
  });
});
