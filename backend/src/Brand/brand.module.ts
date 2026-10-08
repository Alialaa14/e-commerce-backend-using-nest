import { forwardRef, Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { MulterModule } from '../utils/multer/multer.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { UserModule } from '../User/user.module';
import { LocationModule } from '../Location/location.module';
import { BranchScopeGuard } from '../common/guards/branch-scope.guard';
import { BrandScopeGuard } from '../common/guards/brand-scope.guard';
import { BrandController } from './brand.controller';
import { BrandModel } from './brand.model';
import { BrandService } from './brand.service';
import { BrandDocumentService } from './brand-document.service';
import { BrandBranchModule } from '../BrandBranch/brandBranch.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    MulterModule,
    UserModule,
    TokenModule,
    LocationModule,
    forwardRef(() => BrandBranchModule),
  ],
  controllers: [BrandController],
  providers: [
    BrandService,
    BrandDocumentService,
    BrandModel,
    AuthGuard,
    RolesGuard,
    BranchScopeGuard,
    BrandScopeGuard,
  ],
  exports: [BrandService, BrandModel],
})
export class BrandModule {}
