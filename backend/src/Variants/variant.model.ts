import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';

@Injectable()
export class VariantModel {
  constructor(private readonly prismaService: PrismaService) {}

  async createVariants(
    variant: {
      productId: string;
      sku: string;
      basePrice: number;
      options: { color: string; size: string };
      color: string;
      size: string;
      stock: number;
    }[],
  ) {
    return this.prismaService.prisma.variant.createMany({ data: variant });
  }

  async updateVariant(
    id: string,
    data: {
      productId?: string;
      sku?: string;
      basePrice?: number;
      barcode?: string;
      options?: Record<string, string | number | boolean>;
      isActive?: boolean;
      color?: string;
      size?: string;
      deletedAt?: Date;
      isDeleted?: boolean;
      stock?: { increment?: number; decrement?: number } | number;
    },
  ) {
    return this.prismaService.prisma.variant.update({ where: { id }, data });
  }

  async getVariant(data: { productId: string; color: string; size: string }) {
    return this.prismaService.prisma.variant.findUnique({
      where: {
        productId_color_size: data,
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
            brandId: true,
            isDeleted: true,
            price: true,
          },
        },
        color: true,
        size: true,
        stock: true,
        isDeleted: true,
      },
    });
  }

  async getVariantById(variantId: string) {
    return this.prismaService.prisma.variant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        sku: true,
        basePrice: true,
        barcode: true,
        options: true,
        isActive: true,
        deletedAt: true,
        stock: true,
        size: true,
        color: true,
        isDeleted: true,
        sold: true,
        product: {
          select: {
            id: true,
            name: true,
            brandId: true,
            isDeleted: true,
            deletedAt: true,
            price: true,
          },
        },
      },
    });
  }
}
