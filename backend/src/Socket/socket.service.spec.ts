import { Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma/prisma.service';
import { RedisService } from '../Redis/redis.services';
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
    const redisService = {
      getOne: jest.fn(),
      enqueue: jest.fn(),
      remove: jest.fn(),
    } as unknown as RedisService;
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
      redisService,
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
});
