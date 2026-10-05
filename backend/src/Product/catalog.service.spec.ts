import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';

describe('CatalogService', () => {
  it('creates variants and their all-branch offers in one transaction', async () => {
    const variants = [
      {
        id: 'variant-1',
        sku: 'SKU-1',
        basePrice: 100,
        color: 'black',
        size: 'M',
      },
      {
        id: 'variant-2',
        sku: 'SKU-2',
        basePrice: 120,
        color: 'white',
        size: 'L',
      },
    ];
    const tx = {
      brand: { findUnique: jest.fn().mockResolvedValue({ id: 'brand-1' }) },
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'category-1' }),
      },
      brandBranch: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]),
      },
      product: {
        create: jest.fn().mockResolvedValue({
          id: 'product-1',
          variants,
        }),
      },
      branchVariant: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prismaService);
    const dto: CreateCatalogProductDto = {
      name: 'Everyday Shirt',
      description: 'Cotton',
      categoryId: 'category-1',
      variants: [
        { sku: 'SKU-1', basePrice: 100, color: 'black', size: 'M' },
        { sku: 'SKU-2', basePrice: 120, color: 'white', size: 'L' },
      ],
      makeAvailableAtAllBranches: true,
    };

    await service.createProduct('brand-1', dto);

    expect(prismaService.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.branchVariant.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          branchId: 'branch-1',
          variantId: 'variant-1',
          stockQuantity: 0,
          isAvailable: true,
        }),
        expect.objectContaining({
          branchId: 'branch-2',
          variantId: 'variant-1',
          stockQuantity: 0,
          isAvailable: true,
        }),
        expect.objectContaining({
          branchId: 'branch-1',
          variantId: 'variant-2',
          stockQuantity: 0,
          isAvailable: true,
        }),
        expect.objectContaining({
          branchId: 'branch-2',
          variantId: 'variant-2',
          stockQuantity: 0,
          isAvailable: true,
        }),
      ]),
    });
    expect(tx.branchVariant.createMany.mock.calls[0][0].data).toHaveLength(4);
  });

  it('rejects a branch stock update below already reserved quantity', async () => {
    const tx = {
      branchVariant: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'offer-1', reservedQuantity: 4 }),
        updateMany: jest.fn(),
      },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prismaService);

    await expect(
      service.updateBranchOffer('branch-1', 'variant-1', {
        stockQuantity: 3,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.branchVariant.updateMany).not.toHaveBeenCalled();
  });

  it('submits branch-created products as pending and opens their branch offers', async () => {
    const product = {
      id: 'product-1',
      name: 'Branch Product',
      slug: 'branch-product',
      description: 'Local item',
      brandId: 'brand-1',
      branchId: 'branch-1',
      categoryId: 'category-1',
      media: [],
      status: 'pending',
      variants: [
        {
          id: 'variant-1',
          sku: 'SKU-1',
          basePrice: 30,
          barcode: null,
          options: { color: 'blue', size: 'M' },
          isActive: true,
        },
      ],
    };
    const tx = {
      brandBranch: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'branch-1', brandId: 'brand-1' }),
      },
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'category-1' }),
      },
      product: { create: jest.fn().mockResolvedValue(product) },
      branchVariant: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prismaService);

    const created = await service.createBranchProduct('branch-1', {
      name: 'Branch Product',
      description: 'Local item',
      categoryId: 'category-1',
      variants: [{ basePrice: 30 }],
    });

    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brandId: 'brand-1',
          branchId: 'branch-1',
          status: 'pending',
          available: false,
        }),
      }),
    );
    expect(tx.branchVariant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          branchId: 'branch-1',
          variantId: 'variant-1',
          stockQuantity: 0,
          isAvailable: true,
        }),
      ],
    });
    expect(created.status).toBe('pending');
  });

  it('copies offerings without copying stock', async () => {
    const tx = {
      brandBranch: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'target', brandId: 'brand-1' })
          .mockResolvedValueOnce({ id: 'source', brandId: 'brand-1' }),
      },
      branchVariant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { variantId: 'variant-1', price: 75, isAvailable: true },
          ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prismaService);

    await expect(
      service.copyOfferings('target', { sourceBranchId: 'source' }),
    ).resolves.toEqual({ copied: 1 });
    expect(tx.branchVariant.createMany).toHaveBeenCalledWith({
      data: [
        {
          branchId: 'target',
          variantId: 'variant-1',
          price: 75,
          stockQuantity: 0,
          reservedQuantity: 0,
          isAvailable: true,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('hides a source branch from another brand when copying offerings', async () => {
    const tx = {
      brandBranch: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'target', brandId: 'brand-1' })
          .mockResolvedValueOnce({ id: 'source', brandId: 'brand-2' }),
      },
      branchVariant: { findMany: jest.fn(), createMany: jest.fn() },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prismaService);

    await expect(
      service.copyOfferings('target', { sourceBranchId: 'source' }),
    ).rejects.toThrow('Branch not found');
    expect(tx.branchVariant.findMany).not.toHaveBeenCalled();
  });
});
