import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { MulterService } from '../utils/multer/multer.service';
import { UserModel } from '../User/user.model';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';
import { MultipartInterceptor } from '../utils/multer/multer.interceptor';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';
import { LocationService } from '../Location/location.service';
import { Role } from '../generated/prisma/client';

@Controller('brands')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly userModel: UserModel,
    private readonly uploadService: MulterService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly locationService: LocationService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'user', 'brand')
  @UseInterceptors(MultipartInterceptor)
  async createBrand(
    @UploadedFastifyFile() picture: any,
    @Req() req: FastifyRequest,
    @Body() dto: CreateBrandDto,
  ) {
    const user = (req as any).user;
    let localPath: string | undefined;
    let locationDetails = await this.locationService.reverseGeocode(
      dto.location,
    );

    if (picture) {
      localPath = await this.uploadService.saveToDisk(picture, 'brands');
    }

    const brand = await this.brandService.createBrand(
      user.sub,
      dto.name,
      localPath,
    );
    locationDetails = dto.branchAddress
      ? {
          ...locationDetails,
          formattedAddress: dto.branchAddress,
        }
      : locationDetails;
    await this.userModel.updateUser(user.sub, {
      role: Role.brand,
      brandId: brand.id,
    });

    await this.brandService.createBranchLocation(
      brand.id,
      dto.branchName || 'Main Branch',
      locationDetails,
      true,
    );

    return {
      success: true,
      message: 'Brand created successfully',
      data: brand,
    };
  }

  @Get(':brandId')
  async getPublicBrandProfile(@Param('brandId') brandId: string) {
    const result = await this.brandService.getPublicBrandProfile(brandId);

    return {
      success: true,
      message: 'Brand profile retrieved successfully',
      data: result,
    };
  }

  @Patch(':brandId/profile')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async updateBrandProfile(
    @Req() req: FastifyRequest,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandProfileDto,
  ) {
    const user = (req as any).user;
    let localPath: string | undefined;
    let logoUrl: string | undefined;

    const file = await (req as any).file?.();

    if (file) {
      localPath = await this.uploadService.saveToDisk(file, 'brands');

      try {
        const { secure_url } = await this.cloudinaryService.uploadToCloudinary(
          localPath,
          `brand/${dto.name || 'logo'}`,
        );
        logoUrl = secure_url;
      } finally {
        await this.uploadService.deleteFile(localPath);
      }
    }

    const brand = await this.brandService.updateBrandProfile(
      user.sub,
      brandId,
      {
        name: dto.name,
        isActive: dto.isActive,
        logoFilePath: logoUrl,
      },
    );

    return {
      success: true,
      message: 'Brand profile updated successfully',
      data: brand,
    };
  }

  @Get(':brandId/verification-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async brandVerificationStatus(
    @Req() req: FastifyRequest,
    @Param('brandId') brandId: string,
  ) {
    const user = (req as any).user;

    const result = await this.brandService.getBrandVerificationStatus(
      brandId,
      user.sub,
      user.role,
    );

    return {
      success: true,
      message: 'OK',
      data: result,
    };
  }

  @Post(':brandId/documents')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'brand')
  async createBrandDocument(
    @Req() req: FastifyRequest,
    @Param('brandId') brandId: string,
    @Body() body: { docTypes?: string[] },
  ) {
    const user = (req as any).user;
    const files = await (req as any).files?.();
    const rawTypes = body.docTypes ?? [];

    if (!files || files.length === 0) {
      throw new Error('No document provided');
    }

    if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
      throw new Error('Document types are required');
    }

    if (files.length !== rawTypes.length) {
      throw new Error(
        'Number of uploaded documents must match the number of document types',
      );
    }

    const brand = await this.brandService.getBrandByCondition({
      id: brandId,
      userId: user.sub,
    });

    if (!brand) {
      throw new Error(
        'You are not authorized to upload documents for this brand',
      );
    }

    return {
      success: true,
      message: 'Brand documents created successfully',
    };
  }
}
