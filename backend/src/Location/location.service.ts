import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationDetails extends Coordinates {
  placeId: string;
  formattedAddress: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  locationGranularity: string;
}

interface GoogleGeocodeResult {
  location?: Coordinates;
  placeId?: string;
  formattedAddress?: string;
  granularity?: string;
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
  postalAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
}

@Injectable()
export class LocationService {
  constructor(private readonly configService: ConfigService) {}

  async reverseGeocode(coordinates: Coordinates): Promise<LocationDetails> {
    if (
      !coordinates ||
      !Number.isFinite(coordinates.latitude) ||
      coordinates.latitude < -90 ||
      coordinates.latitude > 90 ||
      !Number.isFinite(coordinates.longitude) ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180
    ) {
      throw new BadRequestException('Invalid latitude or longitude');
    }

    const apiKey = this.configService.get<string>('GOOGLE_MAPS_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Google Maps API key is not configured',
      );
    }

    let response;
    try {
      response = await axios.get<{ results?: GoogleGeocodeResult[] }>(
        'https://geocode.googleapis.com/v4/geocode/location',
        {
          params: {
            'location.latitude': coordinates.latitude,
            'location.longitude': coordinates.longitude,
            key: apiKey,
          },
        },
      );
    } catch {
      throw new BadGatewayException(
        'Failed to retrieve location details from Google Maps',
      );
    }

    const result = response.data.results?.[0];
    if (!result) {
      throw new NotFoundException('No address found for these coordinates');
    }
    if (!result.location) {
      throw new BadGatewayException(
        'Google Maps returned an invalid location response',
      );
    }

    const getAddressComponent = (...types: string[]) =>
      result.addressComponents?.find((component) =>
        component.types?.some((type) => types.includes(type)),
      )?.longText;
    const streetAddress = [
      getAddressComponent('street_number'),
      getAddressComponent('route'),
    ]
      .filter(Boolean)
      .join(' ');

    return {
      latitude: result.location.latitude,
      longitude: result.location.longitude,
      placeId: result.placeId ?? '',
      formattedAddress: result.formattedAddress ?? '',
      addressLine:
        result.postalAddress?.addressLines?.join(', ') ||
        streetAddress ||
        result.formattedAddress ||
        '',
      city:
        getAddressComponent('locality', 'postal_town', 'sublocality_level_1') ||
        result.postalAddress?.locality ||
        '',
      state:
        getAddressComponent('administrative_area_level_1') ||
        result.postalAddress?.administrativeArea ||
        '',
      country:
        getAddressComponent('country') ||
        result.postalAddress?.regionCode ||
        '',
      postalCode:
        getAddressComponent('postal_code') ||
        result.postalAddress?.postalCode ||
        '',
      locationGranularity: result.granularity ?? '',
    };
  }

  calculateDistance(
    userLocation: { latitude: number; longitude: number },
    storeLocation: { latitude: number; longitude: number },
  ): number {
    if (!userLocation || !storeLocation) {
      throw new Error('Both userLocation and storeLocation must be provided');
    }
    if (
      !userLocation.latitude ||
      !userLocation.longitude ||
      !storeLocation.latitude ||
      !storeLocation.longitude
    ) {
      throw new Error(
        'Both userLocation and storeLocation must have latitude and longitude',
      );
    }
    if (
      userLocation.latitude < -90 ||
      userLocation.latitude > 90 ||
      userLocation.longitude < -180 ||
      userLocation.longitude > 180
    ) {
      throw new Error(
        'User location latitude must be between -90 and 90 and longitude must be between -180 and 180',
      );
    }

    const radiusOfEarthKm = 6371; // Radius of the Earth in kilometer
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const dLat = toRadians(storeLocation.latitude - userLocation.latitude);
    const dLong = toRadians(storeLocation.longitude - userLocation.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(userLocation.latitude)) *
        Math.cos(toRadians(storeLocation.latitude)) *
        Math.sin(dLong / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = radiusOfEarthKm * c;
    return distance;
  }

  calculateDeliveryTime(distance: number, averageSpeed: number): number {
    if (distance < 0) {
      throw new Error('Distance cannot be negative');
    }
    if (averageSpeed < 0) {
      throw new Error('Average speed cannot be negative');
    }

    const timeInHours = distance / averageSpeed;
    const timeInDays = Math.ceil(timeInHours / 24);
    return timeInDays;
  }

  calculateDeliveryCost(distance: number, costPerKm: number): number {
    if (distance < 0) {
      throw new Error('Distance cannot be negative');
    }
    if (costPerKm < 0) {
      throw new Error('Cost per kilometer cannot be negative');
    }
    const cost = distance * costPerKm;
    return cost;
  }

  getNearestBranches(
    userLocation: { latitude: number; longitude: number },
    branches: { latitude: number; longitude: number }[],
  ): { latitude: number; longitude: number } | null {
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      throw new Error(
        'User location must be provided with latitude and longitude',
      );
    }
    if (!branches || branches.length === 0) {
      return null; // No branches available
    }

    // Calculate the nearest branches from nearest to farthest
    const sortedBranches = branches.sort((a, b) => {
      const distanceA = this.calculateDistance(userLocation, a);
      const distanceB = this.calculateDistance(userLocation, b);
      return distanceA - distanceB;
    });

    return sortedBranches[0]; // Return the nearest branch
  }

  // implement a method to get directions from user location to store location using a mapping service like Google Maps API or OpenStreetMap API. This method can return the route, estimated time, and distance.
  async getDirections(
    userLocation: { latitude: number; longitude: number },
    storeLocation: { latitude: number; longitude: number },
  ) {
    try {
      const response = await axios.post(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          origin: {
            location: {
              latLng: {
                latitude: storeLocation.latitude,
                longitude: storeLocation.longitude,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
        },
        {
          headers: {
            'X-Goog-Api-Key': process.env.GOOGLE_MAPS_KEY,
            'Content-Type': 'application/json',
            'X-Goog-FieldMask':
              'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
          },
        },
      );
      const distanceInKm = Math.ceil(
        response.data.routes[0].distanceMeters / 1000,
      );
      const durationInDays = Math.ceil(
        parseInt(response.data.routes[0].duration) / (60 * 60 * 24),
      );
      return {
        distance: distanceInKm,
        duration: durationInDays,
        line: response.data.routes[0].polyline.encodedPolyline,
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error getting directions');
    }
  }
}
