import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  it('paginates and filters branch stock by variant and product fields', async () => {
    const branchId = '00000000-0000-4000-8000-000000000001';
    const inventory = {
      id: 'inventory-1',
      type: 'branch',
      brandId: 'brand-1',
      branchId,
      isActive: true,
      createdAt: new Date('2026-10-11T00:00:00.000Z'),
    };
    const stock = {
      variantId: 'variant-1',
      onHand: 12,
      reserved: 3,
      inTransitIn: 1,
      lowStockThreshold: 4,
      updatedAt: new Date('2026-10-11T00:00:00.000Z'),
      variant: {
        id: 'variant-1',
        sku: 'SKU-1',
        color: 'black',
        size: 'M',
        basePrice: 100,
        options: {},
        isActive: true,
        isDeleted: false,
        product: {
          id: 'product-1',
          name: 'Everyday Shirt',
          slug: 'everyday-shirt',
        },
      },
    };
    const findUnique = jest.fn().mockResolvedValue(inventory);
    const findMany = jest.fn().mockResolvedValue([stock]);
    const count = jest.fn().mockResolvedValue(5);
    const prismaService = {
      prisma: {
        inventory: { findUnique },
        inventoryStock: { findMany, count },
        $transaction: jest.fn((queries: Promise<unknown>[]) =>
          Promise.all(queries),
        ),
      },
    } as unknown as PrismaService;
    const service = new InventoryService(prismaService);
    const query = {
      page: 2,
      limit: 2,
      search: 'shirt',
      productId: '00000000-0000-4000-8000-000000000002',
      color: 'black',
      size: 'M',
      isActive: true,
    };
    const result = await Reflect.apply(service.getBranchInventory, service, [
      branchId,
      query,
    ]);

    expect(result).toEqual({
      ...inventory,
      stocks: [stock],
      meta: { total: 5, page: 2, limit: 2, totalPages: 3 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inventoryId: inventory.id,
          variant: {
            is: expect.objectContaining({
              productId: query.productId,
              color: { equals: 'black', mode: 'insensitive' },
              size: { equals: 'M', mode: 'insensitive' },
              isActive: true,
              OR: [
                { sku: { contains: 'shirt', mode: 'insensitive' } },
                {
                  product: {
                    name: { contains: 'shirt', mode: 'insensitive' },
                  },
                },
              ],
            }),
          },
        },
        skip: 2,
        take: 2,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: findMany.mock.calls[0][0].where,
    });
  });

  it('throws not found when the branch has no inventory', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaService = {
      prisma: { inventory: { findUnique } },
    } as unknown as PrismaService;
    const service = new InventoryService(prismaService);

    await expect(service.getBranchInventory('branch-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects inventory deletion while any stock quantity is nonzero', async () => {
    const transaction = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inventory-1',
          isActive: true,
        }),
        update: jest.fn(),
      },
      inventoryStock: {
        findMany: jest.fn().mockResolvedValue([
          {
            onHand: 2,
            reserved: 0,
            inTransitIn: 0,
            variant: {
              sku: 'SKU-1',
              product: { name: 'Everyday Shirt' },
            },
          },
        ]),
      },
    };
    const service = new InventoryService({} as PrismaService);
    const deleteInventory = Reflect.get(service, 'deleteInventory');

    await expect(
      Reflect.apply(deleteInventory, service, ['inventory-1', transaction]),
    ).rejects.toThrow(ConflictException);
    expect(transaction.inventory.update).not.toHaveBeenCalled();
  });

  it('deactivates inventory after confirming all stock quantities are zero', async () => {
    const inventory = { id: 'inventory-1', isActive: true };
    const transaction = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue(inventory),
        update: jest.fn().mockResolvedValue({ ...inventory, isActive: false }),
      },
      inventoryStock: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new InventoryService({} as PrismaService);
    const deleteInventory = Reflect.get(service, 'deleteInventory');

    await expect(
      Reflect.apply(deleteInventory, service, ['inventory-1', transaction]),
    ).resolves.toEqual({ ...inventory, isActive: false });
    expect(transaction.inventoryStock.findMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'inventory-1',
        OR: [
          { onHand: { not: 0 } },
          { reserved: { not: 0 } },
          { inTransitIn: { not: 0 } },
        ],
      },
      select: {
        onHand: true,
        reserved: true,
        inTransitIn: true,
        variant: {
          select: { sku: true, product: { select: { name: true } } },
        },
      },
    });
    expect(transaction.inventory.update).toHaveBeenCalledWith({
      where: { id: 'inventory-1' },
      data: { isActive: false },
    });
  });
});
