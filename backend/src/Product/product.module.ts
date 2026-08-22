import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductModel } from './product.model';
import { MulterModule } from '../utils/multer/multer.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { QueueModule } from '../Queues/queue.module';
import { VariantModule } from '../Variants/variant.module';
import { BrandModule } from '../Brand/brand.module';
import { CategoryModule } from '../Category/category.module';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { TokenModule } from '../utils/Token/token.module';
@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductModel],
  exports: [],
  imports: [
    MulterModule,
    PrismaModule,
    QueueModule,
    VariantModule,
    BrandModule,
    CategoryModule,
    CloudinaryModule,
    TokenModule,
    BrandModule,
  ],
})
export class ProductModule {}
