import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
import { Prisma } from '../generated/prisma';
export interface BrandBranchModelInterface {
  brandId: string;
  name: string;
  code: string; // todo : delete it from the model
  latitude: number | Prisma.Decimal;
  longitude: number | Prisma.Decimal;
  placeId?: string;
  formattedAddress?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  locationGranularity?: string;
  phone?: string;
  openingHours?: Prisma.InputJsonValue;
  isMain?: boolean;
  isActive?: boolean;
}

@Injectable()
export class BrandBranchModel {
  constructor(private readonly prismaService: PrismaService) {}
  /**
   * create brand branch with name and brand Id associated with it
   * with required fields like location
   * longtitude - latitude
   * whether provide a readable address by assigning it or user reverse geocoding to generate a formatted address
   * is Main Branch => default to false
   * is Active => default to true
   */

  async createBrandBranch(payload: BrandBranchModelInterface) {
    return this.prismaService.prisma.brandBranch.create({ data: payload });
  }

  async updateBrandBranch(
    brandBranchId: string,
    payload: Omit<BrandBranchModelInterface, 'brandId'>,
  ) {
    return this.prismaService.prisma.brandBranch.update({
      where: { id: brandBranchId },
      data: payload,
    });
  }

  async deleteBrandBranch(brandBranchId: string) {
    return this.prismaService.prisma.brandBranch.delete({
      where: { id: brandBranchId },
    });
  }

  async getBrandBranch(brandBranchId: string) {
    return this.prismaService.prisma.brandBranch.findUnique({
      where: { id: brandBranchId },
    });
  }

  // todo : add pagination and filteration
  async getBrandBranches(brandId: string) {
    return this.prismaService.prisma.brandBranch.findMany({
      where: { brandId },
    });
  }

  async getBrandBranchByCondition(where: any) {
    return this.prismaService.prisma.brandBranch.findFirst({ where });
  }
}
