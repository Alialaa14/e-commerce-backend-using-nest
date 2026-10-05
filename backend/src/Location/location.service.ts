import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
  constructor() {}
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
