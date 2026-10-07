import { forwardRef, Module } from '@nestjs/common';
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
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { BrandScopeGuard } from '../common/guards/brand-scope.guard';
import { CatalogController } from './catalog.controller';
import { BranchCatalogController } from './branch-catalog.controller';
import { BranchAdminCatalogController } from './branch-admin-catalog.controller';
import { CatalogService } from './catalog.service';
@Module({
  controllers: [
    ProductController,
    CatalogController,
    BranchCatalogController,
    BranchAdminCatalogController,
  ],
  providers: [
    ProductService,
    ProductModel,
    CatalogService,
    AuthGuard,
    RolesGuard,
    BranchScopeGuard,
    BrandScopeGuard,
  ],
  exports: [ProductModel, CatalogService],
  imports: [
    MulterModule,
    PrismaModule,
    QueueModule,
    VariantModule,
    BrandModule,
    CategoryModule,
    CloudinaryModule,
    TokenModule,
  ],
})
export class ProductModule {}
