import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { BrandBranchModule } from '../BrandBranch/brandBranch.module';

@Module({
  exports: [LocationService],
  imports: [ConfigModule, BrandBranchModule],
  providers: [LocationService],
  controllers: [LocationController],
})
export class LocationModule {}
