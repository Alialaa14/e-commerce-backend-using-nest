import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BrandDocType } from '../generated/prisma/client';
import { BrandModel } from './brand.model';

@Injectable()
export class BrandDocumentService {
  constructor(private readonly brandModel: BrandModel) {}

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
    const submitted = new Set(
      brand.documents.map((document) => document.docType),
    );

    return {
      verificationStatus: brand.verificationStatus,
      submittedDocuments: brand.documents.map((document) => ({
        docType: document.docType,
        fileUrl: document.fileUrl,
        status: document.status,
        rejectionReason: document.rejectionReason ?? null,
      })),
      missingDocuments: allTypes.filter((type) => !submitted.has(type)),
    };
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
}
