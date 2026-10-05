import { Body, Controller, Post } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}
  @Post()
  async getLocation(
    @Body()
    dto: {
      userLocation: {
        latitude: number;
        longitude: number;
      };
      storeLocation: {
        latitude: number;
        longitude: number;
      };
    },
  ) {
    return this.locationService.getDirections(
      dto.userLocation,
      dto.storeLocation,
    );
  }
}
