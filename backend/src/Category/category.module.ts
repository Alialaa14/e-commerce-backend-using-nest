import { Module } from '@nestjs/common';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { CategoryController } from './category.controller';
import { CategoryModel } from './category.model';
import { CategoryService } from './category.service';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryModel],
  exports: [CategoryService, CategoryModel],
})
export class CategoryModule {}
