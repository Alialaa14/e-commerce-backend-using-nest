import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';

@Module({
  exports: [LocationService],
  imports: [ConfigModule],
  providers: [LocationService],
  controllers: [LocationController],
})
export class LocationModule {}
