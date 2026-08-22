import { Module } from '@nestjs/common';
import { VariantService } from './variant.service';
import { VariantModel } from './variant.model';
import { PrismaModule } from '../utils/prisma/prisma.module';

@Module({
  controllers: [],
  providers: [VariantService, VariantModel],
  exports: [VariantService],
  imports: [PrismaModule],
})
export class VariantModule {}
