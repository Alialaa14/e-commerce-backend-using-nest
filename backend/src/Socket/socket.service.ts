import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../utils/Token/token.service';
import { socketAuth } from './middlewares/auth-middleware';
import { UserService } from '../User/user.service';
import { Role } from '../generated/prisma';
import { RedisService } from '../Redis/redis.services';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
@Injectable()
export class SocketServices
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketServices.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {}

  private async IdenifyingSocketUser(userId: string): Promise<{
    userId: string;
    role: Role;
    brandId?: string;
    branchId?: string;
  }> {
    const user = await this.userService.getCurrentUser(userId);
    return {
      userId,
      role: user.role,
      ...(user.brandId && { brandId: user.brandId }),
      ...(user.branchId && { branchId: user.branchId }),
    };
  }

  private async joiningRooms(client: Socket, userId: string): Promise<void> {
    const userPayload = await this.IdenifyingSocketUser(userId);

    if (userPayload.role === 'user') {
      const isFoundUser = await this.redisService.getOne(
        'users',
        userPayload.userId,
      );
      if (isFoundUser == null) {
        const data = {
          userId: userPayload.userId,
          socketId: client.id,
        };
        await this.redisService.enqueue('users', data);
        client.data.queueEntry = { queueName: 'users', data };
      }
      await client.join('users');
    }

    if (userPayload.role === 'BRANCH_MANAGER') {
      const isFoundUser = await this.redisService.getOne(
        'branch-managers',
        userPayload.branchId!,
      );
      if (isFoundUser == null) {
        const data = {
          userId: userPayload.userId,
          socketId: client.id,
          branchId: userPayload.branchId,
          brandId: userPayload.brandId,
        };
        await this.redisService.enqueue('branch-managers', data);
        client.data.queueEntry = { queueName: 'branch-managers', data };
      }
      await client.join('branch-managers');
    }

    if (userPayload.role === 'Branch_Sales') {
      const isFoundUser = await this.redisService.getOne(
        'branch-sales',
        userPayload.branchId!,
      );
      if (isFoundUser == null) {
        const data = {
          userId: userPayload.userId,
          socketId: client.id,
          branchId: userPayload.branchId,
          brandId: userPayload.brandId,
        };
        await this.redisService.enqueue('branch-sales', data);
        client.data.queueEntry = { queueName: 'branch-sales', data };
      }
      await client.join('branch-sales');
    }

    if (userPayload.role === 'brandOwner') {
      const isFoundUser = await this.redisService.getOne(
        'brand-owners',
        userPayload.brandId!,
      );
      if (isFoundUser == null) {
        const data = {
          userId: userPayload.userId,
          socketId: client.id,
          brandId: userPayload.brandId,
        };
        await this.redisService.enqueue('brand-owners', data);
        client.data.queueEntry = { queueName: 'brand-owners', data };
      }
      await client.join('brand-owners');
    }
  }

  afterInit(server: Server) {
    server.use(socketAuth(this.tokenService));
  }

  async handleConnection(client: Socket) {
    try {
      const userId: string = client.data.user.sub;
      await this.joiningRooms(client, userId);
    } catch (err) {
      this.logger.error(`Connection setup failed (${client.id})`, err as Error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const entry = client.data.queueEntry as
      { queueName: string; data: unknown } | undefined;
    if (!entry) return;

    try {
      await this.redisService.remove(entry.queueName, entry.data);
    } catch (err) {
      this.logger.error(`Queue cleanup failed (${client.id})`, err as Error);
    }
  }
}
