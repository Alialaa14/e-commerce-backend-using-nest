import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { orderStatus, Prisma, Role } from '../generated/prisma';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { normalizeEgyptianMobilePhone } from '../User/phone.util';
import { OrderService } from '../Order/order.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { StaffService } from '../Staff/staff.service';
import { SocketServices } from '../Socket/socket.service';
import { CreateDeliveryCompanyDto } from './dto/create-delivery-company.dto';
import { UpdateDeliveryCompanyDto } from './dto/update-delivery-company.dto';
import { UpdateCourierManagementDto } from './dto/update-courier-management.dto';
import { UpdateCourierProfileDto } from './dto/update-courier-profile.dto';
import { InviteCourierDto } from './dto/invite-courier.dto';
import { DeliveryOrdersQueryDto } from './dto/delivery-orders-query.dto';

const COMPANY_PROFILE_SELECT = {
  deliveryCompany: true,
  name: true,
  address: true,
  phoneNumber: true,
  isVerified: true,
};

const DELIVERY_ORDER_SELECT = {
  branchOrderId: true,
  status: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  etaAt: true,
  createdAt: true,
  updatedAt: true,
  courierId: true,
  order: {
    select: {
      address: true,
      phoneNumber: true,
    },
  },
  courier: {
    select: {
      id: true,
      user: {
        select: {
          username: true,
          phone: true,
        },
      },
    },
  },
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly staffService: StaffService,
    private readonly orderService: OrderService,
    private readonly socketServices: SocketServices,
  ) {}

  async createCompany(actor: AuthUser, dto: CreateDeliveryCompanyDto) {
    this.requireRole(actor, Role.admin);
    return this.prismaService.prisma.d_Company.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        phoneNumber: normalizeEgyptianMobilePhone(dto.phoneNumber),
      },
      select: COMPANY_PROFILE_SELECT,
    });
  }

  async inviteCompanyManager(
    actor: AuthUser,
    deliveryCompanyId: string,
    email: string,
  ) {
    this.requireRole(actor, Role.admin);
    return this.staffService.inviteDeliveryCompany(
      { sub: actor.sub, role: actor.role },
      deliveryCompanyId,
      email,
    );
  }

  async setCompanyVerification(
    actor: AuthUser,
    deliveryCompanyId: string,
    isVerified: boolean,
  ) {
    this.requireRole(actor, Role.admin);
    const updated = await this.prismaService.prisma.d_Company.updateMany({
      where: { deliveryCompany: deliveryCompanyId, isBanned: false },
      data: { isVerified },
    });
    if (updated.count !== 1) {
      throw new NotFoundException('Delivery company not found');
    }

    return this.prismaService.prisma.d_Company.findUniqueOrThrow({
      where: { deliveryCompany: deliveryCompanyId },
      select: COMPANY_PROFILE_SELECT,
    });
  }

  async getCompanyProfile(actor: AuthUser) {
    const company = await this.findCompanyForOwner(actor);
    return {
      deliveryCompany: company.deliveryCompany,
      name: company.name,
      address: company.address,
      phoneNumber: company.phoneNumber,
      isVerified: company.isVerified,
    };
  }

  async updateCompanyProfile(actor: AuthUser, dto: UpdateDeliveryCompanyDto) {
    const company = await this.findCompanyForOwner(actor);
    const data: Prisma.D_CompanyUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      ...(dto.phoneNumber !== undefined
        ? { phoneNumber: normalizeEgyptianMobilePhone(dto.phoneNumber) }
        : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one company field is required');
    }

    return this.prismaService.prisma.d_Company.update({
      where: { deliveryCompany: company.deliveryCompany },
      data,
      select: COMPANY_PROFILE_SELECT,
    });
  }

  async listCouriers(actor: AuthUser) {
    const company = await this.findCompanyForOwner(actor);
    return this.prismaService.prisma.courier.findMany({
      where: { deliveryCompanyId: company.deliveryCompany },
      orderBy: [{ isActive: 'desc' }, { isVerified: 'desc' }],
      select: {
        id: true,
        photo_url: true,
        phoneNumber: true,
        documents: true,
        plateNumber: true,
        isVerified: true,
        isBanned: true,
        isActive: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isVerified: true,
          },
        },
      },
    });
  }

  async inviteCourier(
    actor: AuthUser,
    dto: InviteCourierDto,
    photo: {
      url: string;
      id: string;
    },
  ) {
    this.requireRole(actor, Role.deliveryC);
    return this.staffService.inviteCourier(
      { sub: actor.sub, role: actor.role },
      {
        ...dto,
        photo_url: photo.url,
        photo_id: photo.id,
      },
    );
  }

  async updateCourierManagement(
    actor: AuthUser,
    courierId: string,
    dto: UpdateCourierManagementDto,
  ) {
    const company = await this.findCompanyForOwner(actor);
    const data: Prisma.CourierUpdateManyMutationInput = {
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}),
      ...(dto.plateNumber !== undefined
        ? { plateNumber: dto.plateNumber.trim() }
        : {}),
      ...(dto.documents !== undefined ? { documents: dto.documents } : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one courier field is required');
    }

    const updated = await this.prismaService.prisma.courier.updateMany({
      where: {
        id: courierId,
        deliveryCompanyId: company.deliveryCompany,
        isBanned: false,
      },
      data,
    });
    if (updated.count !== 1) {
      throw new NotFoundException('Courier not found for this company');
    }

    return this.prismaService.prisma.courier.findFirstOrThrow({
      where: { id: courierId, deliveryCompanyId: company.deliveryCompany },
      select: {
        id: true,
        userId: true,
        photo_url: true,
        phoneNumber: true,
        documents: true,
        plateNumber: true,
        isVerified: true,
        isBanned: true,
        isActive: true,
      },
    });
  }

  async listCompanyOrders(actor: AuthUser, query: DeliveryOrdersQueryDto) {
    const company = await this.findCompanyForOwner(actor);
    const where: Prisma.BranchOrderWhereInput = {
      deliveryCompanyId: company.deliveryCompany,
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.prismaService.prisma.$transaction([
      this.prismaService.prisma.branchOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: DELIVERY_ORDER_SELECT,
      }),
      this.prismaService.prisma.branchOrder.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async assignCourier(
    actor: AuthUser,
    branchOrderId: string,
    courierId: string,
  ) {
    const company = await this.findCompanyForOwner(actor);
    if (!company.isVerified) {
      throw new ForbiddenException(
        'Delivery-company verification is required to assign orders',
      );
    }

    const result = await this.prismaService.prisma.$transaction(async (tx) => {
      const courier = await tx.courier.findFirst({
        where: {
          id: courierId,
          deliveryCompanyId: company.deliveryCompany,
          isActive: true,
          isVerified: true,
          isBanned: false,
          userId: { not: null },
        },
        select: { id: true, userId: true },
      });
      if (!courier?.userId) {
        throw new NotFoundException(
          'Active verified courier with an account not found for this company',
        );
      }

      const order = await tx.branchOrder.findFirst({
        where: {
          branchOrderId,
          deliveryCompanyId: company.deliveryCompany,
          status: orderStatus.readytoship,
          courierId: null,
        },
        select: {
          branchOrderId: true,
          parentOrderId: true,
          brandBranchId: true,
        },
      });
      if (!order) {
        throw new NotFoundException(
          'Unassigned ready order not found for this company',
        );
      }

      const updated = await tx.branchOrder.updateMany({
        where: {
          branchOrderId,
          deliveryCompanyId: company.deliveryCompany,
          status: orderStatus.readytoship,
          courierId: null,
        },
        data: { courierId: courier.id },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'The order was assigned by another dispatcher',
        );
      }

      return {
        ...order,
        courierId: courier.id,
        courierUserId: courier.userId,
        status: orderStatus.readytoship,
      };
    });

    this.socketServices.notifyCourierAssigned(result.courierUserId, {
      branchOrderId: result.branchOrderId,
      parentOrderId: result.parentOrderId,
      status: result.status,
    });

    return {
      branchOrderId: result.branchOrderId,
      parentOrderId: result.parentOrderId,
      brandBranchId: result.brandBranchId,
      courierId: result.courierId,
      status: result.status,
    };
  }

  async getCourierProfile(actor: AuthUser) {
    this.requireRole(actor, Role.courier);
    const courier = await this.prismaService.prisma.courier.findFirst({
      where: { userId: actor.sub },
      select: {
        id: true,
        photo_url: true,
        phoneNumber: true,
        documents: true,
        plateNumber: true,
        isVerified: true,
        isActive: true,
        deliveryCompany: { select: { name: true } },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            picture_url: true,
          },
        },
      },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    return courier;
  }

  async updateCourierProfile(
    actor: AuthUser,
    dto: UpdateCourierProfileDto,
    photo?: { url: string; id: string },
  ) {
    this.requireRole(actor, Role.courier);
    const courier = await this.prismaService.prisma.courier.findFirst({
      where: { userId: actor.sub, isBanned: false },
      select: { id: true },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    const username = dto.username?.trim();
    const phoneNumber = dto.phoneNumber
      ? normalizeEgyptianMobilePhone(dto.phoneNumber)
      : undefined;
    if (!username && !phoneNumber && !photo) {
      throw new BadRequestException('At least one profile field is required');
    }

    await this.prismaService.prisma.$transaction(async (tx) => {
      if (username || phoneNumber || photo) {
        await tx.user.update({
          where: { id: actor.sub },
          data: {
            ...(username ? { username } : {}),
            ...(phoneNumber ? { phone: phoneNumber } : {}),
            ...(photo
              ? {
                  picture_url: photo.url,
                  picture_url_id: photo.id,
                }
              : {}),
          },
        });
      }
      await tx.courier.update({
        where: { id: courier.id },
        data: {
          ...(phoneNumber ? { phoneNumber } : {}),
          ...(photo ? { photo_url: photo.url, photo_id: photo.id } : {}),
        },
      });
    });

    return this.getCourierProfile(actor);
  }

  async listCourierOrders(actor: AuthUser, query: DeliveryOrdersQueryDto) {
    this.requireRole(actor, Role.courier);
    const courier = await this.prismaService.prisma.courier.findFirst({
      where: {
        userId: actor.sub,
        isActive: true,
        isBanned: false,
      },
      select: { id: true },
    });
    if (!courier) {
      throw new NotFoundException('Active courier profile not found');
    }

    const where: Prisma.BranchOrderWhereInput = {
      courierId: courier.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.prismaService.prisma.$transaction([
      this.prismaService.prisma.branchOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: DELIVERY_ORDER_SELECT,
      }),
      this.prismaService.prisma.branchOrder.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateCourierOrderStatus(
    actor: AuthUser,
    branchOrderId: string,
    status: orderStatus,
  ) {
    return this.orderService.updateBranchOrderStatus(
      actor,
      branchOrderId,
      status,
    );
  }

  async completeCourierOrder(
    actor: AuthUser,
    branchOrderId: string,
    proof: { url: string; id: string },
  ) {
    this.requireRole(actor, Role.courier);
    return this.orderService.updateBranchOrderStatus(
      actor,
      branchOrderId,
      orderStatus.delivered,
      undefined,
      { proofUrl: proof.url, proofStorageId: proof.id },
    );
  }

  private async findCompanyForOwner(actor: AuthUser) {
    this.requireRole(actor, Role.deliveryC);
    const company = await this.prismaService.prisma.d_Company.findFirst({
      where: { ownerUserId: actor.sub, isBanned: false },
      select: COMPANY_PROFILE_SELECT,
    });
    if (!company) {
      throw new ForbiddenException('Delivery-company access denied');
    }
    return company;
  }

  private requireRole(actor: AuthUser, role: Role) {
    if (actor.role !== role) {
      throw new ForbiddenException(
        'Role is not allowed to perform this action',
      );
    }
  }
}
