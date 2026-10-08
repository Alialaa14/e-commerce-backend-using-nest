import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BrandDocType } from '../generated/prisma/client';
import { LocationDetails } from '../Location/location.service';
import { createUniqueSlug } from '../helpers/catalog-identifiers';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { BrandModel } from './brand.model';

@Injectable()
export class BrandService {
  constructor(
    private readonly brandModel: BrandModel,
    private readonly cloudinaryService: CloudinaryService,
    private readonly prismaService: PrismaService,
  ) {}

  async createBrand(userId: string, name: string, logoFilePath?: string) {
    const existingBrand = await this.brandModel.getUserBrand(userId);
    if (existingBrand) {
      throw new BadRequestException('You have already created a brand');
    }

    const brandWithSameName = await this.brandModel.getBrandByCondition({
      name,
    });
    if (brandWithSameName) {
      throw new BadRequestException('Brand name already exists');
    }

    let logoUrl: string | undefined;
    let logoUrlId: string | undefined;

    if (logoFilePath) {
      const result = await this.cloudinaryService.uploadToCloudinary(
        logoFilePath,
        'brand-logos',
      );
      logoUrl = result.secure_url;
      logoUrlId = result.public_id;
    }

    const brand = await this.brandModel.createBrand({
      userId,
      name,
      slug: createUniqueSlug(name, randomUUID().replace(/-/g, '').slice(0, 12)),
      logoUrl,
      logoUrl_id: logoUrlId,
    });

    if (!brand) {
      throw new InternalServerErrorException('Brand creation failed');
    }

    return brand;
  }

  async getPublicBrandProfile(brandId: string) {
    const brand = await this.brandModel.findBrandById(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return {
      id: brand.id,
      name: brand.name,
      verificationStatus: brand.verificationStatus,
      rating: Number(brand.rating),
      logoUrl: brand.logoUrl,
    };
  }

  async updateBrandProfile(
    userId: string,
    brandId: string,
    data: {
      name?: string;
      isActive?: boolean;
      logoFilePath?: string;
    },
  ) {
    const brand = await this.brandModel.findBrandById(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand.userId !== userId) {
      throw new ForbiddenException('Unauthorized');
    }

    const updateData: {
      name?: string;
      isActive?: boolean;
      logoUrl?: string | null;
      logoUrl_id?: string | null;
    } = {};

    if (typeof data.name === 'string') {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Brand name cannot be empty');
      }

      const nameExists = await this.brandModel.getBrandByCondition({
        name: trimmedName,
        NOT: { id: brandId },
      });

      if (nameExists) {
        throw new BadRequestException('Brand name already exists');
      }

      updateData.name = trimmedName;
    }

    if (typeof data.isActive === 'boolean') {
      updateData.isActive = data.isActive;
    }

    if (data.logoFilePath) {
      const { secure_url, public_id } =
        await this.cloudinaryService.uploadToCloudinary(
          data.logoFilePath,
          'brand-logos',
        );

      updateData.logoUrl = secure_url;
      updateData.logoUrl_id = public_id;

      if (brand.logoUrl_id) {
        try {
          await this.cloudinaryService.deleteFromCloudinary(brand.logoUrl_id);
        } catch (error) {
          console.warn('Failed to delete previous brand logo', error);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No changes provided');
    }

    return this.brandModel.updateBrand(brandId, updateData);
  }

  async getBrandVerificationStatus(
    brandId: string,
    userId: string,
    role: string,
  ) {
    const brand = await this.brandModel.findBrandWithDocuments(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand.userId !== userId && role !== 'admin') {
      throw new ForbiddenException('Unauthorized');
    }

    const allTypes = Object.values(BrandDocType);
    const submitted = new Set(brand.documents.map((d) => d.docType));
    const missing = allTypes.filter((type) => !submitted.has(type));

    return {
      verificationStatus: brand.verificationStatus,
      submittedDocuments: brand.documents.map((d) => ({
        docType: d.docType,
        fileUrl: d.fileUrl,
        status: d.status,
        rejectionReason: (d as any).rejectionReason ?? null,
      })),
      missingDocuments: missing,
    };
  }

  async createBranchLocation(
    brandId: string,
    branchName: string,
    locationDetails: LocationDetails,
    isMain = true,
    isActive = true,
  ) {
    const branchLocation = await this.brandModel.createBranchLocation({
      brandId,
      name: branchName,
      code: `BR-${randomUUID()}`,
      ...locationDetails,
      isMain,
      isActive,
    });

    if (!branchLocation) {
      throw new InternalServerErrorException(
        'Failed to create branch location',
      );
    }

    return branchLocation;
  }

  async createBrandDocuments(
    brandId: string,
    documents: { docType: BrandDocType; fileUrl: string; fileUrl_id: string }[],
  ) {
    const brand = await this.brandModel.findBrandById(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const result = await this.brandModel.createBrandDocuments(
      brandId,
      documents,
    );
    if (!result || result.length === 0) {
      throw new InternalServerErrorException(
        'Failed to create brand documents',
      );
    }

    return result;
  }

  async getBrandByCondition(where: any) {
    return this.brandModel.getBrandByCondition(where);
  }
}
