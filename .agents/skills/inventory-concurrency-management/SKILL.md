---
name: inventory-concurrency-management
description: Inventory concurrency control and overselling prevention patterns for e-commerce. Triggers when implementing cart checkout, stock reservation, cart expiration, admin restocking, or refund processing.
risk: critical
source: fashionconnect-core
date_added: "2026-08-06"
---

# Inventory Concurrency Management — FashionConnect

## Why This Is Critical

Inventory is the only resource that can be oversold by design. Without strict concurrency control:

- **Race condition**: Two users check out the same last item → both orders succeed → inventory goes negative
- **Cart abandonment**: User holds item in cart indefinitely → blocks real buyers
- **Refund race**: Refund restocks while new checkout reserves same item → double-count

**In Egypt**, COD orders mean inventory must be reserved at checkout (not payment), making concurrency even more critical.

---

## Core Principles

1. **Pessimistic locking** for checkout (SELECT FOR UPDATE)
2. **Optimistic locking** for admin updates (version field)
3. **Atomic operations** in single Prisma transaction
4. **Cart TTL** with automatic stock release
5. **Reservation pattern** (reserved + available = total)

---

## Database Schema

```prisma
model Variant {
  id            String   @id @default(uuid())
  productId     String
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku           String   @unique
  color         String
  size          String
  price         Int      // in piasters
  stock         Int      @default(0)      // Available stock
  reservedStock Int      @default(0)      // Reserved in carts/orders
  version       Int      @default(1)      // Optimistic locking
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([productId])
  @@map("variants")
}

model CartItem {
  id        String   @id @default(uuid())
  cartId    String
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId String
  variant   Variant  @relation(fields: [variantId], references: [id])
  quantity  Int
  reservedAt DateTime @default(now())
  expiresAt DateTime // Cart TTL (e.g., 30 min)

  @@unique([cartId, variantId])
  @@index([expiresAt])
  @@map("cart_items")
}
```

---

## Stock Availability

```typescript
// src/modules/inventory/inventory.service.ts
@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getAvailableStock(variantId: string): Promise<number> {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      select: { stock: true, reservedStock: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return Math.max(0, variant.stock - variant.reservedStock);
  }

  async isAvailable(variantId: string, quantity: number): Promise<boolean> {
    return (await this.getAvailableStock(variantId)) >= quantity;
  }
}
```

---

## Checkout: Atomic Stock Reservation

```typescript
// src/modules/checkout/checkout.service.ts
@Injectable()
export class CheckoutService {
  constructor(private prisma: PrismaService) {}

  async reserveStockForCheckout(
    userId: string,
    items: { variantId: string; quantity: number }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock variant rows
      const variants = await tx.$queryRaw<{ id: string; stock: number; reservedStock: number }[]>`
        SELECT id, stock, reserved_stock
        FROM variants
        WHERE id IN (${Prisma.join(items.map(i => i.variantId))})
        FOR UPDATE
      `;

      // 2. Validate availability
      const variantMap = new Map(variants.map(v => [v.id, v]));
      for (const item of items) {
        const v = variantMap.get(item.variantId);
        if (!v) throw new NotFoundException(`Variant ${item.variantId} not found`);
        if (v.stock - v.reservedStock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${item.variantId}`);
        }
      }

      // 3. Increment reservedStock
      for (const item of items) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { reservedStock: { increment: item.quantity } },
        });
      }

      // 4. Create cart items with 30min TTL
      const cart = await this.getOrCreateActiveCart(tx, userId);
      const expiresAt = addMinutes(new Date(), 30);

      for (const item of items) {
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
          update: { quantity: { increment: item.quantity }, expiresAt },
          create: { cartId: cart.id, variantId: item.variantId, quantity: item.quantity, expiresAt },
        });
      }
      return cart;
    });
  }
}
```

---

## Cart Expiration: Auto-Release Stock

```typescript
// src/modules/inventory/inventory-cron.service.ts
@Injectable()
export class InventoryCronService {
  constructor(private prisma: PrismaService) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async releaseExpiredCarts() {
    const expiredItems = await this.prisma.cartItem.findMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (!expiredItems.length) return;

    await this.prisma.$transaction(async (tx) => {
      const releases = new Map<string, number>();
      for (const item of expiredItems) {
        releases.set(item.variantId, (releases.get(item.variantId) || 0) + item.quantity);
      }

      for (const [variantId, qty] of releases) {
        await tx.variant.update({
          where: { id: variantId },
          data: { reservedStock: { decrement: qty } },
        });
      }

      await tx.cartItem.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    });
  }
}
```

---

## Order Completion: Confirm Reservation

```typescript
async confirmOrderReservation(orderId: string) {
  const items = await this.prisma.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  await this.prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stock: { decrement: item.quantity },
          reservedStock: { decrement: item.quantity },
        },
      });
    }
    await tx.cartItem.deleteMany({
      where: { variantId: { in: items.map(i => i.variantId) } },
    });
  });
}
```

---

## Refund/Cancellation: Release Stock

```typescript
async releaseOrderStock(orderId: string) {
  const items = await this.prisma.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  await this.prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
  });
}
```

---

## Admin Restock: Optimistic Locking

```typescript
async adminRestock(variantId: string, quantity: number, expectedVersion: number) {
  return this.prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.version !== expectedVersion) {
      throw new ConflictException('Inventory modified by another admin. Refresh and retry.');
    }

    return tx.variant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity }, version: { increment: 1 } },
    });
  });
}
```

---

## What NOT To Do

- ❌ NEVER check stock then reserve in separate queries (race condition)
- ❌ NEVER use `stock` directly without checking `reservedStock`
- ❌ NEVER skip `FOR UPDATE` in checkout transaction
- ❌ NEVER allow cart items without `expiresAt` TTL
- ❌ NEVER restock without version check (lost updates)
- ❌ NEVER process refund without releasing stock in same transaction
- ❌ NEVER allow negative `reservedStock` (add DB constraint)

---

## Inventory Checklist

- [ ] Variant has `stock` + `reservedStock` + `version`
- [ ] Checkout uses `SELECT FOR UPDATE` + single transaction
- [ ] Cart items have `expiresAt` (30 min TTL)
- [ ] Cron job releases expired carts every 5 minutes
- [ ] Order confirmation moves reserved → sold
- [ ] Cancellation/refund releases stock in same transaction
- [ ] Admin restock uses optimistic locking (version field)
- [ ] DB constraint: `reservedStock >= 0`
- [ ] DB constraint: `stock >= 0`
- [ ] Available = stock - reservedStock (never trust raw stock)

---

## Related Skills
- prisma-patterns (transaction patterns)
- cod-workflow (COD reservation logic)
- ledger-financial-model (financial integrity)
- bullmq-specialist (cron job patterns)