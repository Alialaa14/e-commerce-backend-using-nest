import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import Stripe from 'stripe';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { Prisma, User } from '../../generated/prisma';

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prismaService: PrismaService,
  ) {}

  private toStripeImages(value: Prisma.JsonValue | null): string[] {
    let data: Prisma.JsonValue | null = value;

    // handle the case where it was stored as a JSON string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as Prisma.JsonValue;
      } catch {
        data = [data];
      }
    }

    if (!Array.isArray(data)) return [];

    return data
      .map((media) =>
        typeof media === 'string'
          ? media
          : (media as { url?: string } | null)?.url,
      )
      .filter(
        (url): url is string =>
          typeof url === 'string' && /^https?:\/\//.test(url),
      )
      .slice(0, 8);
  }
  private handlingUnitAmount(value: number): number {
    return Math.round(value * 100);
  }

  private async santizeLineItems(userId: string) {
    const getUser = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cart: {
          include: {
            products: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return getUser?.cart?.products?.map((product) => {
      return {
        quantity: product.quantity,

        price_data: {
          currency: 'egp',
          unit_amount: this.handlingUnitAmount(product.price),
          product_data: {
            name: product.variant.product.name,
            description: product.variant.product.description,
            images: this.toStripeImages(product.variant.product.media),
            unit_label: product.variantId.substring(0, 12),
          },
        },
      };
    });
  }
  async createCheckout(userId: string): Promise<any> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cart: {
          include: {
            products: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.cart) throw new NotFoundException('User not found');

    if (user.cart.products.length === 0)
      throw new NotFoundException('Cart is empty');
    const lineItems = await this.santizeLineItems(userId);
    const session = await this.stripe.checkout.sessions.create({
      /*
      todo: discounts , customer stripe id after finishing the setup payment Intent , reciept
      */

      customer_email: user?.email,
      line_items: lineItems,
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
      payment_method_types: ['card'],
    });

    // todo : save the chcekout session into database to return it later
    return session;
  }

  async updateCheckout(
    userId: string,
    checkoutId: string,
    metadata: { [key: string]: string },
  ): Promise<any> {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      include: {
        cart: {
          include: {
            products: {
              include: {
                variant: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.cart) throw new NotFoundException('User not found');

    if (user.cart.products.length === 0)
      throw new NotFoundException('Cart is empty');
    const lineItems = await this.santizeLineItems(userId);
    const session = await this.stripe.checkout.sessions.update(checkoutId, {
      line_items: lineItems,
      metadata,
    });

    //todo : update the checkout in the database if i am storing some of checkout info
    return session;
  }

  async getCheckout(checkoutId: string): Promise<any> {
    return this.stripe.checkout.sessions.retrieve(checkoutId);
  }
}
