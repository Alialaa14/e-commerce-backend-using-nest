import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BranchRole, orderStatus, Role } from '../generated/prisma';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { OrderService } from './order.service';
import { PrismaService } from '../utils/prisma/prisma.service';

jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

const runTransaction = (transaction: unknown) =>
  jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
    callback(transaction),
  );

describe('OrderService.updateBranchOrderStatus', () => {
  const actor: AuthUser = {
    sub: 'staff-1',
    role: Role.BRANCH_MANAGER,
    brandId: 'brand-1',
    branchId: 'branch-1',
  };

  function createService(currentStatus = orderStatus.ordering) {
    const updatedOrder = {
      branchOrderId: 'branch-order-1',
      brandBranchId: 'branch-1',
      status: orderStatus.packing,
    };
    const tx = {
      branchOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            branchOrderId: 'branch-order-1',
            brandBranchId: 'branch-1',
            brandId: 'brand-1',
            status: currentStatus,
          })
          .mockResolvedValueOnce(updatedOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      branchStaff: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          role: BranchRole.manager,
          branch: {
            brandId: 'brand-1',
            isActive: true,
            deletedAt: null,
          },
        }),
      },
      branchOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(tx),
      },
    };
    const socket = { notifyBranchOrderUpdated: jest.fn() };
    return {
      service: new OrderService(
        prismaService as unknown as PrismaService,
        socket as never,
      ),
      tx,
      socket,
    };
  }

  it('allows active branch staff to advance an order to packing', async () => {
    const { service, tx, socket } = createService();

    await service.updateBranchOrderStatus(
      actor,
      'branch-order-1',
      orderStatus.packing,
    );

    expect(tx.branchOrder.updateMany).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        status: orderStatus.ordering,
        brandBranchId: 'branch-1',
      },
      data: { status: orderStatus.packing },
    });
    expect(socket.notifyBranchOrderUpdated).toHaveBeenCalledWith(
      'branch-1',
      expect.objectContaining({ status: orderStatus.packing }),
    );
  });

  it('does not allow branch staff to skip the packing stage', async () => {
    const { service, tx } = createService();

    await expect(
      service.updateBranchOrderStatus(
        actor,
        'branch-order-1',
        orderStatus.readytoship,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.branchOrder.updateMany).not.toHaveBeenCalled();
  });

  it('rejects users who are not active members of the order branch', async () => {
    const { service, tx } = createService();
    tx.branchStaff.findUnique.mockResolvedValue({
      isActive: false,
      role: BranchRole.manager,
      branch: { brandId: 'brand-1', isActive: true, deletedAt: null },
    });

    await expect(
      service.updateBranchOrderStatus(
        actor,
        'branch-order-1',
        orderStatus.packing,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hands a ready branch order to the selected verified delivery company', async () => {
    const tx = {
      branchOrder: {
        findFirst: jest.fn().mockResolvedValue({
          branchOrderId: 'branch-order-1',
          parentOrderId: 'parent-order-1',
          brandBranchId: 'branch-1',
          brandId: 'brand-1',
          status: orderStatus.packing,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      branchStaff: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          role: BranchRole.manager,
          branch: {
            brandId: 'brand-1',
            isActive: true,
            deletedAt: null,
          },
        }),
      },
      d_Company: {
        findFirst: jest.fn().mockResolvedValue({
          deliveryCompany: 'company-1',
          isVerified: true,
          isBanned: false,
        }),
      },
      branchOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(tx),
      },
    };
    const socket = { notifyBranchOrderUpdated: jest.fn() };
    const service = new OrderService(
      prismaService as unknown as PrismaService,
      socket as never,
    );

    await service.updateBranchOrderStatus(
      actor,
      'branch-order-1',
      orderStatus.readytoship,
      'company-1',
    );

    expect(tx.d_Company.findFirst).toHaveBeenCalledWith({
      where: {
        deliveryCompany: 'company-1',
        isVerified: true,
        isBanned: false,
      },
      select: { deliveryCompany: true },
    });
    expect(tx.branchOrder.updateMany).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        brandBranchId: 'branch-1',
        status: orderStatus.packing,
      },
      data: {
        status: orderStatus.readytoship,
        deliveryCompanyId: 'company-1',
      },
    });
  });

  it('allows only the assigned courier to start delivery', async () => {
    const courierActor: AuthUser = {
      sub: 'courier-user-1',
      role: Role.courier,
    };
    const tx = {
      branchOrder: {
        findFirst: jest.fn().mockResolvedValue({
          branchOrderId: 'branch-order-1',
          parentOrderId: 'parent-order-1',
          brandBranchId: 'branch-1',
          brandId: 'brand-1',
          deliveryCompanyId: 'company-1',
          courierId: 'courier-1',
          status: orderStatus.readytoship,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      courier: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'courier-1',
          deliveryCompanyId: 'company-1',
          isVerified: true,
          isBanned: false,
          isActive: true,
        }),
      },
      branchOrderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(tx),
      },
    };
    const socket = { notifyBranchOrderUpdated: jest.fn() };
    const service = new OrderService(
      prismaService as unknown as PrismaService,
      socket as never,
    );

    await service.updateBranchOrderStatus(
      courierActor,
      'branch-order-1',
      orderStatus.shipping,
    );

    expect(tx.branchOrder.updateMany).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        status: orderStatus.readytoship,
        deliveryCompanyId: 'company-1',
        courierId: 'courier-1',
      },
      data: { status: orderStatus.shipping },
    });
    expect(tx.branchOrderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        branchOrderId: 'branch-order-1',
        fromStatus: orderStatus.readytoship,
        toStatus: orderStatus.shipping,
        changedByUserId: courierActor.sub,
        changedByRole: Role.courier,
        metadata: undefined,
      },
    });
  });

  it('does not allow an unassigned courier to update a delivery order', async () => {
    const courierActor: AuthUser = {
      sub: 'courier-user-2',
      role: Role.courier,
    };
    const tx = {
      branchOrder: {
        findFirst: jest.fn().mockResolvedValue({
          branchOrderId: 'branch-order-1',
          status: orderStatus.readytoship,
          deliveryCompanyId: 'company-1',
          courierId: 'courier-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      courier: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(tx),
      },
    };
    const service = new OrderService(
      prismaService as unknown as PrismaService,
      { notifyBranchOrderUpdated: jest.fn() } as never,
    );

    await expect(
      service.updateBranchOrderStatus(
        courierActor,
        'branch-order-1',
        orderStatus.shipping,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.branchOrder.updateMany).not.toHaveBeenCalled();
  });

  it('requires delivery proof before a courier marks an order delivered', async () => {
    const courierActor: AuthUser = {
      sub: 'courier-user-1',
      role: Role.courier,
    };
    const tx = {
      branchOrder: {
        findFirst: jest.fn().mockResolvedValue({
          branchOrderId: 'branch-order-1',
          status: orderStatus.delivering,
          deliveryCompanyId: 'company-1',
          courierId: 'courier-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      courier: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'courier-1',
          deliveryCompanyId: 'company-1',
          isVerified: true,
          isBanned: false,
          isActive: true,
        }),
      },
      deliveryProof: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(tx),
      },
    };
    const service = new OrderService(
      prismaService as unknown as PrismaService,
      { notifyBranchOrderUpdated: jest.fn() } as never,
    );

    await expect(
      service.updateBranchOrderStatus(
        courierActor,
        'branch-order-1',
        orderStatus.delivered,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.branchOrder.updateMany).not.toHaveBeenCalled();
  });
});
