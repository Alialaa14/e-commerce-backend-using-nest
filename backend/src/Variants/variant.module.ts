import { Module } from '@nestjs/common';
import { VariantService } from './variant.service';
import { VariantModel } from './variant.model';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { ProductModule } from '../Product/product.module';
import { forwardRef } from '@nestjs/common';
import { ProductModel } from '../Product/product.model';
import { VariantController } from './variant.controller';
import { TokenModule } from '../utils/Token/token.module';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';

@Module({
  controllers: [VariantController],
  providers: [VariantService, VariantModel, ProductModel],
  exports: [VariantService],
  imports: [PrismaModule, TokenModule, CloudinaryModule],
})
export class VariantModule {}
