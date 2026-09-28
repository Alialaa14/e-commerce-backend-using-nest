// cloudinary.service.ts
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as path from 'path';
import { InternalServerErrorException } from '@nestjs/common';

type ResourceType = 'image' | 'video' | 'raw' | 'auto';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // Upload from file path
  async uploadToCloudinary(
    filePath: string,
    folder: string,
  ): Promise<UploadApiResponse> {
    if (!filePath) {
      throw new BadRequestException('filePath is required');
    }
    const filePathResolved = path.resolve(filePath);
    try {
      const result = await cloudinary.uploader.upload(filePathResolved, {
        folder,
      });
      return result;
    } catch (error: any) {
      console.log(error);
      throw new InternalServerErrorException(
        error?.message || 'Cloudinary upload failed',
      );
    }
  }

  // Delete
  async deleteFromCloudinary(
    publicId: string,
    resource_type: ResourceType = 'image',
  ): Promise<{ result: string }> {
    if (!publicId) {
      throw new BadRequestException('publicId is required');
    }
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type,
      });
      return result;
    } catch (error: any) {
      throw new InternalServerErrorException(
        error?.message || 'Cloudinary upload failed',
      );
    }
  }
}
