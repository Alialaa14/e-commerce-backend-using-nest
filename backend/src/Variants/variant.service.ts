import { Injectable } from '@nestjs/common';
import { VariantModel } from './variant.model';

@Injectable()
export class VariantService {
  constructor(private readonly variantModel: VariantModel) {}

  async createVariants(
    variants: {
      productId: string;
      color: string;
      size: string;
      stock: number;
    }[],
  ) {
    return this.variantModel.createVariants(variants);
  }
}
