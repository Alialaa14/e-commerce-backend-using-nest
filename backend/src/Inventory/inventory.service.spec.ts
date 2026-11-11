import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../utils/prisma/prisma.service';
import { StockLedgerService } from '../StockLedger/stock-ledger.service';
import { InventoryService } from './inventory.service';

const createInventoryService = (prismaService: PrismaService) =>
  new InventoryService(prismaService, new StockLedgerService());

describe('InventoryService', () => {
  it('returns stock details with computed available quantity for a branch variant', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'inventory-1' });
    const stock = {
      inventoryId: 'inventory-1',
      variantId: 'variant-1',
      onHand: 12,
      reserved: 3,
      inTransitIn: 2,
      lowStockThreshold: 4,
      updatedAt: new Date('2026-10-11T00:00:00.000Z'),
      variant: { id: 'variant-1', sku: 'SKU-1' },
    };
    const findUnique = jest.fn().mockResolvedValue(stock);
    const service = createInventoryService({
      prisma: {
        inventory: { findFirst },
        inventoryStock: { findUnique },
      },
    } as unknown as PrismaService);

    await expect(
      service.getBranchVariantStock('branch-1', 'variant-1'),
    ).resolves.toEqual({ ...stock, available: 9 });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inventoryId_variantId: {
            inventoryId: 'inventory-1',
            variantId: 'variant-1',
          },
        },
      }),
    );
  });

  it('sets on-hand stock and records the adjustment in the ledger atomically', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      inventory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inventory-1' }),
      },
      inventoryStock: {
        upsert: jest.fn(),
        updateMany,
      },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 2 }]),
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService;
    const service = createInventoryService(prismaService);

    await service.setBranchVariantStock(
      'branch-1',
      'variant-1',
      { onHand: 10, lowStockThreshold: 3 },
      'user-1',
      'Cycle count',
    );

    expect(tx.inventoryStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inventoryId_variantId: {
            inventoryId: 'inventory-1',
            variantId: 'variant-1',
          },
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { inventoryId: 'inventory-1', variantId: 'variant-1' },
      data: { onHand: 10, lowStockThreshold: 3 },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 2,
        reason: 'adjustment',
        userId: 'user-1',
        note: 'Cycle count',
      },
      select: {
        id: true,
        inventoryId: true,
        variantId: true,
        changeQty: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        userId: true,
        note: true,
        createdAt: true,
      },
    });
  });

  it('rejects setting on-hand below the reserved quantity', async () => {
    const updateMany = jest.fn();
    const tx = {
      inventory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inventory-1' }),
      },
      inventoryStock: { upsert: jest.fn(), updateMany },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 5 }]),
    };
    const service = createInventoryService({
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService);

    await expect(
      service.setBranchVariantStock(
        'branch-1',
        'variant-1',
        { onHand: 4 },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
  });

  it('reserves only available stock and writes a reservation ledger entry', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      inventoryStock: { updateMany },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 5 }]),
    };
    const service = createInventoryService({
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService);

    await service.reserveStock(
      'inventory-1',
      'variant-1',
      3,
      'checkout-1',
      tx as unknown as Prisma.TransactionClient,
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        onHand: { gte: 8 },
      },
      data: { reserved: { increment: 3 } },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: 3,
        reason: 'reserve',
        referenceType: 'RESERVATION',
        referenceId: 'checkout-1',
      },
      select: {
        id: true,
        inventoryId: true,
        variantId: true,
        changeQty: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        userId: true,
        note: true,
        createdAt: true,
      },
    });
  });

  it('rejects reservation when available stock is insufficient', async () => {
    const updateMany = jest.fn();
    const tx = {
      inventoryStock: { updateMany },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 6 }]),
    };
    const service = createInventoryService({
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService);

    await expect(
      service.reserveStock(
        'inventory-1',
        'variant-1',
        3,
        'checkout-1',
        tx as unknown as Prisma.TransactionClient,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(tx.stockLedger.create).not.toHaveBeenCalled();
  });

  it('releases reserved stock without allowing the reserved count to go negative', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      inventoryStock: { updateMany },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 4 }]),
    };
    const service = createInventoryService({
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService);

    await service.releaseStock(
      'inventory-1',
      'variant-1',
      2,
      'checkout-1',
      tx as unknown as Prisma.TransactionClient,
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        reserved: { gte: 2 },
      },
      data: { reserved: { decrement: 2 } },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: -2,
        reason: 'release',
        referenceType: 'RESERVATION',
        referenceId: 'checkout-1',
      },
      select: {
        id: true,
        inventoryId: true,
        variantId: true,
        changeQty: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        userId: true,
        note: true,
        createdAt: true,
      },
    });
  });

  it('converts a reservation to a sale by decrementing on-hand and reserved together', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      inventoryStock: { updateMany },
      stockLedger: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ onHand: 8, reserved: 3 }]),
    };
    const service = createInventoryService({
      prisma: {
        $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    } as unknown as PrismaService);

    await service.fulfillReservedStock(
      'inventory-1',
      'variant-1',
      2,
      'order-1',
      tx as unknown as Prisma.TransactionClient,
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        onHand: { gte: 2 },
        reserved: { gte: 2 },
      },
      data: {
        onHand: { decrement: 2 },
        reserved: { decrement: 2 },
      },
    });
    expect(tx.stockLedger.create).toHaveBeenCalledWith({
      data: {
        inventoryId: 'inventory-1',
        variantId: 'variant-1',
        changeQty: -2,
        reason: 'sale',
        referenceType: 'ORDER',
        referenceId: 'order-1',
      },
      select: {
        id: true,
        inventoryId: true,
        variantId: true,
        changeQty: true,
        reason: true,
        referenceType: true,
        referenceId: true,
        userId: true,
        note: true,
        createdAt: true,
      },
    });
  });

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
    const service = createInventoryService(prismaService);
    const query = {
      page: 2,
      limit: 2,
      search: 'shirt',
      productId: '00000000-0000-4000-8000-000000000002',
      color: 'black',
      size: 'M',
      isActive: true,
    };
    const where = {
      inventoryId: inventory.id,
      variant: {
        is: {
          productId: query.productId,
          color: { equals: 'black', mode: 'insensitive' },
          size: { equals: 'M', mode: 'insensitive' },
          isActive: true,
          OR: [
            { sku: { contains: 'shirt', mode: 'insensitive' } },
            { product: { name: { contains: 'shirt', mode: 'insensitive' } } },
          ],
        },
      },
    };
    const result = await service.getBranchInventory(branchId, query);

    expect(result).toEqual({
      ...inventory,
      stocks: [stock],
      meta: { total: 5, page: 2, limit: 2, totalPages: 3 },
    });
    expect(findMany).toHaveBeenCalledWith({
      where,
      skip: 2,
      take: 2,
      orderBy: { variant: { sku: 'asc' } },
      select: {
        variantId: true,
        onHand: true,
        reserved: true,
        inTransitIn: true,
        lowStockThreshold: true,
        updatedAt: true,
        variant: {
          select: {
            id: true,
            sku: true,
            color: true,
            size: true,
            basePrice: true,
            options: true,
            isActive: true,
            isDeleted: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('throws not found when the branch has no inventory', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaService = {
      prisma: { inventory: { findUnique } },
    } as unknown as PrismaService;
    const service = createInventoryService(prismaService);

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
    const service = createInventoryService({} as PrismaService);
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
    const service = createInventoryService({} as PrismaService);
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
