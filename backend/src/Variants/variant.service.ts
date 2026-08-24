import {
  forwardRef,
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { VariantModel } from './variant.model';
import { ProductModel } from '../Product/product.model';
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
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
    }));
    return this.variantModel.createVariants(combinedData);
  }
  async createVariant(variant: {
    productId: string;
    color: string;
    size: string;
    stock: number;
  }) {
    const product = await this.productModel.getProduct(variant.productId);
    if (!product) throw new Error('Product not found');
    if (product.isDeleted) throw new NotFoundException('Product is deleted');
    if (
      product.variants.find(
        (v) => v.color === variant.color && v.size === variant.size,
      )
    )
      throw new BadRequestException('Variant already exists');
    return this.variantModel.createVariants([variant]);
  }

  async updateVariant(
    variantData: { productId: string; color: string; size: string },
    data: {},
  ) {
    const variant = await this.variantModel.getVariant(variantData);
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.isDeleted) throw new NotFoundException('Variant is deleted');
    if (variant.product.isDeleted)
      throw new NotFoundException('Product is deleted');
    return this.variantModel.updateVariant(variant.id, data);
  }

  async getVariant(productId: string, color: string, size: string) {
    return this.variantModel.getVariant({ productId, color, size });
  }

  async getVariantByid(variantId: string) {
    const variant = await this.variantModel.getVariantById(variantId);
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  // todo: stock movement model in database and add their controllers (display stock movement history of Variant)
}
