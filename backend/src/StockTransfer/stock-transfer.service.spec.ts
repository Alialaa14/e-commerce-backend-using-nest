import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { StockTransferService } from './stock-transfer.service';

describe('StockTransferService', () => {
  it('creates a transfer request from the brand owner main inventory', async () => {
    const sourceInventory = {
      id: 'main-inventory',
      brandId: 'brand-1',
      branchId: null,
      type: 'main',
      isActive: true,
      brand: { userId: 'owner-1' },
      branch: null,
    };
    const destinationInventory = {
      id: 'branch-inventory',
      brandId: 'brand-1',
      branchId: 'branch-1',
      type: 'branch',
      isActive: true,
      brand: { userId: 'owner-1' },
      branch: { id: 'branch-1', isActive: true, deletedAt: null },
    };
    const transfer = { id: 'transfer-1', status: 'requested' };
    const tx = {
      inventory: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(sourceInventory)
          .mockResolvedValueOnce(destinationInventory),
      },
      variant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'variant-1' }]),
      },
      stockTransfer: { create: jest.fn().mockResolvedValue(transfer) },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback(tx)),
      },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.createTransfer(
        { sub: 'owner-1', role: 'brandOwner', brandId: 'brand-1' },
        {
          fromInventoryId: sourceInventory.id,
          toInventoryId: destinationInventory.id,
          items: [{ variantId: 'variant-1', qtyRequested: 4 }],
        },
      ),
    ).resolves.toBe(transfer);
    expect(tx.stockTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromInventoryId: sourceInventory.id,
          toInventoryId: destinationInventory.id,
          createdBy: 'owner-1',
          items: {
            create: [{ variantId: 'variant-1', qtyRequested: 4 }],
          },
        }),
      }),
    );
  });

  it('requires a branch manager to create transfers from a branch inventory', async () => {
    const sourceInventory = {
      id: 'branch-inventory',
      brandId: 'brand-1',
      branchId: 'branch-1',
      type: 'branch',
      isActive: true,
      brand: { userId: 'owner-1' },
      branch: { id: 'branch-1', isActive: true, deletedAt: null },
    };
    const tx = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue(sourceInventory),
      },
      stockTransfer: { create: jest.fn() },
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback(tx)),
      },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.createTransfer(
        { sub: 'owner-1', role: 'brandOwner', brandId: 'brand-1' },
        {
          fromInventoryId: sourceInventory.id,
          toInventoryId: 'destination-inventory',
          items: [{ variantId: 'variant-1', qtyRequested: 1 }],
        },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.stockTransfer.create).not.toHaveBeenCalled();
  });

  it('allows the assigned branch manager to create a transfer from that branch', async () => {
    const sourceInventory = {
      id: 'branch-inventory',
      brandId: 'brand-1',
      branchId: 'branch-1',
      type: 'branch',
      isActive: true,
      brand: { userId: 'owner-1' },
      branch: { id: 'branch-1', isActive: true, deletedAt: null },
    };
    const destinationInventory = {
      id: 'main-inventory',
      brandId: 'brand-1',
      branchId: null,
      type: 'main',
      isActive: true,
      brand: { userId: 'owner-1' },
      branch: null,
    };
    const transfer = { id: 'transfer-1', status: 'requested' };
    const tx = {
      inventory: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(sourceInventory)
          .mockResolvedValueOnce(destinationInventory),
      },
      variant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'variant-1' }]),
      },
      stockTransfer: { create: jest.fn().mockResolvedValue(transfer) },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.createTransfer(
        { sub: 'manager-1', role: 'BRANCH_MANAGER', branchId: 'branch-1' },
        {
          fromInventoryId: sourceInventory.id,
          toInventoryId: destinationInventory.id,
          items: [{ variantId: 'variant-1', qtyRequested: 2 }],
        },
      ),
    ).resolves.toBe(transfer);
    expect(tx.stockTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'manager-1',
          fromInventoryId: 'branch-inventory',
          toInventoryId: 'main-inventory',
        }),
      }),
    );
  });

  it('allows the destination branch manager to approve a request', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'requested',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [],
    };
    const tx = {
      stockTransfer: {
        findUnique: jest.fn().mockResolvedValue(transfer),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await service.approveTransfer(
      { sub: 'manager-1', role: 'BRANCH_MANAGER', branchId: 'branch-1' },
      'transfer-1',
    );

    expect(tx.stockTransfer.updateMany).toHaveBeenCalledWith({
      where: { id: 'transfer-1', status: 'requested' },
      data: { status: 'approved', approvedBy: 'manager-1' },
    });
  });

  it('rejects shipment when available source stock is insufficient', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'approved',
      fromInventoryId: 'main-inventory',
      toInventoryId: 'branch-inventory',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [
        {
          id: 'transfer-item-1',
          variantId: 'variant-1',
          qtyRequested: 5,
          qtyShipped: 0,
          qtyReceived: 0,
        },
      ],
    };
    const tx = {
      stockTransfer: { findUnique: jest.fn().mockResolvedValue(transfer) },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { variantId: 'variant-1', onHand: 4, reserved: 1 },
        ]),
      inventoryStock: { updateMany: jest.fn() },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.shipTransfer(
        { sub: 'owner-1', role: 'brandOwner' },
        'transfer-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.inventoryStock.updateMany).not.toHaveBeenCalled();
  });

  it('ships stock atomically from the source inventory into destination transit', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'approved',
      fromInventoryId: 'main-inventory',
      toInventoryId: 'branch-inventory',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [
        {
          id: 'transfer-item-1',
          variantId: 'variant-1',
          qtyRequested: 4,
          qtyShipped: 0,
          qtyReceived: 0,
        },
      ],
    };
    const tx = {
      stockTransfer: {
        findUnique: jest.fn().mockResolvedValue(transfer),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { variantId: 'variant-1', onHand: 10, reserved: 2 },
        ]),
      inventoryStock: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
      stockTransferItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockLedger: { createMany: jest.fn() },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await service.shipTransfer(
      { sub: 'owner-1', role: 'brandOwner' },
      'transfer-1',
    );

    expect(tx.inventoryStock.updateMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'main-inventory',
        variantId: 'variant-1',
        onHand: { gte: 6 },
      },
      data: { onHand: { decrement: 4 } },
    });
    expect(tx.inventoryStock.upsert).toHaveBeenCalledWith({
      where: {
        inventoryId_variantId: {
          inventoryId: 'branch-inventory',
          variantId: 'variant-1',
        },
      },
      create: {
        inventoryId: 'branch-inventory',
        variantId: 'variant-1',
        inTransitIn: 4,
      },
      update: { inTransitIn: { increment: 4 } },
    });
    expect(tx.stockLedger.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          inventoryId: 'main-inventory',
          changeQty: -4,
          reason: 'transfer_out',
          referenceId: 'transfer-1',
        }),
        expect.objectContaining({
          inventoryId: 'branch-inventory',
          changeQty: 4,
          reason: 'transfer_in',
          referenceId: 'transfer-1',
        }),
      ]),
    });
  });

  it('records partial receipt and leaves the transfer open', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'shipped',
      fromInventoryId: 'main-inventory',
      toInventoryId: 'branch-inventory',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [
        {
          id: 'transfer-item-1',
          variantId: 'variant-1',
          qtyRequested: 5,
          qtyShipped: 5,
          qtyReceived: 0,
        },
      ],
    };
    const tx = {
      stockTransfer: {
        findUnique: jest.fn().mockResolvedValue(transfer),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryStock: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      stockTransferItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockLedger: { createMany: jest.fn() },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await service.receiveTransfer(
      { sub: 'manager-1', role: 'BRANCH_MANAGER', branchId: 'branch-1' },
      'transfer-1',
      [{ variantId: 'variant-1', qtyReceived: 2 }],
    );

    expect(tx.inventoryStock.updateMany).toHaveBeenCalledWith({
      where: {
        inventoryId: 'branch-inventory',
        variantId: 'variant-1',
        inTransitIn: { gte: 2 },
      },
      data: { inTransitIn: { decrement: 2 }, onHand: { increment: 2 } },
    });
    expect(tx.stockTransferItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'transfer-item-1', qtyReceived: 0 },
      data: { qtyReceived: { increment: 2 } },
    });
    expect(tx.stockTransfer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transfer-1', status: 'shipped' },
        data: { status: 'partially_received' },
      }),
    );
  });

  it('allows the source owner to cancel an unshipped request', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'requested',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [],
    };
    const tx = {
      stockTransfer: {
        findUnique: jest.fn().mockResolvedValue(transfer),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prismaService = {
      prisma: { $transaction: jest.fn((callback) => callback(tx)) },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await service.cancelTransfer(
      { sub: 'owner-1', role: 'brandOwner' },
      'transfer-1',
    );

    expect(tx.stockTransfer.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'transfer-1',
        status: { in: ['requested', 'approved'] },
      },
      data: { status: 'cancelled' },
    });
  });

  it('returns a transfer only to users assigned to one of its inventories', async () => {
    const transfer = {
      id: 'transfer-1',
      status: 'requested',
      from: {
        id: 'main-inventory',
        brandId: 'brand-1',
        type: 'main',
        branchId: null,
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: null,
      },
      to: {
        id: 'branch-inventory',
        brandId: 'brand-1',
        type: 'branch',
        branchId: 'branch-1',
        isActive: true,
        brand: { userId: 'owner-1' },
        branch: { id: 'branch-1', isActive: true, deletedAt: null },
      },
      items: [],
    };
    const findUnique = jest.fn().mockResolvedValue(transfer);
    const prismaService = {
      prisma: { stockTransfer: { findUnique } },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.getTransfer(
        { sub: 'manager-2', role: 'BRANCH_MANAGER', branchId: 'branch-2' },
        'transfer-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists only transfers associated with the brand owner', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'transfer-1' }]);
    const count = jest.fn().mockResolvedValue(3);
    const prismaService = {
      prisma: {
        stockTransfer: { findMany, count },
        $transaction: jest.fn((queries: Promise<unknown>[]) =>
          Promise.all(queries),
        ),
      },
    } as unknown as PrismaService;
    const service = new StockTransferService(prismaService);

    await expect(
      service.listTransfers(
        { sub: 'owner-1', role: 'brandOwner' },
        { page: 2, limit: 1, status: 'shipped' },
      ),
    ).resolves.toEqual({
      data: [{ id: 'transfer-1' }],
      meta: { total: 3, page: 2, limit: 1, totalPages: 3 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'shipped',
          OR: [
            { from: { is: { brand: { is: { userId: 'owner-1' } } } } },
            { to: { is: { brand: { is: { userId: 'owner-1' } } } } },
          ],
        }),
        skip: 1,
        take: 1,
      }),
    );
  });
});
