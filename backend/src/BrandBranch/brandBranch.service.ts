import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BrandBranchModel } from './brandBranch.model';
import { LocationDetails, LocationService } from '../Location/location.service';
import { Prisma } from '../generated/prisma';
import { BrandModel } from '../Brand/brand.model';
import { Decimal } from '../generated/prisma/runtime/client';
import { inventoryType } from '../generated/prisma';
import { InventoryService } from '../Inventory/inventory.service';
import { PrismaService } from '../utils/prisma/prisma.service';

export interface BrandBranchInput {
  name: string;
  code: string;
  brandId: string;
  latitude: number | Decimal;
  longitude: number | Decimal;
  openingHours?: Prisma.InputJsonValue;
  isActive?: boolean;
  isMain?: boolean;
  formattedAddress?: string;
}
@Injectable()
export class BrandBranchService {
  constructor(
    private readonly brandBranchModel: BrandBranchModel,
    private readonly locationService: LocationService,
    private readonly brandModel: BrandModel,
    private readonly inventoryService: InventoryService,
    private readonly prismaService: PrismaService,
  ) {}
  private async checkExistingBranch(
    payload: {
      brandId?: string;
      branchId?: string;
      latitude?: number | Decimal;
      longitude?: number | Decimal;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    return this.brandBranchModel.getBrandBranchByCondition(
      payload,
      transaction,
    );
  }
  async createBrandBranch(
    payload: BrandBranchInput,
    locationDetails?: LocationDetails,
    transaction?: Prisma.TransactionClient,
  ) {
    // first check if the brand exists
    const brandExisted = await this.brandModel.getBrandByCondition(
      {
        id: payload.brandId,
      },
      transaction,
    );
    if (!brandExisted) {
      throw new BadRequestException("Brand Doesn't existed");
    }
    // second check if it has the same branch with the same latitude - longitude
    const existedBranch = await this.checkExistingBranch(
      {
        brandId: payload.brandId,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
      transaction,
    );
    if (existedBranch) {
      throw new BadRequestException('Branch already existed');
    }
    // create location
    const location =
      locationDetails ??
      (await this.locationService.reverseGeocode({
        latitude: payload.latitude,
        longitude: payload.longitude,
      }));

    // check if the user has provided us a readable address or not
    const formattedAddress =
      payload.formattedAddress ?? location.formattedAddress;
    // create branch
    const branchCreated = await this.brandBranchModel.createBrandBranch(
      {
        ...payload,
        ...location,
        latitude: payload.latitude,
        longitude: payload.longitude,
        formattedAddress,
      },
      transaction,
    );

    if (!branchCreated) {
      throw new Error('Failed to create branch');
    }
    await this.inventoryService.createInventory(
      {
        brandId: payload.brandId,
        branchId: branchCreated.id,
        type: inventoryType.branch,
      },
      transaction,
    );

    return branchCreated;
  }

  async updateBrandBranch(
    payload: BrandBranchInput,
    branchId: string,
    userId: string,
  ) {
    const brand = await this.brandModel.getBrandByCondition({
      id: payload.brandId,
    });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand.userId !== userId) throw new ForbiddenException();

    const branch = await this.brandBranchModel.getBrandBranchByCondition({
      id: branchId,
      brandId: payload.brandId,
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const coordsChanged =
      Number(branch.latitude) !== Number(payload.latitude) ||
      Number(branch.longitude) !== Number(payload.longitude);

    let location: { formattedAddress?: string } = {};

    if (coordsChanged) {
      const clash = await this.brandBranchModel.getBrandBranchByCondition({
        brandId: payload.brandId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        excludeId: branchId, // model: NOT: { id: excludeId }
      });
      if (clash)
        throw new ConflictException('Another branch exists at this location');

      location = await this.locationService.reverseGeocode({
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
    }

    if (payload.formattedAddress) {
      location = { ...location, formattedAddress: payload.formattedAddress };
    }

    return this.brandBranchModel.updateBrandBranch(branchId, {
      name: payload.name,
      code: payload.code,
      latitude: payload.latitude,
      longitude: payload.longitude,
      openingHours: payload.openingHours,
      isActive: payload.isActive,
      isMain: payload.isMain,
      ...location,
    });
  }

  async deleteBrandBranch(payload: {
    brandId: string;
    branchId: string;
    userId: string;
  }, transaction?: Prisma.TransactionClient) {
    if (transaction) {
      return this.deleteBrandBranchInTransaction(payload, transaction);
    }

    return this.prismaService.prisma.$transaction((tx) =>
      this.deleteBrandBranchInTransaction(payload, tx),
    );
  }

  private async deleteBrandBranchInTransaction(
    payload: { brandId: string; branchId: string; userId: string },
    transaction: Prisma.TransactionClient,
  ) {
    // check if the brand is Existing or not
    const brandExisted = await this.brandModel.getBrandByCondition({
      id: payload.brandId,
    }, transaction);
    if (!brandExisted) {
      throw new NotFoundException('Brand not found');
    }
    if (brandExisted.userId !== payload.userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this branch',
      );
    }
    // check if the branch is existing or not
    const branchExisted = await this.brandBranchModel.getBrandBranchByCondition(
      {
        id: payload.branchId,
        brandId: payload.brandId,
        deletedAt: null,
      },
      transaction,
    );
    if (!branchExisted) {
      throw new NotFoundException('Branch not found');
    }

    await this.inventoryService.deleteBranchInventory(
      payload.branchId,
      transaction,
    );
    const branchDeleted = await this.brandBranchModel.deleteBrandBranch(
      payload.branchId,
      transaction,
    );
    if (!branchDeleted) {
      throw new Error('Failed to delete branch');
    }
    return branchDeleted;
  }

  // todo : add pagination and filteration
  async getBrandBranches(
    brandId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    return this.brandBranchModel.getBrandBranches(brandId, transaction);
  }

  async getBrandBranch(brandBranchId: string) {
    return this.brandBranchModel.getBrandBranch(brandBranchId);
  }
}
