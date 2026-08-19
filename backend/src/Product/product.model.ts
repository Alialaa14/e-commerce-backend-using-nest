import { PrismaService } from '../utils/prisma/prisma.service';

export class ProductModel {
  constructor(private readonly prismaService: PrismaService) {}
  async createProduct(data: {
    name: string;
    description: string;
    media: {
      secure_url: string;
      public_id: string;
    }[];
    brandId: string;
    categoryId: string;
    price: number;
  }) {
    return this.prismaService.prisma.product.create({ data });
  }

  async createProucts(
    data: {
      name: string;
      description: string;
      media: [
        {
          secureUrl: string;
          publicId: string;
          productId: string;
          postition?: number;
        },
      ];
      brandId: string;
      categoryId: string;
      price: number;
    }[],
  ) {
    return this.prismaService.prisma.product.createMany({ data });
  }
}
