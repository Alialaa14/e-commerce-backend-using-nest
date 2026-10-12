import { BadRequestException, ConflictException } from '@nestjs/common';
import { LocationService } from '../Location/location.service';
import { BrandModel } from '../Brand/brand.model';
import { InventoryService } from '../Inventory/inventory.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { BrandBranchModel } from './brandBranch.model';
import { BrandBranchService } from './brandBranch.service';

describe('BrandBranchService', () => {
  it('depends on the brand model instead of the brand service', () => {
    const dependencies = Reflect.getMetadata(
      'design:paramtypes',
      BrandBranchService,
    );

    expect(dependencies[2]).toBe(BrandModel);
  });

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
    const brandModel = {
      getBrandByCondition: jest.fn().mockResolvedValue({ id: 'brand-1' }),
    } as unknown as BrandModel;
    const inventoryService = {
      createInventory: jest.fn(),
    } as unknown as InventoryService;
    const service = new BrandBranchService(
      brandBranchModel,
      locationService,
      brandModel,
      inventoryService,
      {} as PrismaService,
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
    const brandModel = {
      getBrandByCondition: jest.fn().mockResolvedValue({ id: 'brand-1' }),
    } as unknown as BrandModel;
    const inventoryService = {
      createInventory: jest.fn(),
    } as unknown as InventoryService;
    const service = new BrandBranchService(
      brandBranchModel,
      locationService,
      brandModel,
      inventoryService,
      {} as PrismaService,
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
    expect(inventoryService.createInventory).toHaveBeenCalledWith(
      { brandId: 'brand-1', branchId: 'branch-1', type: 'branch' },
      undefined,
    );
  });

  it('deletes branch inventory before soft-deleting the branch in one transaction', async () => {
    const branchId = 'branch-1';
    const transaction = {};
    const brandBranchModel = {
      getBrandBranchByCondition: jest.fn().mockResolvedValue({ id: branchId }),
      deleteBrandBranch: jest.fn().mockResolvedValue({ id: branchId }),
    } as unknown as BrandBranchModel;
    const brandModel = {
      getBrandByCondition: jest
        .fn()
        .mockResolvedValue({ id: 'brand-1', userId: 'owner-1' }),
    } as unknown as BrandModel;
    const inventoryService = {
      deleteBranchInventory: jest.fn().mockResolvedValue({ isActive: false }),
    } as unknown as InventoryService;
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback(transaction)),
      },
    } as unknown as PrismaService;
    const service = Reflect.construct(BrandBranchService, [
      brandBranchModel,
      {} as LocationService,
      brandModel,
      inventoryService,
      prismaService,
    ]) as BrandBranchService;

    await service.deleteBrandBranch({
      brandId: 'brand-1',
      branchId,
      userId: 'owner-1',
    });

    expect(inventoryService.deleteBranchInventory).toHaveBeenCalledWith(
      branchId,
      transaction,
    );
    expect(brandBranchModel.deleteBrandBranch).toHaveBeenCalledWith(
      branchId,
      transaction,
    );
  });

  it('does not delete a branch when inventory deletion is blocked by stock', async () => {
    const branchId = 'branch-1';
    const brandBranchModel = {
      getBrandBranchByCondition: jest.fn().mockResolvedValue({ id: branchId }),
      deleteBrandBranch: jest.fn(),
    } as unknown as BrandBranchModel;
    const brandModel = {
      getBrandByCondition: jest
        .fn()
        .mockResolvedValue({ id: 'brand-1', userId: 'owner-1' }),
    } as unknown as BrandModel;
    const inventoryService = {
      deleteBranchInventory: jest
        .fn()
        .mockRejectedValue(new ConflictException('Stock remains')),
    } as unknown as InventoryService;
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback({})),
      },
    } as unknown as PrismaService;
    const service = Reflect.construct(BrandBranchService, [
      brandBranchModel,
      {} as LocationService,
      brandModel,
      inventoryService,
      prismaService,
    ]) as BrandBranchService;

    await expect(
      service.deleteBrandBranch({
        brandId: 'brand-1',
        branchId,
        userId: 'owner-1',
      }),
    ).rejects.toThrow(ConflictException);
    expect(brandBranchModel.deleteBrandBranch).not.toHaveBeenCalled();
  });
});
