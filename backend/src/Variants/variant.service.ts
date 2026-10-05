import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { VariantModel } from './variant.model';
import { ProductModel } from '../Product/product.model';
import { randomUUID } from 'node:crypto';
import { updateVariantDto } from './dto/update-variant-dto';
@Injectable()
export class VariantService {
  constructor(
    private readonly variantModel: VariantModel,
    private readonly productModel: ProductModel,
  ) {}

  async createVariants(
    productId: string,
    variants: { size: string; color: string; stock: number }[],
  ) {
    const product = await this.productModel.getProduct(productId);
    if (!product) throw new Error('Product not found');
    if (product.isDeleted) throw new Error('Product is deleted');

    if (
      product.variants.find(
        (v) => v.color === variants[0].color && v.size === variants[0].size,
      )
    )
      throw new Error('Variant already exists');

    const combinedData = variants.map((variant) => ({
      productId,
      sku: `SKU-${randomUUID()}`,
      basePrice: product.price,
      options: { color: variant.color, size: variant.size },
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
    }));
    return this.variantModel.createVariants(combinedData);
  }
  async createVariant(
    variant: {
      productId: string;
      color: string;
      size: string;
      stock: number;
    },
    brandId?: string | null,
    allowGlobalAdmin = false,
  ) {
    const product = await this.productModel.getCatalogProduct(
      variant.productId,
    );
    if (
      !product ||
      (!allowGlobalAdmin && (!brandId || product.brandId !== brandId))
    ) {
      throw new NotFoundException('Product not found');
    }
    if (
      product.variants.find(
        (v) => v.color === variant.color && v.size === variant.size,
      )
    )
      throw new BadRequestException('Variant already exists');
    return this.variantModel.createVariants([
      {
        ...variant,
        sku: `SKU-${randomUUID()}`,
        basePrice: product.price,
        options: { color: variant.color, size: variant.size },
      },
    ]);
  }

  async updateVariant(
    variantId: string,
    data: Parameters<VariantModel['updateVariant']>[1],
    brandId?: string | null,
    allowGlobalAdmin = false,
  ) {
    const variant = await this.variantModel.getVariantById(variantId);
    if (
      !variant ||
      variant.isDeleted ||
      variant.deletedAt ||
      variant.product.isDeleted ||
      variant.product.deletedAt ||
      (!allowGlobalAdmin && (!brandId || variant.product.brandId !== brandId))
    ) {
      throw new NotFoundException('Variant not found');
    }
    return this.variantModel.updateVariant(variantId, data);
  }

  async updateVariantById(
    variantId: string,
    data: updateVariantDto,
    brandId?: string | null,
    allowGlobalAdmin = false,
  ) {
    const variant = await this.variantModel.getVariantById(variantId);
    if (
      !variant ||
      variant.isDeleted ||
      variant.deletedAt ||
      variant.product.isDeleted ||
      variant.product.deletedAt ||
      (!allowGlobalAdmin && (!brandId || variant.product.brandId !== brandId))
    ) {
      throw new NotFoundException('Variant not found');
    }

    if (data.productId) {
      const targetProduct = await this.productModel.getCatalogProduct(
        data.productId,
      );
      if (!targetProduct || targetProduct.brandId !== variant.product.brandId) {
        throw new NotFoundException('Variant not found');
      }
    }

    let updated: Awaited<ReturnType<VariantModel['updateVariant']>>;
    try {
      updated = await this.variantModel.updateVariant(variantId, {
        ...(data.productId !== undefined ? { productId: data.productId } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
        ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
        ...(data.options !== undefined ? { options: data.options } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.size !== undefined ? { size: data.size } : {}),
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A catalog identifier already exists');
      }
      throw error;
    }
    return {
      id: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      basePrice: Number(updated.basePrice),
      barcode: updated.barcode,
      options: updated.options,
      isActive: updated.isActive,
    };
  }

  async softDeleteVariantById(
    variantId: string,
    brandId?: string | null,
    allowGlobalAdmin = false,
  ) {
    const variant = await this.variantModel.getVariantById(variantId);
    if (
      !variant ||
      variant.isDeleted ||
      variant.deletedAt ||
      variant.product.isDeleted ||
      variant.product.deletedAt ||
      (!allowGlobalAdmin && (!brandId || variant.product.brandId !== brandId))
    ) {
      throw new NotFoundException('Variant not found');
    }
    await this.variantModel.updateVariant(variantId, {
      deletedAt: new Date(),
      isDeleted: true,
      isActive: false,
    });
    return { id: variantId };
  }

  async getVariant(productId: string, color: string, size: string) {
    return this.variantModel.getVariant({ productId, color, size });
  }

  async getVariantByid(
    variantId: string,
    brandId?: string | null,
    allowGlobalAdmin = false,
  ) {
    const variant = await this.variantModel.getVariantById(variantId);
    if (
      !variant ||
      variant.isDeleted ||
      variant.deletedAt ||
      variant.product.isDeleted ||
      variant.product.deletedAt ||
      (!allowGlobalAdmin && (!brandId || variant.product.brandId !== brandId))
    ) {
      throw new NotFoundException('Variant not found');
    }
    return {
      id: variant.id,
      productId: variant.product.id,
      sku: variant.sku,
      basePrice: Number(variant.basePrice),
      barcode: variant.barcode,
      options: variant.options,
      isActive: variant.isActive,
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
    };
  }

  // todo: stock movement model in database and add their controllers (display stock movement history of Variant)
}
