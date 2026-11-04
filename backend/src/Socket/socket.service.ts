import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../utils/Token/token.service';
import { socketAuth } from './middlewares/auth-middleware';
import { UserService } from '../User/user.service';
import { BranchRole, Role } from '../generated/prisma';
import { PrismaService } from '../utils/prisma/prisma.service';

interface SocketData {
  user?: { sub?: string };
}

function socketData(client: Socket): SocketData {
  return client.data as SocketData;
}

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
@Injectable()
export class SocketServices implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(SocketServices.name);
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly prismaService: PrismaService,
  ) {}

  private async IdenifyingSocketUser(userId: string): Promise<{
    userId: string;
    role: Role;
    brandId?: string;
    branchId?: string;
  }> {
    const user = await this.userService.getCurrentUser(userId);
    if (user.role === Role.BRANCH_MANAGER || user.role === Role.Branch_Sales) {
      if (!user.brandId || !user.branchId) {
        throw new ForbiddenException('Branch staff scope is missing');
      }

      const membership = await this.prismaService.prisma.branchStaff.findUnique(
        {
          where: {
            branchId_userId: {
              branchId: user.branchId,
              userId,
            },
          },
          select: {
            isActive: true,
            role: true,
            branch: {
              select: {
                brandId: true,
                isActive: true,
                deletedAt: true,
              },
            },
          },
        },
      );

      const expectedRole =
        user.role === Role.BRANCH_MANAGER
          ? BranchRole.manager
          : BranchRole.sales;
      if (
        !membership?.isActive ||
        membership.role !== expectedRole ||
        !membership.branch.isActive ||
        membership.branch.deletedAt ||
        membership.branch.brandId !== user.brandId
      ) {
        throw new ForbiddenException('Active branch staff membership required');
      }
    }

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
      await client.join(`user:${userPayload.userId}`);
    }

    if (userPayload.role === 'BRANCH_MANAGER') {
      await client.join(`branch:${userPayload.branchId}`);
    }

    if (userPayload.role === 'Branch_Sales') {
      await client.join(`branch:${userPayload.branchId}`);
    }

    if (userPayload.role === 'brandOwner') {
      const brand = await this.prismaService.prisma.brand.findFirst({
        where: { userId: userId, isActive: true },
        select: { id: true },
      });
      if (!brand) {
        throw new ForbiddenException('Active brand owner profile required');
      }
      await client.join(`brand:${brand.id}`);
    }
  }

  afterInit(server: Server) {
    server.use(socketAuth(this.tokenService));
  }

  async handleConnection(client: Socket) {
    try {
      const userId = socketData(client).user?.sub;
      if (!userId) {
        throw new ForbiddenException('Socket authentication required');
      }
      await this.joiningRooms(client, userId);
      console.log(`Client connected: ${client.id}`);
    } catch (err) {
      this.logger.error(`Connection setup failed (${client.id})`, err as Error);
      client.disconnect(true);
    }
  }

  notifyOrderCreated(
    brandId: string,
    order: {
      parentOrderId: string;
      address: string;
      phoneNumber: string;
      branchOrders: {
        branchOrderId: string;
        brandBranchId: string;
        status: string;
        total: number;
        orderItems: unknown[];
      }[];
    },
  ) {
    const notification = {
      brandId,
      parentOrderId: order.parentOrderId,
      address: order.address,
      phoneNumber: order.phoneNumber,
      branchOrders: order.branchOrders,
    };
    this.server.to(`brand:${brandId}`).emit('order:created', notification);

    for (const branchOrder of order.branchOrders) {
      this.server
        .to(`branch:${branchOrder.brandBranchId}`)
        .emit('order:created', {
          ...notification,
          branchOrders: [branchOrder],
        });
    }
  }

  notifyBranchOrderUpdated(branchId: string, branchOrder: object) {
    this.server.to(`branch:${branchId}`).emit('order:updated', branchOrder);
  }

  notifyCheckoutPaymentUpdated(
    userId: string,
    payment: {
      checkoutId: string;
      status: string;
      paymentStatus: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('checkout:payment_updated', payment);
  }
}
