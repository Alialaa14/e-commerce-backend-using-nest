import { PrismaService } from '../../utils/prisma/prisma.service';
import { orderStatus } from '../../generated/prisma';
import { OrderModel } from './order.model';

describe('OrderModel', () => {
  it('lists only orders for the requested branch with pagination and status filters', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaService = {
      prisma: {
        branchOrder: { findMany },
      },
    } as unknown as PrismaService;
    const model = new OrderModel(prismaService);

    await model.findBranchOrdersForBranch(
      'branch-1',
      { skip: 10, take: 5 },
      orderStatus.ordering,
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        brandBranchId: 'branch-1',
        status: orderStatus.ordering,
      },
      skip: 10,
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('lists only orders for the requested brand when no status filter is provided', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaService = {
      prisma: {
        branchOrder: { findMany },
      },
    } as unknown as PrismaService;
    const model = new OrderModel(prismaService);

    await model.findBranchOrdersForBrand('brand-1', { skip: 0, take: 20 });

    expect(findMany).toHaveBeenCalledWith({
      where: { brandId: 'brand-1' },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('loads an order only when it belongs to the requested brand', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prismaService = {
      prisma: {
        branchOrder: { findFirst },
      },
    } as unknown as PrismaService;
    const model = new OrderModel(prismaService);

    await model.findBranchOrderForBrand('branch-order-1', 'brand-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        brandId: 'brand-1',
      },
      select: expect.any(Object),
    });
  });

  it('loads an order only when it belongs to the requested branch', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prismaService = {
      prisma: {
        branchOrder: { findFirst },
      },
    } as unknown as PrismaService;
    const model = new OrderModel(prismaService);

    await model.findBranchOrderForBranch('branch-order-1', 'branch-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        brandBranchId: 'branch-1',
      },
      select: expect.any(Object),
    });
  });

  it('updates status only if the order still has the expected status', async () => {
    const update = jest.fn().mockResolvedValue({});
    const transaction = {
      branchOrder: { update },
    };
    const prismaService = {
      prisma: {
        branchOrder: { update: jest.fn() },
      },
    } as unknown as PrismaService;
    const model = new OrderModel(prismaService);

    await model.updateBranchOrderStatus(
      'branch-order-1',
      orderStatus.ordering,
      orderStatus.packing,
      transaction as never,
    );

    expect(update).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        status: orderStatus.ordering,
      },
      data: { status: orderStatus.packing },
      select: expect.any(Object),
    });
    expect(prismaService.prisma.branchOrder.update).not.toHaveBeenCalled();
  });
});
