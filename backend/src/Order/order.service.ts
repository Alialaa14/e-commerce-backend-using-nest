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

const COURIER_TRANSITIONS: Partial<Record<orderStatus, orderStatus[]>> = {
  [orderStatus.readytoship]: [orderStatus.shipping],
  [orderStatus.shipping]: [orderStatus.delivering],
  [orderStatus.delivering]: [orderStatus.delivered, orderStatus.returned],
};

interface DeliveryProofInput {
  proofUrl: string;
  proofStorageId: string;
}

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
    deliveryCompanyId?: string,
    proofInput?: DeliveryProofInput,
  ) {
    const isBranchStaff =
      actor.role === Role.BRANCH_MANAGER || actor.role === Role.Branch_Sales;
    const isCourier = actor.role === Role.courier;
    if (!isBranchStaff && !isCourier) {
      throw new ForbiddenException('Actor is not allowed to update this order');
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
            deliveryCompanyId: true,
            courierId: true,
            status: true,
          },
        });
        if (!order) throw new NotFoundException('Branch order not found');

        let deliveryCompanyIdForOrder = order.deliveryCompanyId;
        if (isBranchStaff) {
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
        } else {
          const courier = await tx.courier.findFirst({
            where: {
              userId: actor.sub,
              isActive: true,
              isVerified: true,
              isBanned: false,
              deliveryCompany: {
                isVerified: true,
                isBanned: false,
              },
            },
            select: { id: true, deliveryCompanyId: true },
          });
          if (
            !courier ||
            courier.id !== order.courierId ||
            courier.deliveryCompanyId !== order.deliveryCompanyId
          ) {
            throw new ForbiddenException(
              'Only the active courier assigned to this order can update it',
            );
          }
        }

        const transitions = isBranchStaff
          ? BRANCH_TRANSITIONS
          : COURIER_TRANSITIONS;
        if (!transitions[order.status]?.includes(status)) {
          throw new BadRequestException(
            `Invalid order transition: ${order.status} to ${status}`,
          );
        }

        if (isBranchStaff && status === orderStatus.readytoship) {
          if (!deliveryCompanyId) {
            throw new BadRequestException(
              'A verified delivery company is required for handoff',
            );
          }
          const company = await tx.d_Company.findFirst({
            where: {
              deliveryCompany: deliveryCompanyId,
              isVerified: true,
              isBanned: false,
            },
            select: { deliveryCompany: true },
          });
          if (!company) {
            throw new NotFoundException('Verified delivery company not found');
          }
          deliveryCompanyIdForOrder = company.deliveryCompany;
        } else if (isBranchStaff && deliveryCompanyId) {
          throw new BadRequestException(
            'A delivery company can only be selected during handoff',
          );
        }

        let deliveryProofId: string | undefined;
        if (isCourier && status === orderStatus.delivered) {
          if (proofInput) {
            const proof = await tx.deliveryProof.create({
              data: {
                branchOrderId,
                courierId: order.courierId!,
                proofUrl: proofInput.proofUrl,
                proofStorageId: proofInput.proofStorageId,
              },
              select: { id: true },
            });
            deliveryProofId = proof.id;
          } else {
            const proof = await tx.deliveryProof.findFirst({
              where: {
                branchOrderId,
                courierId: order.courierId!,
              },
              select: { id: true },
            });
            deliveryProofId = proof?.id;
          }
          if (!deliveryProofId) {
            throw new BadRequestException(
              'Delivery proof is required before completing this order',
            );
          }
        }

        const { count } = await tx.branchOrder.updateMany({
          where: {
            branchOrderId,
            status: order.status,
            ...(isBranchStaff
              ? { brandBranchId: order.brandBranchId }
              : {
                  deliveryCompanyId: order.deliveryCompanyId,
                  courierId: order.courierId,
                }),
          },
          data: {
            status,
            ...(isBranchStaff && status === orderStatus.readytoship
              ? { deliveryCompanyId: deliveryCompanyIdForOrder }
              : {}),
          },
        });
        if (count !== 1) {
          throw new ConflictException('Order status has changed');
        }

        await tx.branchOrderStatusHistory.create({
          data: {
            branchOrderId,
            fromStatus: order.status,
            toStatus: status,
            changedByUserId: actor.sub,
            changedByRole: actor.role as Role,
            metadata:
              isBranchStaff && status === orderStatus.readytoship
                ? { deliveryCompanyId: deliveryCompanyIdForOrder }
                : deliveryProofId
                  ? { deliveryProofId }
                  : undefined,
          },
        });

        return {
          ...order,
          status,
          deliveryCompanyId: deliveryCompanyIdForOrder,
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
