import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { CartService } from '../Cart/cart.service';
import { VariantService } from '../Variants/variant.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { buildCartHash } from '../utils/buildHash';
import { CheckoutStatus, orderStatus, Prisma } from '../generated/prisma';
import { Coordinates, LocationService } from '../Location/location.service';
import { BrandBranchService } from '../BrandBranch/brandBranch.service';
import { InventoryService } from '../Inventory/inventory.service';

const SESSION_TTL_MS = 30 * 60 * 1000;
const Active = [CheckoutStatus.ready, CheckoutStatus.pending];

interface CheckoutItemSnapshot {
  variantId: string;
  name: string;
  quantity: number;
  price: number;
}

interface CheckoutShipmentSnapshot {
  branchId: string;
  variants: { variantId: string; quantity: number }[];
  shipmentDetails: { fee: number; duration: number };
}

interface CheckoutOrderSnapshot {
  items: CheckoutItemSnapshot[];
  subtotal: number;
  totalPrice: number;
  shipments: CheckoutShipmentSnapshot[];
  deliveryFee: number;
  total: number;
}

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCheckoutSnapshot(value: Prisma.JsonValue): CheckoutOrderSnapshot {
  if (!isJsonObject(value)) {
    throw new BadRequestException('Checkout snapshot is invalid');
  }

  const itemsValue = value.items;
  const shipmentsValue = value.shipments;
  if (!Array.isArray(itemsValue) || !Array.isArray(shipmentsValue)) {
    throw new BadRequestException('Checkout snapshot is incomplete');
  }

  const items = itemsValue.map((item): CheckoutItemSnapshot => {
    if (
      !isJsonObject(item) ||
      typeof item.variantId !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.quantity !== 'number' ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      typeof item.price !== 'number' ||
      !Number.isSafeInteger(item.price) ||
      item.price < 0
    ) {
      throw new BadRequestException('Checkout item snapshot is invalid');
    }

    return {
      variantId: item.variantId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    };
  });

  const shipments = shipmentsValue.map((shipment): CheckoutShipmentSnapshot => {
    if (
      !isJsonObject(shipment) ||
      typeof shipment.branchId !== 'string' ||
      !Array.isArray(shipment.variants) ||
      !isJsonObject(shipment.shipmentDetails) ||
      typeof shipment.shipmentDetails.fee !== 'number' ||
      !Number.isSafeInteger(shipment.shipmentDetails.fee) ||
      shipment.shipmentDetails.fee < 0 ||
      typeof shipment.shipmentDetails.duration !== 'number' ||
      !Number.isSafeInteger(shipment.shipmentDetails.duration) ||
      shipment.shipmentDetails.duration < 0
    ) {
      throw new BadRequestException('Checkout shipment snapshot is invalid');
    }

    const variants = shipment.variants.map((line) => {
      if (
        !isJsonObject(line) ||
        typeof line.variantId !== 'string' ||
        typeof line.quantity !== 'number' ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1
      ) {
        throw new BadRequestException(
          'Checkout shipment item snapshot is invalid',
        );
      }

      return { variantId: line.variantId, quantity: line.quantity };
    });

    if (variants.length === 0) {
      throw new BadRequestException('Checkout shipment has no items');
    }

    return {
      branchId: shipment.branchId,
      variants,
      shipmentDetails: {
        fee: shipment.shipmentDetails.fee,
        duration: shipment.shipmentDetails.duration,
      },
    };
  });
  if (shipments.length === 0) {
    throw new BadRequestException('Checkout snapshot has no shipments');
  }

  const subtotal = value.subtotal;
  const totalPrice = value.totalPrice;
  const deliveryFee = value.deliveryFee;
  const total = value.total;
  if (
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
    total < 0
  ) {
    throw new BadRequestException('Checkout totals are invalid');
  }

  return { items, subtotal, totalPrice, shipments, deliveryFee, total };
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly CartService: CartService,
    private readonly variantService: VariantService,
    private readonly prismaService: PrismaService,
    private readonly locationService: LocationService,
    private readonly brandBranchService: BrandBranchService,
    private readonly inventoryService: InventoryService,
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

  private combineMatchingProducts(
    matchingProducts: {
      branchId: string;
      lang: number;
      lat: number;
      variants: { variantId: string; quantity: number }[];
    }[], // sorted nearest first, each entry lists only the lines that branch covers in full
    products: { variantId: string; quantity: number }[],
  ) {
    // keep only branches that cover at least one ordered line
    const branches = matchingProducts.filter((b) => b.variants.length > 0);

    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const first = branches[i]; // nearer branch
        const second = branches[j];

        const firstIds = new Set(first.variants.map((v) => v.variantId));
        const secondIds = new Set(second.variants.map((v) => v.variantId));

        // together they must cover every ordered variant
        const coversOrder = products.every(
          (line) =>
            firstIds.has(line.variantId) || secondIds.has(line.variantId),
        );
        if (!coversOrder) continue;

        // each ordered line goes to exactly one branch: the nearer one if it can cover it
        const fromFirst = products.filter((line) =>
          firstIds.has(line.variantId),
        );
        const fromSecond = products.filter(
          (line) => !firstIds.has(line.variantId),
        );

        // both must ship something; otherwise the first branch alone has everything
        if (fromFirst.length === 0 || fromSecond.length === 0) continue;

        return [
          {
            branchId: first.branchId,
            variants: fromFirst,
            lang: first.lang,
            lat: first.lat,
          },
          {
            branchId: second.branchId,
            variants: fromSecond,
            lang: second.lang,
            lat: second.lat,
          },
        ];
      }
    }

    return null; // no pair of branches covers the order
  }
  private async getFulfilledNearestBranch(
    nearestBranches: {
      id: string;
      brandId: string;
      isActive: boolean;
      latitude: number;
      longitude: number;
    }[],
    products: { variantId: string; quantity: number }[],
  ) {
    // get the nearest branches that have all the products and if one has one push to array with the product that it has
    // but after the loop if its no branch has all the products return the array thats the matches
    // array with matching products if no branch has all the products
    let matchingProducts: {
      branchId: string;
      lat: number;
      lang: number;
      variants: { variantId: string; quantity: number }[];
    }[] = [];
    let branchHasAllProducts = null;
    for (let i = 0; i < nearestBranches.length; i++) {
      let hasAllProducts = true;
      const availableVariants: { variantId: string; quantity: number }[] = [];

      // get the inventory of the branch
      for (let j = 0; j < products.length; j++) {
        const stockAvailable =
          await this.inventoryService.getBranchVariantStock(
            nearestBranches[i].id,
            products[j].variantId,
          );

        if (stockAvailable.available >= products[j].quantity) {
          availableVariants.push({
            variantId: products[j].variantId,
            quantity: products[j].quantity,
          });
        } else {
          hasAllProducts = false;
        }
      }
      if (hasAllProducts) {
        branchHasAllProducts = nearestBranches[i];
        break;
      }

      if (availableVariants.length > 0) {
        matchingProducts.push({
          branchId: nearestBranches[i].id,
          lat: nearestBranches[i].latitude,
          lang: nearestBranches[i].longitude,
          variants: availableVariants,
        });
      }
    }

    if (!branchHasAllProducts) {
      return this.combineMatchingProducts(matchingProducts, products);
    }

    return [
      {
        branchId: branchHasAllProducts.id,
        variants: products,
        lat: branchHasAllProducts.latitude,
        lang: branchHasAllProducts.longitude,
      },
    ];
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
        phoneNumber: cart.userNumber,
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

      if (
        session.status !== CheckoutStatus.pending &&
        session.status !== CheckoutStatus.ready
      ) {
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
      const nearestBranchs = await this.locationService.getNearestBranches(
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

      // now i will get the nearest branches that have all the products
      const getBranchesThatHasProducts = await this.getFulfilledNearestBranch(
        nearestBranchs,
        cart.products,
      );

      if (!getBranchesThatHasProducts?.length) {
        throw new BadRequestException('No branches can fulfill the cart items');
      }

      const shipments = await Promise.all(
        getBranchesThatHasProducts.map(async (branch) => {
          const shipmentDistanceDetails =
            await this.locationService.getDirections(location, {
              latitude: branch.lat,
              longitude: branch.lang,
            });
          // calculate fee (todo : make costPerKm dynamic)
          const fee = this.locationService.calculateDeliveryCost(
            shipmentDistanceDetails.distance,
            2,
          );

          return {
            branchId: branch.branchId,
            variants: branch.variants,
            shipmentDetails: {
              distance: shipmentDistanceDetails.distance,
              duration: shipmentDistanceDetails.duration,
              fee,
            },
          };
        }),
      );

      const deliveryFee = shipments.reduce(
        (total, shipment) => total + shipment.shipmentDetails.fee,
        0,
      );
      const total = cart.totalPrice + deliveryFee;
      const timeEstimation = new Date(
        Date.now() +
          Math.max(
            ...shipments.map((shipment) => shipment.shipmentDetails.duration),
          ) *
            24 *
            60 *
            60 *
            1000,
      );
      const sessionSnapshot =
        session.snapshot &&
        typeof session.snapshot === 'object' &&
        !Array.isArray(session.snapshot)
          ? session.snapshot
          : {};
      const snapshot = {
        ...sessionSnapshot,
        location: { latitude, longitude },
        addressText,
        phoneNumber: cart.userNumber,
        shipments,
        deliveryFee,
        total,
      } satisfies Prisma.InputJsonObject;

      const { count } = await db.updateMany({
        where: {
          id: session.id,
          userId,
          status: { in: Active },
          expiresAt: { gt: new Date() },
        },
        data: {
          status: CheckoutStatus.ready,
          addressLat: latitude,
          addressLng: longitude,
          addressText,
          phoneNumber: cart.userNumber,
          brandBranchId: shipments.length === 1 ? shipments[0].branchId : null,
          deliveryFee,
          timeEstimation,
          total,
          snapshot,
        },
      });

      if (count !== 1) {
        throw new ConflictException({ code: 'CHECKOUT_NOT_ACTIVE' });
      }

      return { shipments, addressText };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async placeOrder(checkoutId: string, userId: string) {
    return this.prismaService.prisma.$transaction(async (tx) => {
      const session = await tx.checkoutSession.findFirst({
        where: { id: checkoutId, userId },
      });
      if (!session) throw new NotFoundException('Checkout session not found');

      if (session.status === CheckoutStatus.placed) {
        const existingOrder = await tx.parentOrder.findUnique({
          where: { checkoutId: session.id },
          include: { branchOrders: { include: { orderItems: true } } },
        });
        if (!existingOrder) {
          throw new ConflictException('Placed checkout has no order');
        }
        return existingOrder;
      }

      if (session.status !== CheckoutStatus.ready) {
        throw new ConflictException({ code: 'CHECKOUT_NOT_READY' });
      }
      if (!session.addressText || !session.phoneNumber) {
        throw new BadRequestException(
          'Checkout address and phone number are required',
        );
      }

      const snapshot = parseCheckoutSnapshot(session.snapshot);
      if (
        session.total === null ||
        session.deliveryFee === null ||
        snapshot.total !== session.total ||
        snapshot.deliveryFee !== session.deliveryFee ||
        snapshot.totalPrice + snapshot.deliveryFee !== session.total
      ) {
        throw new BadRequestException('Checkout totals do not match');
      }

      const itemsByVariant = new Map(
        snapshot.items.map((item) => [item.variantId, item]),
      );
      if (itemsByVariant.size !== snapshot.items.length) {
        throw new BadRequestException(
          'Checkout contains duplicate variant items',
        );
      }

      const assignedQuantities = new Map<string, number>();
      const branchOrderInputs = snapshot.shipments.map((shipment, index) => {
        const branchItems = shipment.variants.map((line) => {
          const item = itemsByVariant.get(line.variantId);
          if (!item || item.quantity !== line.quantity) {
            throw new BadRequestException(
              'Checkout shipment items do not match the order',
            );
          }
          if (assignedQuantities.has(line.variantId)) {
            throw new BadRequestException(
              'Checkout item is assigned to multiple shipments',
            );
          }
          assignedQuantities.set(line.variantId, line.quantity);
          return item;
        });

        const subtotal = branchItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        return {
          shipment,
          subtotal,
          discountShare: 0,
          items: branchItems,
        };
      });

      if (
        assignedQuantities.size !== snapshot.items.length ||
        snapshot.items.some(
          (item) => assignedQuantities.get(item.variantId) !== item.quantity,
        ) ||
        branchOrderInputs.reduce((sum, branch) => sum + branch.subtotal, 0) !==
          snapshot.subtotal ||
        branchOrderInputs.reduce(
          (sum, branch) => sum + branch.shipment.shipmentDetails.fee,
          0,
        ) !== snapshot.deliveryFee
      ) {
        throw new BadRequestException(
          'Checkout shipments do not match the order totals',
        );
      }

      let remainingDiscount = snapshot.subtotal - snapshot.totalPrice;
      for (let index = 0; index < branchOrderInputs.length; index++) {
        const branch = branchOrderInputs[index];
        const discountShare =
          index === branchOrderInputs.length - 1
            ? remainingDiscount
            : snapshot.subtotal === 0
              ? 0
              : Math.floor(
                  ((snapshot.subtotal - snapshot.totalPrice) *
                    branch.subtotal) /
                    snapshot.subtotal,
                );
        branch.discountShare = discountShare;
        remainingDiscount -= discountShare;
      }

      const variants = await tx.variant.findMany({
        where: {
          id: { in: snapshot.items.map((item) => item.variantId) },
        },
        select: { id: true, sku: true },
      });
      const skuByVariant = new Map(
        variants.map((variant) => [variant.id, variant.sku]),
      );
      if (skuByVariant.size !== snapshot.items.length) {
        throw new BadRequestException(
          'A checkout product variant no longer exists',
        );
      }

      const { count } = await tx.checkoutSession.updateMany({
        where: {
          id: session.id,
          userId,
          status: CheckoutStatus.ready,
        },
        data: { status: CheckoutStatus.placed },
      });
      if (count !== 1) {
        throw new ConflictException({ code: 'CHECKOUT_NOT_READY' });
      }

      return tx.parentOrder.create({
        data: {
          userId,
          status: orderStatus.ordering,
          otp: randomInt(100_000, 1_000_000).toString(),
          price: snapshot.subtotal,
          deliveryPrice: snapshot.deliveryFee,
          totalPrice: snapshot.total,
          address: session.addressText,
          phoneNumber: session.phoneNumber,
          checkoutId: session.id,
          branchOrders: {
            create: branchOrderInputs.map(
              ({ shipment, subtotal, discountShare, items }) => ({
                brandId: session.brandId,
                brandBranchId: shipment.branchId,
                status: orderStatus.ordering,
                subtotal,
                deliveryFee: shipment.shipmentDetails.fee,
                discountShare,
                total: subtotal - discountShare + shipment.shipmentDetails.fee,
                etaAt: session.timeEstimation,
                orderItems: {
                  create: items.map((item) => {
                    const sku = skuByVariant.get(item.variantId);
                    if (!sku) {
                      throw new BadRequestException(
                        'A checkout product variant has no SKU',
                      );
                    }
                    return {
                      variantId: item.variantId,
                      nameSnapshot: item.name,
                      skuSnapshot: sku,
                      priceSnapshot: item.price,
                      quantity: item.quantity,
                    };
                  }),
                },
              }),
            ),
          },
        },
        include: { branchOrders: { include: { orderItems: true } } },
      });
    });
  }
}
