import { Job, Queue } from 'bullmq';
import { VariantReservationService } from './Reservation.service';
import { ExpiryReservationProcessor } from './Reservation-expiry.processor';

describe('ExpiryReservationProcessor', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reschedules a job that runs before the reservation expires', async () => {
    const now = new Date('2026-10-21T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const expiresAt = new Date(now.getTime() + 30_000);
    const expireReservations = jest.fn();
    const add = jest.fn().mockResolvedValue(undefined);
    const service = {
      expireReservations,
    } as unknown as VariantReservationService;
    const queue = { add } as unknown as Queue;
    const processor = new ExpiryReservationProcessor(service, queue);
    const job = {
      name: 'expiry-variant-reservation',
      data: {
        checkoutId: 'checkout-1',
        expiresAt: expiresAt.toISOString(),
      },
    } as Job<{ checkoutId: string; expiresAt: string }, number, string>;

    await processor.process(job);

    expect(expireReservations).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(
      'expiry-variant-reservation',
      job.data,
      expect.objectContaining({ delay: 30_000 }),
    );
  });

  it('expires reservations when their delayed job is due', async () => {
    const now = new Date('2026-10-21T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const expireReservations = jest.fn().mockResolvedValue(1);
    const add = jest.fn();
    const processor = new ExpiryReservationProcessor(
      { expireReservations } as unknown as VariantReservationService,
      { add } as unknown as Queue,
    );
    const job = {
      name: 'expiry-variant-reservation',
      data: {
        checkoutId: 'checkout-1',
        expiresAt: now.toISOString(),
      },
    } as Job<{ checkoutId: string; expiresAt: string }, number, string>;

    await expect(processor.process(job)).resolves.toBe(1);

    expect(expireReservations).toHaveBeenCalledWith('checkout-1');
    expect(add).not.toHaveBeenCalled();
  });
});
