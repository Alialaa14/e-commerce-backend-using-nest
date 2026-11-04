import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchRole, orderStatus, Role } from '../generated/prisma';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { PrismaService } from '../utils/prisma/prisma.service';
import { SocketServices } from '../Socket/socket.service';

const BRANCH_TRANSITIONS: Partial<Record<orderStatus, orderStatus[]>> = {
  [orderStatus.ordering]: [orderStatus.packing],
  [orderStatus.packing]: [orderStatus.readytoship],
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly socketServices: SocketServices,
  ) {}

  async updateBranchOrderStatus(
    actor: AuthUser,
    branchOrderId: string,
    status: orderStatus,
  ) {
    if (
      actor.role !== Role.BRANCH_MANAGER &&
      actor.role !== Role.Branch_Sales
    ) {
      throw new ForbiddenException(
        'Only branch staff can update branch orders',
      );
    }

    const updatedOrder = await this.prismaService.prisma.$transaction(
      async (tx) => {
        const order = await tx.branchOrder.findFirst({
          where: { branchOrderId },
          select: {
            branchOrderId: true,
            parentOrderId: true,
            brandBranchId: true,
            brandId: true,
            status: true,
          },
        });
        if (!order) throw new NotFoundException('Branch order not found');

        if (
          !actor.branchId ||
          !actor.brandId ||
          actor.branchId !== order.brandBranchId ||
          actor.brandId !== order.brandId
        ) {
          throw new ForbiddenException('Branch order access denied');
        }

        const membership = await tx.branchStaff.findUnique({
          where: {
            branchId_userId: {
              branchId: order.brandBranchId,
              userId: actor.sub,
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
        });
        const expectedBranchRole =
          actor.role === Role.BRANCH_MANAGER
            ? BranchRole.manager
            : BranchRole.sales;
        if (
          !membership?.isActive ||
          membership.role !== expectedBranchRole ||
          !membership.branch.isActive ||
          membership.branch.deletedAt ||
          membership.branch.brandId !== order.brandId
        ) {
          throw new ForbiddenException(
            'Active branch membership is required to update orders',
          );
        }

        if (!BRANCH_TRANSITIONS[order.status]?.includes(status)) {
          throw new BadRequestException(
            `Invalid branch order transition: ${order.status} to ${status}`,
          );
        }

        const { count } = await tx.branchOrder.updateMany({
          where: {
            branchOrderId,
            brandBranchId: order.brandBranchId,
            status: order.status,
          },
          data: { status },
        });
        if (count !== 1) {
          throw new ConflictException('Branch order status has changed');
        }

        return {
          ...order,
          status,
          updatedAt: new Date(),
        };
      },
    );

    this.socketServices.notifyBranchOrderUpdated(updatedOrder.brandBranchId, {
      branchOrderId: updatedOrder.branchOrderId,
      parentOrderId: updatedOrder.parentOrderId,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt,
    });

    return updatedOrder;
  }
}
