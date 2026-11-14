import { ConflictException, NotFoundException } from '@nestjs/common';
import { orderStatus, Role } from '../generated/prisma';
import type { AuthUser } from '../common/decorators/Current-user-decorator';

jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

import { OrderService } from '../Order/order.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { SocketServices } from '../Socket/socket.service';
import { StaffService } from '../Staff/staff.service';
import { DeliveryService } from './delivery.service';

const runTransaction = (transaction: unknown) =>
  jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
    callback(transaction),
  );

describe('DeliveryService', () => {
  const companyActor: AuthUser = {
    sub: 'company-user-1',
    role: Role.deliveryC,
  };

  it('lists only orders handed to the company linked to the authenticated user', async () => {
    type OrderQuery = {
      where: {
        deliveryCompanyId: string;
        status?: orderStatus;
      };
    };
    let orderQuery: OrderQuery | undefined;
    const findMany = jest.fn((input: OrderQuery) => {
      orderQuery = input;
      return Promise.resolve([]);
    });
    const count = jest.fn().mockResolvedValue(0);
    const prismaService = {
      prisma: {
        d_Company: {
          findFirst: jest.fn().mockResolvedValue({
            deliveryCompany: 'company-1',
            name: 'Nile Express',
            address: 'Cairo',
            phoneNumber: '+201012345678',
            isVerified: true,
          }),
        },
        branchOrder: { findMany, count },
        $transaction: jest.fn((queries: Promise<unknown>[]) =>
          Promise.all(queries),
        ),
      },
    } as unknown as PrismaService;
    const service = new DeliveryService(
      prismaService,
      {} as StaffService,
      {} as OrderService,
      {} as SocketServices,
    );

    await service.listCompanyOrders(companyActor, {
      page: 1,
      limit: 20,
      status: orderStatus.readytoship,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deliveryCompanyId: 'company-1',
          status: orderStatus.readytoship,
        },
      }),
    );
    expect(orderQuery?.where).not.toHaveProperty('ownerUserId');
  });

  it('does not assign an order to a courier outside the company fleet', async () => {
    const courierFindFirst = jest.fn().mockResolvedValue(null);
    const orderFindFirst = jest.fn();
    const prismaService = {
      prisma: {
        d_Company: {
          findFirst: jest.fn().mockResolvedValue({
            deliveryCompany: 'company-1',
            isVerified: true,
            isBanned: false,
          }),
        },
        $transaction: runTransaction({
          courier: { findFirst: courierFindFirst },
          branchOrder: { findFirst: orderFindFirst },
        }),
      },
    } as unknown as PrismaService;
    const service = new DeliveryService(
      prismaService,
      {} as StaffService,
      {} as OrderService,
      {} as SocketServices,
    );

    await expect(
      service.assignCourier(companyActor, 'branch-order-1', 'courier-2'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(courierFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'courier-2',
        deliveryCompanyId: 'company-1',
        isActive: true,
        isVerified: true,
        isBanned: false,
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });
    expect(orderFindFirst).not.toHaveBeenCalled();
  });

  it('detects an order assigned concurrently by another dispatcher', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prismaService = {
      prisma: {
        d_Company: {
          findFirst: jest.fn().mockResolvedValue({
            deliveryCompany: 'company-1',
            isVerified: true,
            isBanned: false,
          }),
        },
        $transaction: runTransaction({
          courier: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'courier-1',
              userId: 'courier-user-1',
            }),
          },
          branchOrder: {
            findFirst: jest.fn().mockResolvedValue({
              branchOrderId: 'branch-order-1',
              parentOrderId: 'parent-order-1',
              brandBranchId: 'branch-1',
            }),
            updateMany,
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new DeliveryService(
      prismaService,
      {} as StaffService,
      {} as OrderService,
      {} as SocketServices,
    );

    await expect(
      service.assignCourier(companyActor, 'branch-order-1', 'courier-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        branchOrderId: 'branch-order-1',
        deliveryCompanyId: 'company-1',
        status: orderStatus.readytoship,
        courierId: null,
      },
      data: { courierId: 'courier-1' },
    });
  });

  it('notifies the assigned courier after the order transaction commits', async () => {
    const notifyCourierAssigned = jest.fn();
    const prismaService = {
      prisma: {
        d_Company: {
          findFirst: jest.fn().mockResolvedValue({
            deliveryCompany: 'company-1',
            isVerified: true,
            isBanned: false,
          }),
        },
        $transaction: runTransaction({
          courier: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'courier-1',
              userId: 'courier-user-1',
            }),
          },
          branchOrder: {
            findFirst: jest.fn().mockResolvedValue({
              branchOrderId: 'branch-order-1',
              parentOrderId: 'parent-order-1',
              brandBranchId: 'branch-1',
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new DeliveryService(
      prismaService,
      {} as StaffService,
      {} as OrderService,
      { notifyCourierAssigned } as unknown as SocketServices,
    );

    await service.assignCourier(companyActor, 'branch-order-1', 'courier-1');

    expect(notifyCourierAssigned).toHaveBeenCalledWith('courier-user-1', {
      branchOrderId: 'branch-order-1',
      parentOrderId: 'parent-order-1',
      status: orderStatus.readytoship,
    });
  });
});
