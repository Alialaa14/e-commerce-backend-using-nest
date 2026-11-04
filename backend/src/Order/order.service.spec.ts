import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BranchRole, orderStatus, Role } from '../generated/prisma';
import { AuthUser } from '../common/decorators/Current-user-decorator';

jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

const { OrderService } = require('./order.service') as {
  OrderService: new (
    prisma: unknown,
    socket: unknown,
  ) => {
    updateBranchOrderStatus(
      actor: AuthUser,
      branchOrderId: string,
      status: orderStatus,
    ): Promise<unknown>;
  };
};

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
    };
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback(tx)),
      },
    };
    const socket = { notifyBranchOrderUpdated: jest.fn() };
    return {
      service: new OrderService(prismaService, socket),
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
});
