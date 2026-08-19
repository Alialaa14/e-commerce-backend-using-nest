import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ProductQueueService {
  constructor(@InjectQueue('product') private readonly productQueue: Queue) {}

  async addToQueue(data: string) {
    console.log(data);
    return this.productQueue.add('bulkImport', data, {
      removeOnComplete: true,
    });
  }

  async getJobStatus(jobId: string) {
    return this.productQueue.getJob(jobId);
  }

  async removeJob(jobId: string) {
    return this.productQueue.remove(jobId);
  }

  async removeAllJobs() {
    return this.productQueue.drain();
  }
}
