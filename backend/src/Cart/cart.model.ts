import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma/prisma.service';

@Injectable()
export class CartModel {
  constructor(private readonly prismaService: PrismaService) {}

  async createCart(data: { userId: string }) {
    return this.prismaService.prisma.cart.create({
      data,
    });
  }

  async getCartByUserId(userId: string) {
    return this.prismaService.prisma.cart.findFirst({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
        discount: true,
        price: true,
        totalPrice: true,
        cartNote: true,
        userLocation: true,
        userNumber: true,
        products: {
          select: {
            variantId: true,
            quantity: true,
            price: true,
            variant: {
              select: {
                productId: true,
                color: true,
                size: true,
                stock: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    media: true,
                    price: true,
                    discount: true,
                    isDeleted: true,
                    viewCount: true,
                    rating: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async updateCart(
    cartId: string,
    data: {
      price?: number;
      totalPrice?: number;
      cartNote?: string;
      discount?: number;
      userLocation?: string;
      userNumber?: string;
    },
  ) {
    return this.prismaService.prisma.cart.update({
      where: {
        id: cartId,
      },
      data,
    });
  }

  async updateProductsCartCount(
    cartId: string,
    variantId: string,
    type: 'plus' | 'minus',
  ) {
    return this.prismaService.prisma.cartProducts.update({
      where: {
        cartId_variantId: {
          cartId,
          variantId,
        },
      },
      data: {
        quantity:
          type === 'plus'
            ? {
                increment: 1,
              }
            : {
                decrement: 1,
              },
      },
    });
  }
  async clearCart(cartId: string) {
    return this.prismaService.prisma.cart.update({
      where: {
        id: cartId,
      },
      data: {
        discount: 0,
        price: 0,
        totalPrice: 0,
        cartNote: '',
        userLocation: '',
        userNumber: '',
      },
    });
  }

  async createCartProduct(
    cartId: string,
    variantId: string,
    data: { quantity: number; price: number },
  ) {
    return this.prismaService.prisma.cartProducts.create({
      data: {
        cartId,
        variantId,
        quantity: data.quantity,
        price: data.price,
      },
    });
  }
  async getCartProducts(cartId: string) {
    return this.prismaService.prisma.cartProducts.findMany({
      where: {
        cartId,
      },
      select: {
        variantId: true,
        quantity: true,
        price: true,
        variant: {
          select: {
            product: {
              select: {
                brandId: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteCartProduct(cartId: string) {
    return this.prismaService.prisma.cartProducts.deleteMany({
      where: {
        cartId,
      },
    });
  }

  async getCarts(
    paginateOpts: {
      skip: number;
      take: number;
    },
    queryOpts: {
      [key: string]: string;
    },
    // orderBy: {
    //   [key: string]: string;
    // },
  ) {
    return this.prismaService.prisma.cart.findMany({
      skip: paginateOpts.skip,
      take: paginateOpts.take,
      where: {
        ...queryOpts,
      },
      select: {
        products: {
          select: {
            quantity: true,
            price: true,
            variant: {
              select: {
                color: true,
                size: true,
                product: {
                  select: {
                    media: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
      },
      // orderBy,
    });
  }
}
