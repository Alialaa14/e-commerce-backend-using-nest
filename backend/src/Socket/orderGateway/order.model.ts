import { Injectable } from '@nestjs/common';
import { Prisma, orderStatus } from '../../generated/prisma';
import { PrismaService } from '../../utils/prisma/prisma.service';

interface OrderPagination {
  skip: number;
  take: number;
}

const BRANCH_ORDER_LIST_SELECT = {
  branchOrderId: true,
  parentOrderId: true,
  brandId: true,
  brandBranchId: true,
  status: true,
  subtotal: true,
  deliveryFee: true,
  discountShare: true,
  total: true,
  etaAt: true,
  createdAt: true,
  updatedAt: true,
  orderItems: {
    select: {
      id: true,
      nameSnapshot: true,
      skuSnapshot: true,
      priceSnapshot: true,
      quantity: true,
    },
  },
  order: {
    select: {
      status: true,
      createdAt: true,
      totalPrice: true,
    },
  },
} satisfies Prisma.BranchOrderSelect;

const BRANCH_ORDER_DETAIL_SELECT = {
  ...BRANCH_ORDER_LIST_SELECT,
  deliveryCompanyId: true,
  courierId: true,
  order: {
    select: {
      userId: true,
      status: true,
      createdAt: true,
      price: true,
      deliveryPrice: true,
      totalPrice: true,
      address: true,
      phoneNumber: true,
    },
  },
} satisfies Prisma.BranchOrderSelect;

@Injectable()
export class OrderModel {
  constructor(private readonly prismaService: PrismaService) {}

  async findBranchOrdersForBrand(
    brandId: string,
    pagination: OrderPagination,
    status?: orderStatus,
  ) {
    return this.prismaService.prisma.branchOrder.findMany({
      where: {
        brandId,
        ...(status ? { status } : {}),
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      select: BRANCH_ORDER_LIST_SELECT,
    });
  }

  async findBranchOrdersForBranch(
    branchId: string,
    pagination: OrderPagination,
    status?: orderStatus,
  ) {
    return this.prismaService.prisma.branchOrder.findMany({
      where: {
        brandBranchId: branchId,
        ...(status ? { status } : {}),
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      select: BRANCH_ORDER_LIST_SELECT,
    });
  }

  async findBranchOrderForBrand(branchOrderId: string, brandId: string) {
    return this.prismaService.prisma.branchOrder.findFirst({
      where: { branchOrderId, brandId },
      select: BRANCH_ORDER_DETAIL_SELECT,
    });
  }

  async findBranchOrderForBranch(branchOrderId: string, branchId: string) {
    return this.prismaService.prisma.branchOrder.findFirst({
      where: { branchOrderId, brandBranchId: branchId },
      select: BRANCH_ORDER_DETAIL_SELECT,
    });
  }

  async updateBranchOrderStatus(
    branchOrderId: string,
    expectedStatus: orderStatus,
    status: orderStatus,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.prismaService.prisma).branchOrder.update({
      where: { branchOrderId, status: expectedStatus },
      data: { status },
      select: BRANCH_ORDER_DETAIL_SELECT,
    });
  }
}