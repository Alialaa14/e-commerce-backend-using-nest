import { Module } from '@nestjs/common';
import { ProductQueueService } from './product.queue.service';
import { BullModule } from '@nestjs/bullmq';
import { ProductProcessor } from './product.processor';

@Module({
  controllers: [],
  providers: [ProductQueueService, ProductProcessor],
  exports: [ProductQueueService],
  imports: [BullModule.registerQueue({ name: 'product' })],
})
export class ProductQueueModule {}
