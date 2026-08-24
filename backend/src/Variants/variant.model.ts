import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';

@Injectable()
export class VariantModel {
  constructor(private readonly prismaService: PrismaService) {}

  async createVariants(
    variants: {
      productId: string;
      color: string;
      size: string;
      stock: number;
    }[],
  ) {
    return this.prismaService.prisma.variant.createMany({ data: variants });
  }
}
