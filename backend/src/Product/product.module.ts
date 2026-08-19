import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductModel } from './product.model';
import { MulterModule } from '../utils/multer/multer.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { QueueModule } from '../Queues/queue.module';
@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductModel],
  exports: [],
  imports: [MulterModule, PrismaModule, QueueModule],
})
export class ProductModule {}
