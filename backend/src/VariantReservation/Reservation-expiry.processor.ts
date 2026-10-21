import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ExpiryReservationQueue } from './Reservation.constants';
import { VariantReservationService } from './Reservation.service';

interface ExpiryReservationJob {
  checkoutId: string;
  expiresAt?: string;
}

@Processor(ExpiryReservationQueue)
export class ExpiryReservationProcessor extends WorkerHost {
  constructor(
    private readonly variantReservationService: VariantReservationService,
    @Inject(ExpiryReservationQueue) private readonly expiryQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ExpiryReservationJob, number, string>) {
    if (job.name !== 'expiry-variant-reservation') {
      throw new Error(`Unsupported reservation job: ${job.name}`);
    }

    if (job.data.expiresAt) {
      const expiresAt = new Date(job.data.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error(
          'Reservation expiry job has an invalid expiration date',
        );
      }

      const delay = expiresAt.getTime() - Date.now();
      if (delay > 0) {
        await this.expiryQueue.add(job.name, job.data, {
          removeOnComplete: true,
          delay,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
        });
        return 0;
      }
    }

    return this.variantReservationService.expireReservations(
      job.data.checkoutId,
    );
  }
}
