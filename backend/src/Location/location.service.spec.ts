import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Prisma } from '../generated/prisma';
import { LocationService } from './location.service';

jest.mock('axios');

describe('LocationService', () => {
  it('accepts Prisma decimal coordinates without losing fractional precision', async () => {
    const latitude = new Prisma.Decimal('30.044420');
    const longitude = new Prisma.Decimal('31.235712');
    jest.mocked(axios.get).mockResolvedValue({
      data: {
        results: [
          {
            location: { latitude: 30.04442, longitude: 31.235712 },
          },
        ],
      },
    });
    const service = new LocationService(
      new ConfigService({ GOOGLE_MAPS_KEY: 'test-key' }),
    );

    await expect(
      service.reverseGeocode({ latitude, longitude }),
    ).resolves.toMatchObject({
      latitude: 30.04442,
      longitude: 31.235712,
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://geocode.googleapis.com/v4/geocode/location',
      {
        params: {
          'location.latitude': 30.04442,
          'location.longitude': 31.235712,
          key: 'test-key',
        },
      },
    );
  });

  it('calculates distance when coordinates are zero', () => {
    const service = new LocationService(new ConfigService());

    expect(
      service.calculateDistance(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ),
    ).toBeCloseTo(111.19, 1);
  });

  it('reverse geocodes coordinates and returns normalized location details', async () => {
    jest.mocked(axios.get).mockResolvedValue({
      data: {
        results: [
          {
            location: { latitude: 0, longitude: 31.2 },
            placeId: 'place-1',
            formattedAddress: 'Cairo, Egypt',
            granularity: 'ROOFTOP',
            addressComponents: [
              { longText: '12', types: ['street_number'] },
              { longText: 'Tahrir Street', types: ['route'] },
              { longText: 'Cairo', types: ['locality'] },
              {
                longText: 'Cairo Governorate',
                types: ['administrative_area_level_1'],
              },
              { longText: 'Egypt', types: ['country'] },
              { longText: '11511', types: ['postal_code'] },
            ],
          },
        ],
      },
    });
    const service = new LocationService(
      new ConfigService({ GOOGLE_MAPS_KEY: 'test-key' }),
    );

    await expect(
      service.reverseGeocode({ latitude: 0, longitude: 31.2 }),
    ).resolves.toEqual({
      latitude: 0,
      longitude: 31.2,
      placeId: 'place-1',
      formattedAddress: 'Cairo, Egypt',
      addressLine: '12 Tahrir Street',
      city: 'Cairo',
      state: 'Cairo Governorate',
      country: 'Egypt',
      postalCode: '11511',
      locationGranularity: 'ROOFTOP',
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://geocode.googleapis.com/v4/geocode/location',
      {
        params: {
          'location.latitude': 0,
          'location.longitude': 31.2,
          key: 'test-key',
        },
      },
    );
  });
});
