import { Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma/prisma.service';
import { TokenService } from '../utils/Token/token.service';
import { UserService } from '../User/user.service';
import { SocketServices } from './socket.service';

jest.mock('../User/user.service', () => ({
  UserService: class UserService {},
}));

describe('SocketServices branch authorization', () => {
  it('disconnects branch staff without active branch membership', async () => {
    const userService = {
      getCurrentUser: jest.fn().mockResolvedValue({
        id: 'manager-1',
        role: 'BRANCH_MANAGER',
        brandId: 'brand-1',
        branchId: 'branch-1',
      }),
    } as unknown as UserService;
    const tokenService = {} as TokenService;
    const prismaService = {
      prisma: {
        branchStaff: {
          findUnique: jest.fn().mockResolvedValue({
            isActive: false,
            role: 'manager',
            branch: {
              brandId: 'brand-1',
              isActive: true,
              deletedAt: null,
            },
          }),
        },
      },
    } as unknown as PrismaService;
    const service = new SocketServices(
      tokenService,
      userService,
      prismaService,
    );
    const disconnect = jest.fn();
    const join = jest.fn();
    const client = {
      id: 'socket-1',
      data: { user: { sub: 'manager-1' } },
      disconnect,
      join,
    } as unknown as Socket;

    await service.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(join).not.toHaveBeenCalled();
  });

  it('joins active branch staff to a branch-scoped room rather than a role-wide room', async () => {
    const userService = {
      getCurrentUser: jest.fn().mockResolvedValue({
        id: 'manager-1',
        role: 'BRANCH_MANAGER',
        brandId: 'brand-1',
        branchId: 'branch-1',
      }),
    } as unknown as UserService;
    const prismaService = {
      prisma: {
        branchStaff: {
          findUnique: jest.fn().mockResolvedValue({
            isActive: true,
            role: 'manager',
            branch: {
              brandId: 'brand-1',
              isActive: true,
              deletedAt: null,
            },
          }),
        },
      },
    } as unknown as PrismaService;
    const service = new SocketServices(
      {} as TokenService,
      userService,
      prismaService,
    );
    const join = jest.fn();
    const client = {
      id: 'socket-1',
      data: { user: { sub: 'manager-1' } },
      disconnect: jest.fn(),
      join,
    } as unknown as Socket;

    await service.handleConnection(client);

    expect(join).toHaveBeenCalledWith('branch:branch-1');
    expect(join).not.toHaveBeenCalledWith('branch-managers');
  });
});

describe('SocketServices order notifications', () => {
  it('sends new orders to the brand owner and the matching branch rooms', () => {
    const service = new SocketServices(
      {} as TokenService,
      {} as UserService,
      {} as PrismaService,
    );
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    Object.assign(service, { server: { to } });

    service.notifyOrderCreated('brand-1', {
      parentOrderId: 'order-1',
      address: 'Test address',
      phoneNumber: '+201000000000',
      branchOrders: [
        {
          branchOrderId: 'branch-order-1',
          brandBranchId: 'branch-1',
          status: 'ordering',
          total: 50,
          orderItems: [],
        },
        {
          branchOrderId: 'branch-order-2',
          brandBranchId: 'branch-2',
          status: 'ordering',
          total: 50,
          orderItems: [],
        },
      ],
    });

    expect(to).toHaveBeenCalledWith('brand:brand-1');
    expect(to).toHaveBeenCalledWith('branch:branch-1');
    expect(to).toHaveBeenCalledWith('branch:branch-2');
    expect(emit).toHaveBeenCalledWith(
      'order:created',
      expect.objectContaining({
        branchOrders: expect.arrayContaining([
          expect.objectContaining({ branchOrderId: 'branch-order-1' }),
        ]),
      }),
    );
  });

  it('sends branch order updates only to that branch room', () => {
    const service = new SocketServices(
      {} as TokenService,
      {} as UserService,
      {} as PrismaService,
    );
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    Object.assign(service, { server: { to } });

    service.notifyBranchOrderUpdated('branch-1', {
      branchOrderId: 'branch-order-1',
      status: 'packing',
    });

    expect(to).toHaveBeenCalledWith('branch:branch-1');
    expect(emit).toHaveBeenCalledWith(
      'order:updated',
      expect.objectContaining({ status: 'packing' }),
    );
  });
});
