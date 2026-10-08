import { BadRequestException } from '@nestjs/common';
import { LocationService } from '../Location/location.service';
import { BrandService } from '../Brand/brand.service';
import { BrandBranchModel } from './brandBranch.model';
import { BrandBranchService } from './brandBranch.service';

describe('BrandBranchService', () => {
  it('rejects creating a branch when the brand already has the coordinates', async () => {
    const brandBranchModel = {
      getBrandBranchByCondition: jest
        .fn()
        .mockResolvedValue({ id: 'branch-1' }),
      createBrandBranch: jest.fn(),
    } as unknown as BrandBranchModel;
    const locationService = {
      reverseGeocode: jest.fn(),
    } as unknown as LocationService;
    const brandService = {
      getBrandByCondition: jest.fn().mockResolvedValue({ id: 'brand-1' }),
    } as unknown as BrandService;
    const service = new BrandBranchService(
      brandBranchModel,
      locationService,
      brandService,
    );

    await expect(
      service.createBrandBranch({
        brandId: 'brand-1',
        name: 'Main Branch',
        code: 'BR-1',
        latitude: 30.04442,
        longitude: 31.235712,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(brandBranchModel.createBrandBranch).not.toHaveBeenCalled();
    expect(locationService.reverseGeocode).not.toHaveBeenCalled();
  });

  it('uses provided geocoded details and preserves submitted coordinates', async () => {
    const createdBranch = { id: 'branch-1' };
    const brandBranchModel = {
      getBrandBranchByCondition: jest.fn().mockResolvedValue(null),
      createBrandBranch: jest.fn().mockResolvedValue(createdBranch),
    } as unknown as BrandBranchModel;
    const locationService = {
      reverseGeocode: jest.fn(),
    } as unknown as LocationService;
    const brandService = {
      getBrandByCondition: jest.fn().mockResolvedValue({ id: 'brand-1' }),
    } as unknown as BrandService;
    const service = new BrandBranchService(
      brandBranchModel,
      locationService,
      brandService,
    );
    const locationDetails = {
      latitude: 30.04442,
      longitude: 31.235712,
      placeId: 'place-1',
      formattedAddress: 'Cairo, Egypt',
      addressLine: 'Tahrir Street',
      city: 'Cairo',
      state: 'Cairo Governorate',
      country: 'Egypt',
      postalCode: '11511',
      locationGranularity: 'ROOFTOP',
    };

    await expect(
      service.createBrandBranch(
        {
          brandId: 'brand-1',
          name: 'Main Branch',
          code: 'BR-1',
          latitude: 30.04442,
          longitude: 31.235712,
        },
        locationDetails,
      ),
    ).resolves.toBe(createdBranch);

    expect(locationService.reverseGeocode).not.toHaveBeenCalled();
    expect(brandBranchModel.createBrandBranch).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: 'brand-1',
        name: 'Main Branch',
        code: 'BR-1',
        latitude: 30.04442,
        longitude: 31.235712,
        placeId: 'place-1',
        formattedAddress: 'Cairo, Egypt',
        addressLine: 'Tahrir Street',
        city: 'Cairo',
        state: 'Cairo Governorate',
        country: 'Egypt',
        postalCode: '11511',
        locationGranularity: 'ROOFTOP',
      }),
      undefined,
    );
  });
});
