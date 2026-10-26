import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { CartService } from '../Cart/cart.service';
import { VariantService } from '../Variants/variant.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { buildCartHash } from '../utils/buildHash';
import { CheckoutStatus, Prisma } from '../generated/prisma';
import { Coordinates, LocationService } from '../Location/location.service';
import { BrandBranchService } from '../BrandBranch/brandBranch.service';

const SESSION_TTL_MS = 30 * 60 * 1000;
const Active = [CheckoutStatus.ready, CheckoutStatus.pending];

@Injectable()
export class CheckoutService {
  constructor(
    private readonly CartService: CartService,
    private readonly variantService: VariantService,
    private readonly prismaService: PrismaService,
    private readonly locationService: LocationService,
    private readonly brandBranchService: BrandBranchService,
  ) {}

  // ---------------------------------------------------------------
  // Session: refresh the user's active session in place, or create one
  // ---------------------------------------------------------------
  private async createOrRefreshCheckoutSession(
    userId: string,
    brandId: string,
    input: {
      cartHash: string;
      snapshot: Prisma.InputJsonValue;
    },
  ) {
    const data = {
      cartHash: input.cartHash,
      snapshot: input.snapshot,
      brandId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      status: CheckoutStatus.pending,
      total: null,
    };
    const db = this.prismaService.prisma.checkoutSession;

    // close expired active sessions
    await db.updateMany({
      where: { userId, status: { in: Active }, expiresAt: { lt: new Date() } },
      data: { status: CheckoutStatus.expired },
    });

    const existing = await db.findFirst({
      where: { userId, status: { in: Active } },
    });

    if (existing) {
      // conditional refresh: cannot overwrite a session that was just placed
      const { count } = await db.updateMany({
        where: { id: existing.id, status: { in: Active } },
        data,
      });
      if (count === 1) {
        return db.findUniqueOrThrow({ where: { id: existing.id } });
      }
    }

    try {
      return await db.create({ data: { userId, ...data } });
    } catch (e) {
      // race: another request created the active session first
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await db.findFirstOrThrow({
          where: { userId, status: { in: Active } },
        });
        await db.updateMany({
          where: { id: winner.id, status: { in: Active } },
          data,
        });
        return db.findUniqueOrThrow({ where: { id: winner.id } });
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------
  // Start checkout
  // ---------------------------------------------------------------
  async checkout(userId: string) {
    try {
      const cart = await this.CartService.getCart(userId);
      if (!cart || cart.products.length === 0)
        throw new NotFoundException('Cart not found');

      // products active or not
      const hasProductsDeleted = cart.products
        .map((item) => item.variant.product)
        .some((item) => item.isDeleted === true);
      if (hasProductsDeleted) {
        throw new BadRequestException('Product is deleted');
      }

      // variants active or not
      const isVariantsNotActive = cart.products
        .map((item) => item.variant)
        .some((item) => item.isActive !== true);
      if (isVariantsNotActive) {
        throw new BadRequestException('Variant is not active');
      }

      // the cart is single-brand and carries its brandId
      const brandId = cart.brandId;
      if (!brandId) {
        throw new BadRequestException('Cart has no brand');
      }

      // variant availability
      await Promise.all(
        cart.products.map(async (variant) => {
          const variantAvailabilty =
            await this.variantService.checkOnVariantAvailability(
              variant.variantId,
            );

          if (variantAvailabilty.totalAvailable === 0) {
            throw new BadRequestException('Product is Out Of Stock');
          }
          if (variant.quantity > variantAvailabilty.totalAvailable) {
            throw new BadRequestException(
              `${variant.variant.product.name} with ${variant.variant.color} , ${variant.variant.size} is ${variantAvailabilty.totalAvailable} In Stock Only`,
            );
          }
        }),
      );

      const cartHash = buildCartHash(
        cart.products.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );

      const snapshot = {
        items: cart.products.map((item) => ({
          variantId: item.variantId,
          name: item.variant.product.name,
          color: item.variant.color,
          size: item.variant.size,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: cart.price,
        totalPrice: cart.totalPrice,
        discount: cart.discount,
      };

      const checkoutSession = await this.createOrRefreshCheckoutSession(
        userId,
        brandId,
        { cartHash, snapshot },
      );

      return {
        success: true,
        message: 'Checkout started',
        data: {
          checkoutId: checkoutSession.id,
          expiresAt: checkoutSession.expiresAt,
          products: cart.products,
          subtotal: cart.price,
          totalPrice: cart.totalPrice,
          note: cart.cartNote,
          discount: cart.discount,
          userLocation: cart.userLocation,
          userNumber: cart.userNumber,
          userId: cart.userId,
        },
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  // ---------------------------------------------------------------
  // Address step: guard, nearest branch, reverse geocode
  // ---------------------------------------------------------------
  async placeLocation(
    checkoutId: string,
    userId: string,
    location: {
      latitude: number;
      longitude: number;
    },
  ) {
    // 1. coordinates (free check first)
    const { latitude, longitude } = location;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException('Invalid location');
    }

    try {
      // 2. load the session (owner only), then check status and expiry separately
      const db = this.prismaService.prisma.checkoutSession;
      const session = await db.findFirst({ where: { id: checkoutId, userId } });
      if (!session) throw new NotFoundException('Checkout session not found');

      if (!Active.includes(session.status)) {
        throw new ConflictException({ code: 'CHECKOUT_NOT_ACTIVE' });
      }
      if (session.expiresAt < new Date()) {
        await db.updateMany({
          where: { id: session.id, status: { in: Active } },
          data: { status: CheckoutStatus.expired },
        });
        throw new GoneException({ code: 'CHECKOUT_EXPIRED' });
      }
      if (!session.brandId) {
        throw new BadRequestException('Session has no brand');
      }

      // 3. cart must still match the session
      const cart = await this.CartService.getCart(userId);
      const currentHash = buildCartHash(
        cart.products.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );
      if (currentHash !== session.cartHash) {
        throw new ConflictException({ code: 'CART_CHANGED' });
      }

      // 4. nearest branch
      const nearestBranch = await this.locationService.getNearestBranches(
        location,
        session.brandId,
      );

      // 5. reverse geocode AFTER a branch was found; never fail checkout on it
      let addressText: string | null = null;
      try {
        const { formattedAddress } = await this.locationService.reverseGeocode({
          latitude,
          longitude,
        });
        addressText = formattedAddress;
      } catch (e) {
        console.log('reverseGeocode failed', e);
      }

      // next: fee/ETA, then a conditional updateMany to save
      return { nearestBranch, addressText };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
