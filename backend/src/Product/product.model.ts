import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';
@Injectable()
export class ProductModel {
  constructor(private readonly prismaService: PrismaService) {}

  async getProductById(id: string) {
    return this.prismaService.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        isDeleted: true,
        brand: { select: { userId: true, brandId: true } },
      },
    });
  }

  async softDeleteProduct(id: string) {
    return this.prismaService.prisma.product.update({
      where: { id },
      data: { isDeleted: true, available: false },
      select: { id: true, isDeleted: true, available: true },
    });
  }
  async createProduct(data: {
    name: string;
    description: string;
    brandId: string;
    media: {
      secure_url: string;
      public_id: string;
    }[];
    categoryId: string;
    price: number;
    discount?: number;
    available?: boolean;
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

  async getProductsByBrandId(
    brandId: string,
    paginateOpts: {
      skip: number;
      take: number;
    },
    queryOpts: {
      [key: string]: string;
    },
    orderBy: {
      [key: string]: string;
    },
  ) {
    return this.prismaService.prisma.product.findMany({
      where: {
        brandId,
        ...queryOpts,
      },
      select: {
        id: true,
        name: true,
        description: true,
        media: true,
        price: true,
        discount: true,
        available: true,
        isDeleted: true,
        viewCount: true,
        rating: true,
        category: {
          select: {
            name: true,
          },
        },
        variants: {
          select: {
            color: true,
            size: true,
            stock: true,
          },
        },
      },
      skip: paginateOpts.skip,
      take: paginateOpts.take,
      orderBy,
    });
  }

  async getProductsCategory(
    categId: string,
    paginateOpts: {
      skip: number;
      take: number;
    },
    queryOpts: {
      [key: string]: string;
    },
    orderBy: {
      [key: string]: string;
    },
  ) {
    return this.prismaService.prisma.product.findMany({
      where: {
        categoryId: categId,
        ...queryOpts,
      },
      select: {
        id: true,
        name: true,
        description: true,
        media: true,
        price: true,
        discount: true,
        available: true,
        isDeleted: true,
        viewCount: true,
        rating: true,
        category: {
          select: {
            name: true,
            media: true,
          },
        },
      },
      skip: paginateOpts.skip,
      take: paginateOpts.take,
      orderBy,
    });
  }

  async getProducts(
    paginateOpts: {
      skip: number;
      take: number;
    },
    queryOpts: {
      [key: string]: string;
    },
    orderBy: {
      [key: string]: string;
    },
  ) {
    return this.prismaService.prisma.product.findMany({
      where: {
        ...queryOpts,
      },
      select: {
        id: true,
        name: true,
        description: true,
        media: true,
        price: true,
        discount: true,
        available: true,
        isDeleted: true,
        viewCount: true,
        rating: true,
        category: {
          select: {
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            logoUrl_id: true,
          },
        },
      },
      skip: paginateOpts.skip,
      take: paginateOpts.take,
      orderBy,
    });
  }

  async getProduct(productId: string) {
    return this.prismaService.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true,
        media: true,
        price: true,
        discount: true,
        available: true,
        isDeleted: true,
        viewCount: true,
        rating: true,
        brandId: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async updateProduct(id: string, data: {}) {
    return this.prismaService.prisma.product.update({ where: { id }, data });
  }

  async deleteProduct(id: string) {
    return this.prismaService.prisma.product.delete({ where: { id } });
  }

  async uploadPictures(
    pics: { secure_url: string; public_id: string }[],
    id: string,
  ) {
    this.prismaService.prisma.product.update({
      where: { id },

      data: {
        media: {
          push: pics,
        },
      },
    });
  }
  async deletePictures(
    pics: { secure_url: string; public_id: string }[],
    id: string,
  ) {
    this.prismaService.prisma.product.update({
      where: { id },

      data: {
        media: {
          set: pics,
        },
      },
    });
  }
}
