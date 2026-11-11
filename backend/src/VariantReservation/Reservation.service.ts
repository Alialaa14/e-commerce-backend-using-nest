import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { VariantReservationModel } from './Reservation.model';
import { InventoryService } from '../Inventory/inventory.service';
import { ReservationStatus } from '../generated/prisma';
import { PrismaService } from '../utils/prisma/prisma.service';
import { Queue } from 'bullmq';
import { ExpiryReservationQueue } from './Reservation.constants';
export type VariantReservationInput = {
  inventoryId: string;
  variantId: string;
  qty: number;
  status: ReservationStatus;
  checkoutId: string;
};

type VariantReservationItem = {
  inventoryId: string;
  variantId: string;
  qty: number;
  status: ReservationStatus;
  checkoutId: string;
};

const ttl = 15 * 60 * 1000;

@Injectable()
export class VariantReservationService {
  constructor(
    private readonly variantReservationModel: VariantReservationModel,
    private readonly inventoryService: InventoryService,
    private readonly prismaService: PrismaService,
    @Inject(ExpiryReservationQueue) private readonly expiryVariantQueue: Queue,
  ) {}

  // the lock is on (inventoryId, variantId), so this pair is a row's identity
  private keyOf = (i: { inventoryId: string; variantId: string }) =>
    `${i.inventoryId}:${i.variantId}`;

  private mergeAndSort(
    items: VariantReservationItem[],
  ): VariantReservationItem[] {
    if (!items.length) {
      throw new BadRequestException('Reservation items cannot be empty');
    }

    const checkoutId = items[0].checkoutId;
    const map = new Map<string, VariantReservationItem>();

    for (const item of items) {
      if (item.checkoutId !== checkoutId) {
        throw new BadRequestException(
          'All reservation items must belong to the same checkout',
        );
      }
      if (item.status !== 'active') {
        throw new BadRequestException('New reservations must be active');
      }
      if (!Number.isSafeInteger(item.qty) || item.qty <= 0) {
        throw new BadRequestException('Quantity must be a positive integer');
      }

      const key = this.keyOf(item);
      const prev = map.get(key);
      const qty = (prev?.qty ?? 0) + item.qty;
      if (!Number.isSafeInteger(qty)) {
        throw new BadRequestException('Combined quantity is too large');
      }

      // merge: same inventory + same variant → add the quantities
      map.set(key, { ...(prev ?? item), qty });
    }

    // sort: one global lock order for every checkout (prevents deadlocks)
    return [...map.values()].sort((a, b) => {
      const ka = this.keyOf(a);
      const kb = this.keyOf(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
  async reserveVariants(payload: VariantReservationInput[]) {
    const expiresAt = new Date(Date.now() + ttl);
    const prepared = this.mergeAndSort(payload).map((item) => ({
      ...item,
      expiresAt,
    }));
    return this.prismaService.prisma.$transaction(async (tx) => {
      const reservations =
        await this.variantReservationModel.createReservations(prepared, tx);
      for (const item of prepared) {
        await this.inventoryService.reserveStock(
          item.inventoryId,
          item.variantId,
          item.qty,
          item.checkoutId,
          tx,
        );
      }

      for (const checkoutId of new Set(
        prepared.map((item) => item.checkoutId),
      )) {
        await this.expiryVariantQueue.add(
          'expiry-variant-reservation',
          { checkoutId, expiresAt: expiresAt.toISOString() },
          {
            removeOnComplete: true,
            delay: ttl,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
          },
        );
      }

      return reservations;
    });
  }

  async getReservations(checkoutId: string) {
    return this.variantReservationModel.getReservations(checkoutId);
  }

  async releaseReservations(checkoutId: string) {
    return this.transitionReservations(checkoutId, 'released');
  }

  async expireReservations(checkoutId: string, now = new Date()) {
    return this.transitionReservations(checkoutId, 'expired', now);
  }

  async convertReservations(checkoutId: string, orderId: string) {
    if (!orderId) {
      throw new BadRequestException(
        'An order ID is required to convert reservations',
      );
    }
    return this.transitionReservations(
      checkoutId,
      'converted',
      undefined,
      orderId,
    );
  }

  private async transitionReservations(
    checkoutId: string,
    status: 'released' | 'expired' | 'converted',
    expiresAt?: Date,
    orderId?: string,
  ) {
    return this.prismaService.prisma.$transaction(async (transaction) => {
      const reservations = await this.variantReservationModel.getReservations(
        checkoutId,
        transaction,
        {
          status: 'active',
          ...(expiresAt ? { expiresAt: { lte: expiresAt } } : {}),
        },
      );

      let transitioned = 0;
      for (const reservation of reservations) {
        const result = expiresAt
          ? await this.variantReservationModel.updateReservationStatus(
              reservation.id,
              'active',
              status,
              transaction,
              expiresAt,
            )
          : await this.variantReservationModel.updateReservationStatus(
              reservation.id,
              'active',
              status,
              transaction,
            );
        if (result.count !== 1) {
          continue;
        }

        if (status === 'converted') {
          if (!orderId) {
            throw new BadRequestException(
              'An order ID is required to convert reservations',
            );
          }
          await this.inventoryService.fulfillReservedStock(
            reservation.inventoryId,
            reservation.variantId,
            reservation.qty,
            orderId,
            transaction,
          );
        } else {
          await this.inventoryService.releaseStock(
            reservation.inventoryId,
            reservation.variantId,
            reservation.qty,
            checkoutId,
            transaction,
          );
        }
        transitioned++;
      }

      return transitioned;
    });
  }
}
