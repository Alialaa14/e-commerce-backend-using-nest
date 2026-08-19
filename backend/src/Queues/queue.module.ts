import { Module } from '@nestjs/common';
import { ProductQueueModule } from './ProductQueues/productQueue.module';

@Module({
  imports: [ProductQueueModule],
  exports: [ProductQueueModule],
  controllers: [],
  providers: [],
})
export class QueueModule {}
