import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { STRIPE_CLIENT } from '../stripe/stripe-constants';
import Stripe from 'stripe';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { CheckoutStatus, Prisma } from '../../generated/prisma';

interface StripeCheckoutItem {
  variantId: string;
  name: string;
  quantity: number;
  price: number;
  color?: string;
  size?: string;
}

interface StripeCheckoutShipment {
  branchId: string;
  variants: { variantId: string; quantity: number }[];
  shipmentDetails: { fee: number };
}

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

  private isJsonObject(value: unknown): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getStripeLineItems(
    value: Prisma.JsonValue,
    checkoutId: string,
    expectedTotal: number,
  ): Stripe.Checkout.SessionCreateParams.LineItem[] {
    if (!this.isJsonObject(value)) {
      throw new BadRequestException('Checkout snapshot is invalid');
    }

    const { items, shipments, subtotal, totalPrice, deliveryFee, total } =
      value;
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !Array.isArray(shipments) ||
      shipments.length === 0 ||
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      subtotal < 0 ||
      typeof totalPrice !== 'number' ||
      !Number.isSafeInteger(totalPrice) ||
      totalPrice < 0 ||
      totalPrice > subtotal ||
      typeof deliveryFee !== 'number' ||
      !Number.isSafeInteger(deliveryFee) ||
      deliveryFee < 0 ||
      typeof total !== 'number' ||
      !Number.isSafeInteger(total) ||
      totalPrice + deliveryFee !== total ||
      total !== expectedTotal
    ) {
      throw new BadRequestException('Checkout snapshot is incomplete');
    }

    const checkoutItems = items.map((item): StripeCheckoutItem => {
      if (
        !this.isJsonObject(item) ||
        typeof item.variantId !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.quantity !== 'number' ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        typeof item.price !== 'number' ||
        !Number.isSafeInteger(item.price) ||
        item.price < 0 ||
        (item.color !== undefined && typeof item.color !== 'string') ||
        (item.size !== undefined && typeof item.size !== 'string')
      ) {
        throw new BadRequestException('Checkout item snapshot is invalid');
      }

      return {
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        ...(typeof item.color === 'string' ? { color: item.color } : {}),
        ...(typeof item.size === 'string' ? { size: item.size } : {}),
      };
    });

    const grossSubtotal = checkoutItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    if (grossSubtotal !== subtotal) {
      throw new BadRequestException(
        'Checkout items do not match the saved subtotal',
      );
    }

    const itemByVariant = new Map(
      checkoutItems.map((item) => [item.variantId, item]),
    );
    if (itemByVariant.size !== checkoutItems.length) {
      throw new BadRequestException(
        'Checkout contains duplicate variant items',
      );
    }

    const assignedVariants = new Set<string>();
    const checkoutShipments = shipments.map(
      (shipment): StripeCheckoutShipment => {
        if (
          !this.isJsonObject(shipment) ||
          typeof shipment.branchId !== 'string' ||
          !Array.isArray(shipment.variants) ||
          !this.isJsonObject(shipment.shipmentDetails) ||
          typeof shipment.shipmentDetails.fee !== 'number' ||
          !Number.isSafeInteger(shipment.shipmentDetails.fee) ||
          shipment.shipmentDetails.fee < 0
        ) {
          throw new BadRequestException(
            'Checkout shipment snapshot is invalid',
          );
        }

        const variants = shipment.variants.map((line) => {
          if (
            !this.isJsonObject(line) ||
            typeof line.variantId !== 'string' ||
            typeof line.quantity !== 'number' ||
            !Number.isSafeInteger(line.quantity) ||
            line.quantity < 1
          ) {
            throw new BadRequestException(
              'Checkout shipment item snapshot is invalid',
            );
          }

          const item = itemByVariant.get(line.variantId);
          if (
            !item ||
            item.quantity !== line.quantity ||
            assignedVariants.has(line.variantId)
          ) {
            throw new BadRequestException(
              'Checkout shipment items do not match the order',
            );
          }
          assignedVariants.add(line.variantId);
          return { variantId: line.variantId, quantity: line.quantity };
        });

        if (variants.length === 0) {
          throw new BadRequestException('Checkout shipment has no items');
        }

        return {
          branchId: shipment.branchId,
          variants,
          shipmentDetails: { fee: shipment.shipmentDetails.fee },
        };
      },
    );

    if (
      assignedVariants.size !== checkoutItems.length ||
      checkoutShipments.reduce(
        (sum, shipment) => sum + shipment.shipmentDetails.fee,
        0,
      ) !== deliveryFee
    ) {
      throw new BadRequestException(
        'Checkout shipments do not match the saved totals',
      );
    }

    const merchandiseTotalCents = this.handlingUnitAmount(totalPrice);
    const grossLineCents = checkoutItems.map((item) =>
      this.handlingUnitAmount(item.price * item.quantity),
    );
    const grossTotalCents = grossLineCents.reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const allocatedCents = grossLineCents.map((grossAmount) =>
      grossTotalCents === 0
        ? 0
        : Math.floor((grossAmount * merchandiseTotalCents) / grossTotalCents),
    );
    let remainingCents =
      merchandiseTotalCents -
      allocatedCents.reduce((sum, amount) => sum + amount, 0);
    const remainderOrder = grossLineCents
      .map((grossAmount, index) => ({
        index,
        remainder:
          grossTotalCents === 0
            ? 0
            : (grossAmount * merchandiseTotalCents) % grossTotalCents,
      }))
      .sort((a, b) => b.remainder - a.remainder);
    for (const { index } of remainderOrder) {
      if (remainingCents === 0) break;
      allocatedCents[index]++;
      remainingCents--;
    }

    const productLineItems = checkoutItems.map((item, index) => ({
      quantity: 1,
      price_data: {
        currency: 'egp',
        unit_amount: allocatedCents[index],
        product_data: {
          name: item.name,
          description: [item.color, item.size, `Quantity: ${item.quantity}`]
            .filter(Boolean)
            .join(' / '),
          metadata: { variantId: item.variantId },
        },
      },
    }));
    const deliveryLineItems = checkoutShipments
      .filter((shipment) => shipment.shipmentDetails.fee > 0)
      .map((shipment) => ({
        quantity: 1,
        price_data: {
          currency: 'egp',
          unit_amount: this.handlingUnitAmount(shipment.shipmentDetails.fee),
          product_data: {
            name: 'Delivery fee',
            description: `Delivery fee for branch ${shipment.branchId}`,
          },
        },
      }));
    const lineItems = [...productLineItems, ...deliveryLineItems];
    const stripeTotalCents = lineItems.reduce(
      (sum, item) => sum + item.price_data.unit_amount * item.quantity,
      0,
    );
    if (stripeTotalCents !== this.handlingUnitAmount(total)) {
      throw new BadRequestException(
        `Stripe line items do not match checkout ${checkoutId} total`,
      );
    }

    return lineItems;
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
    const [user, checkoutSession] = await Promise.all([
      this.prismaService.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
      this.prismaService.prisma.checkoutSession.findFirst({
        where: {
          userId,
          status: CheckoutStatus.ready,
          expiresAt: { gt: new Date() },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          total: true,
          addressText: true,
          phoneNumber: true,
          snapshot: true,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!checkoutSession) {
      throw new NotFoundException('Ready checkout session not found');
    }
    if (!checkoutSession.addressText || !checkoutSession.phoneNumber) {
      throw new BadRequestException(
        'Checkout address and phone number are required',
      );
    }
    if (
      checkoutSession.total === null ||
      !Number.isSafeInteger(checkoutSession.total) ||
      checkoutSession.total <= 0
    ) {
      throw new BadRequestException(
        'Checkout session does not have a payable total',
      );
    }
    const lineItems = this.getStripeLineItems(
      checkoutSession.snapshot,
      checkoutSession.id,
      checkoutSession.total,
    );

    const session = await this.stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: lineItems,
      metadata: {
        checkoutId: checkoutSession.id,
        userId,
      },
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
      payment_method_types: ['card'],
    });

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
