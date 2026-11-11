import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { ReservationStatus } from '../generated/prisma';
import { Prisma } from '../generated/prisma';
type ReservationRecord = {
  inventoryId: string;
  variantId: string;
  qty: number;
  checkoutId: string;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt?: Date;
};

type ReservationFilter = {
  status?: ReservationStatus;
  expiresAt?: { lte: Date };
};

@Injectable()
export class VariantReservationModel {
  constructor(private readonly prismaService: PrismaService) {}

  async createReservations(
    payload: ReservationRecord[],
    transaction: Prisma.TransactionClient,
  ) {
    return (
      transaction ?? this.prismaService.prisma
    ).reservation.createManyAndReturn({
      data: payload,
    });
  }

  async updateReservationStatus(
    id: string,
    expectedStatus: ReservationStatus,
    status: ReservationStatus,
    transaction: Prisma.TransactionClient,
    expiresAt?: Date,
  ) {
    return (transaction ?? this.prismaService.prisma).reservation.updateMany({
      where: {
        id,
        status: expectedStatus,
        ...(expiresAt ? { expiresAt: { lte: expiresAt } } : {}),
      },
      data: { status },
    });
  }

  async getReservations(
    checkoutId: string,
    transaction?: Prisma.TransactionClient,
    filter: ReservationFilter = {},
  ) {
    return (transaction ?? this.prismaService.prisma).reservation.findMany({
      where: { checkoutId, ...filter },
    });
  }
}
