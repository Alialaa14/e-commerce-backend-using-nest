import { Prisma } from '../generated/prisma';
import { InventoryService } from '../Inventory/inventory.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { VariantReservationModel } from './Reservation.model';
import { VariantReservationService } from './Reservation.service';

describe('VariantReservationService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const reservation = {
    id: 'reservation-1',
    inventoryId: 'inventory-1',
    variantId: 'variant-1',
    qty: 2,
    checkoutId: 'checkout-1',
    status: 'active' as const,
    expiresAt: new Date('2026-10-20T00:00:00.000Z'),
  };

  const createService = (overrides?: {
    reservations?: (typeof reservation)[];
    updateCount?: number;
  }) => {
    const transaction = {} as Prisma.TransactionClient;
    const getReservations = jest
      .fn()
      .mockResolvedValue(overrides?.reservations ?? [reservation]);
    const createReservations = jest.fn().mockResolvedValue([reservation]);
    const updateReservationStatus = jest
      .fn()
      .mockResolvedValue({ count: overrides?.updateCount ?? 1 });
    const variantReservationModel = {
      getReservations,
      createReservations,
      updateReservationStatus,
    };
    const reserveStock = jest.fn().mockResolvedValue(undefined);
    const releaseStock = jest.fn().mockResolvedValue(undefined);
    const fulfillReservedStock = jest.fn().mockResolvedValue(undefined);
    const inventoryService = {
      reserveStock,
      releaseStock,
      fulfillReservedStock,
    };
    const $transaction = jest.fn(
      (callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback(transaction),
    );
    const prismaService = { prisma: { $transaction } };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new VariantReservationService(
      variantReservationModel as unknown as VariantReservationModel,
      inventoryService as unknown as InventoryService,
      prismaService as unknown as PrismaService,
      queue as never,
    );

    return {
      service,
      transaction,
      createReservations,
      getReservations,
      updateReservationStatus,
      reserveStock,
      releaseStock,
      fulfillReservedStock,
      queue,
      $transaction,
    };
  };

  it('creates an active reservation, reserves stock, and schedules expiration', async () => {
    const now = new Date('2026-10-21T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const { service, transaction, createReservations, reserveStock, queue } =
      createService();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await expect(
      service.reserveVariants([
        {
          inventoryId: reservation.inventoryId,
          variantId: reservation.variantId,
          qty: reservation.qty,
          checkoutId: reservation.checkoutId,
          status: 'active',
        },
      ]),
    ).resolves.toEqual([reservation]);

    expect(createReservations).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          inventoryId: reservation.inventoryId,
          variantId: reservation.variantId,
          qty: reservation.qty,
          checkoutId: reservation.checkoutId,
          status: 'active',
          expiresAt,
        }),
      ],
      transaction,
    );
    expect(reserveStock).toHaveBeenCalledWith(
      reservation.inventoryId,
      reservation.variantId,
      reservation.qty,
      reservation.checkoutId,
      transaction,
    );
    expect(queue.add).toHaveBeenCalledWith(
      'expiry-variant-reservation',
      {
        checkoutId: reservation.checkoutId,
        expiresAt: expiresAt.toISOString(),
      },
      {
        removeOnComplete: true,
        delay: 15 * 60 * 1000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  });

  it('rejects reservation creation with a non-active status before opening a transaction', async () => {
    const { service, $transaction } = createService();

    await expect(
      service.reserveVariants([
        {
          inventoryId: reservation.inventoryId,
          variantId: reservation.variantId,
          qty: reservation.qty,
          checkoutId: reservation.checkoutId,
          status: 'expired',
        },
      ]),
    ).rejects.toThrow('New reservations must be active');

    expect($transaction).not.toHaveBeenCalled();
  });

  it('expires only due active reservations and releases their stock in the same transaction', async () => {
    const {
      service,
      transaction,
      getReservations,
      updateReservationStatus,
      releaseStock,
      $transaction,
    } = createService();
    const now = new Date('2026-10-21T00:00:00.000Z');

    await expect(service.expireReservations('checkout-1', now)).resolves.toBe(
      1,
    );

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(getReservations).toHaveBeenCalledWith(
      'checkout-1',
      transaction,
      expect.objectContaining({
        status: 'active',
        expiresAt: { lte: now },
      }),
    );
    expect(updateReservationStatus).toHaveBeenCalledWith(
      reservation.id,
      'active',
      'expired',
      transaction,
      now,
    );
    expect(releaseStock).toHaveBeenCalledWith(
      reservation.inventoryId,
      reservation.variantId,
      reservation.qty,
      reservation.checkoutId,
      transaction,
    );
  });

  it('marks active reservations released and releases stock atomically', async () => {
    const { service, transaction, updateReservationStatus, releaseStock } =
      createService();

    await expect(service.releaseReservations('checkout-1')).resolves.toBe(1);

    expect(updateReservationStatus).toHaveBeenCalledWith(
      reservation.id,
      'active',
      'released',
      transaction,
    );
    expect(releaseStock).toHaveBeenCalledWith(
      reservation.inventoryId,
      reservation.variantId,
      reservation.qty,
      reservation.checkoutId,
      transaction,
    );
  });

  it('does not release stock when another transition already claimed a reservation', async () => {
    const { service, releaseStock } = createService({ updateCount: 0 });

    await expect(service.releaseReservations('checkout-1')).resolves.toBe(0);

    expect(releaseStock).not.toHaveBeenCalled();
  });

  it('converts active reservations to fulfilled stock using the order reference', async () => {
    const { service, transaction, fulfillReservedStock, releaseStock } =
      createService();

    await expect(
      service.convertReservations('checkout-1', 'order-1'),
    ).resolves.toBe(1);

    expect(fulfillReservedStock).toHaveBeenCalledWith(
      reservation.inventoryId,
      reservation.variantId,
      reservation.qty,
      'order-1',
      transaction,
    );
    expect(releaseStock).not.toHaveBeenCalled();
  });
});
