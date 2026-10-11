import { Prisma } from '../generated/prisma';
import { BrandBranchService } from '../BrandBranch/brandBranch.service';
import { LocationDetails } from '../Location/location.service';
import { InventoryService } from '../Inventory/inventory.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { BrandModel } from './brand.model';
import { BrandService } from './brand.service';
import { CatalogService } from '../Product/catalog.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BrandService', () => {
  it('creates a main inventory and its initial branch through the branch service', async () => {
    const transaction = {} as Prisma.TransactionClient;
    const brand = { id: 'brand-1' };
    const location = {
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
    } satisfies LocationDetails;
    const brandModel = {
      getUserBrand: jest.fn().mockResolvedValue(null),
      getBrandByCondition: jest.fn().mockResolvedValue(null),
      createBrand: jest.fn().mockResolvedValue(brand),
    } as unknown as BrandModel;
    const cloudinaryService = {} as CloudinaryService;
    const prismaService = {
      prisma: {
        $transaction: jest.fn(
          (callback: (tx: Prisma.TransactionClient) => unknown) =>
            callback(transaction),
        ),
      },
    } as unknown as PrismaService;
    const brandBranchService = {
      createBrandBranch: jest.fn(),
    } as unknown as BrandBranchService;
    const inventoryService = {
      createInventory: jest.fn(),
    } as unknown as InventoryService;
    const service = new BrandService(
      brandModel,
      cloudinaryService,
      prismaService,
      brandBranchService,
      inventoryService,
      {} as CatalogService,
    );

    await service.createBrand('user-1', 'Sample Brand', {
      name: 'Main Branch',
      location,
    });

    expect(inventoryService.createInventory).toHaveBeenCalledWith(
      { brandId: brand.id, type: 'main' },
      transaction,
    );
    expect(brandBranchService.createBrandBranch).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: brand.id, name: 'Main Branch' }),
      location,
      transaction,
    );
  });

  it('deletes all branches and products with the brand in one transaction', async () => {
    const transaction = {};
    const brand = { id: 'brand-1', userId: 'owner-1', isActive: true };
    const brandModel = {
      getBrandByCondition: jest.fn().mockResolvedValue(brand),
      updateBrand: jest.fn().mockResolvedValue({ ...brand, isActive: false }),
    } as unknown as BrandModel;
    const brandBranchService = {
      getBrandBranches: jest.fn().mockResolvedValue([{ id: 'branch-1' }]),
      deleteBrandBranch: jest.fn().mockResolvedValue({ id: 'branch-1' }),
    } as unknown as BrandBranchService;
    const inventoryService = {
      deleteMainInventory: jest.fn().mockResolvedValue({ isActive: false }),
    } as unknown as InventoryService;
    const catalogService = {
      softDeleteProductsForBrand: jest.fn().mockResolvedValue({ count: 2 }),
    } as unknown as CatalogService;
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback(transaction)),
      },
    } as unknown as PrismaService;
    const service = Reflect.construct(BrandService, [
      brandModel,
      {} as CloudinaryService,
      prismaService,
      brandBranchService,
      inventoryService,
      catalogService,
    ]) as BrandService;
    const deleteBrand = Reflect.get(service, 'deleteBrand');

    await Reflect.apply(deleteBrand, service, ['owner-1', 'brand-1']);

    expect(brandBranchService.deleteBrandBranch).toHaveBeenCalledWith(
      { brandId: 'brand-1', branchId: 'branch-1', userId: 'owner-1' },
      transaction,
    );
    expect(inventoryService.deleteMainInventory).toHaveBeenCalledWith(
      'brand-1',
      transaction,
    );
    expect(catalogService.softDeleteProductsForBrand).toHaveBeenCalledWith(
      'brand-1',
      transaction,
    );
    expect(brandModel.updateBrand).toHaveBeenCalledWith(
      'brand-1',
      { isActive: false },
      transaction,
    );
  });

  it('does not delete a brand owned by another user', async () => {
    const brandModel = {
      getBrandByCondition: jest
        .fn()
        .mockResolvedValue({ id: 'brand-1', userId: 'owner-1' }),
    } as unknown as BrandModel;
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback({})),
      },
    } as unknown as PrismaService;
    const service = Reflect.construct(BrandService, [
      brandModel,
      {} as CloudinaryService,
      prismaService,
      {} as BrandBranchService,
      {} as InventoryService,
      {} as CatalogService,
    ]) as BrandService;
    const deleteBrand = Reflect.get(service, 'deleteBrand');

    await expect(
      Reflect.apply(deleteBrand, service, ['not-owner', 'brand-1']),
    ).rejects.toThrow('Unauthorized');
  });

  it('does not archive products when a branch inventory still has stock', async () => {
    const brandModel = {
      getBrandByCondition: jest.fn().mockResolvedValue({
        id: 'brand-1',
        userId: 'owner-1',
        isActive: true,
      }),
      updateBrand: jest.fn(),
    } as unknown as BrandModel;
    const brandBranchService = {
      getBrandBranches: jest.fn().mockResolvedValue([{ id: 'branch-1' }]),
      deleteBrandBranch: jest
        .fn()
        .mockRejectedValue(new ConflictException('Stock remains')),
    } as unknown as BrandBranchService;
    const inventoryService = {
      deleteMainInventory: jest.fn(),
    } as unknown as InventoryService;
    const catalogService = {
      softDeleteProductsForBrand: jest.fn(),
    } as unknown as CatalogService;
    const prismaService = {
      prisma: {
        $transaction: jest.fn((callback) => callback({})),
      },
    } as unknown as PrismaService;
    const service = Reflect.construct(BrandService, [
      brandModel,
      {} as CloudinaryService,
      prismaService,
      brandBranchService,
      inventoryService,
      catalogService,
    ]) as BrandService;

    await expect(service.deleteBrand('owner-1', 'brand-1')).rejects.toThrow(
      ConflictException,
    );
    expect(inventoryService.deleteMainInventory).not.toHaveBeenCalled();
    expect(catalogService.softDeleteProductsForBrand).not.toHaveBeenCalled();
    expect(brandModel.updateBrand).not.toHaveBeenCalled();
  });

  it('does not return a deactivated brand profile', async () => {
    const brandModel = {
      findBrandById: jest.fn().mockResolvedValue({
        id: 'brand-1',
        isActive: false,
      }),
      getBrandByCondition: jest.fn().mockResolvedValue(null),
    } as unknown as BrandModel;
    const service = Reflect.construct(BrandService, [
      brandModel,
      {} as CloudinaryService,
      {} as PrismaService,
      {} as BrandBranchService,
      {} as InventoryService,
      {} as CatalogService,
    ]) as BrandService;

    await expect(service.getPublicBrandProfile('brand-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(brandModel.getBrandByCondition).toHaveBeenCalledWith({
      id: 'brand-1',
      isActive: true,
    });
  });
});
