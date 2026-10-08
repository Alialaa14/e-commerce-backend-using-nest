import { Module } from '@nestjs/common';
import { BrandBranchModel } from './brandBranch.model';
import { BrandBranchService } from './brandBranch.service';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { LocationModule } from '../Location/location.module';
import { BrandModule } from '../Brand/brand.module';

@Module({
  exports: [],
  imports: [PrismaModule, LocationModule, BrandModule],
  controllers: [],
  providers: [BrandBranchService, BrandBranchModel],
})
export class BrandBranchModule {}
