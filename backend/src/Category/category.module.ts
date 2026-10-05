import { Module } from '@nestjs/common';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { CategoryController } from './category.controller';
import { CategoryModel } from './category.model';
import { CategoryService } from './category.service';
import { MulterModule } from '../utils/multer/multer.module';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule, TokenModule, MulterModule, CloudinaryModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryModel, AuthGuard, RolesGuard],
  exports: [CategoryService],
})
export class CategoryModule {}
