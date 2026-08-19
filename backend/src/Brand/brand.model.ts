import { Injectable } from '@nestjs/common';
import { BrandDocType } from '../generated/prisma/client';
import { PrismaService } from '../utils/prisma/prisma.service';

@Injectable()
export class BrandModel {
  constructor(private readonly prismaService: PrismaService) {}

  async findBrandWithDocuments(brandId: string) {
    return this.prismaService.prisma.brand.findUnique({
      where: { id: brandId },
      include: { documents: true },
    });
  }

  async findBrandById(brandId: string) {
    return this.prismaService.prisma.brand.findUnique({
      where: { id: brandId },
    });
  }

  async getUserBrand(userId: string) {
    return this.prismaService.prisma.brand.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        name: true,
        verificationStatus: true,
      },
    });
  }

  async getBrandByCondition(where: any) {
    return this.prismaService.prisma.brand.findFirst({ where });
  }

  async createBrand(data: {
    userId: string;
    name: string;
    logoUrl?: string;
    logoUrl_id?: string;
  }) {
    return this.prismaService.prisma.brand.create({ data });
  }

  async updateBrand(
    brandId: string,
    data: {
      name?: string;
      isActive?: boolean;
      logoUrl?: string | null;
      logoUrl_id?: string | null;
    },
  ) {
    return this.prismaService.prisma.brand.update({
      where: { id: brandId },
      data,
    });
  }

  async createBranchLocation(data: {
    brandId: string;
    name: string;
    latitude: number;
    longitude: number;
    placeId: string;
    formattedAddress: string;
    addressLine: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    locationGranularity: string;
    isMain?: boolean;
    isActive?: boolean;
  }) {
    return this.prismaService.prisma.brandBranch.create({ data });
  }

  async createBrandDocuments(
    brandId: string,
    data: { docType: BrandDocType; fileUrl: string; fileUrl_id: string }[],
  ) {
    return this.prismaService.prisma.brandDocument.createManyAndReturn({
      data: data.map((doc) => ({
        brandId,
        docType: doc.docType,
        fileUrl: doc.fileUrl,
        fileUrl_id: doc.fileUrl_id,
      })),
    });
  }
}
