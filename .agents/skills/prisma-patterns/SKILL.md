---
name: prisma-patterns
description: Prisma ORM best practices for FashionConnect. Triggers when writing Prisma queries, database operations, migrations, transactions, or any data access layer code.
---

# Prisma Patterns Skill — FashionConnect

## Core Principles

1. Prisma IS the repository — no extra repository layer needed
2. ALWAYS use `select` to limit returned fields
3. ALWAYS use `$transaction` for multi-table operations
4. Financial data is APPEND-ONLY — never UPDATE financial records
5. Use soft deletes for everything that has business history

## Transaction Pattern

Use `$transaction` for ANY operation that touches more than one table:

```typescript
// ORDER CREATION — must be atomic
async createOrder(userId: string, dto: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.order.create({ data: { userId, ...dto } });

    // 2. Create sub-orders per brand
    for (const item of dto.items) {
      await tx.subOrder.create({
        data: { orderId: order.id, brandId: item.brandId, ... }
      });

      // 3. Deduct inventory
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    // 4. Create ledger entry
    await tx.ledgerEntry.create({
      data: { orderId: order.id, type: 'ORDER_CHARGE', amount: dto.total }
    });

    return order;
  });
}
```

## Soft Delete Pattern

```typescript
// NEVER hard delete products, orders, brands, or financial records
await this.prisma.product.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// Always filter deleted records in queries
await this.prisma.product.findMany({
  where: { deletedAt: null, brandId },
});
```

## Select Pattern — Never Return Raw Records

```typescript
// Define safe select objects as static constants
static readonly SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  // password: false  ← never include
  // refreshTokens: false ← never include by default
};

// Always use select
const user = await this.prisma.user.findUnique({
  where: { id },
  select: UserService.SAFE_SELECT,
});
```

## Pagination Pattern

```typescript
async findAll(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [data, total] = await this.prisma.$transaction([
    this.prisma.product.findMany({
      where: { deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: ProductService.LIST_SELECT,
    }),
    this.prisma.product.count({ where: { deletedAt: null } }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  };
}
```

## Financial Queries — Always Use Decimal

```typescript
import { Decimal } from "@prisma/client/runtime/library";

// CORRECT — use Decimal for all money
const amount = new Decimal("150.50");

// WRONG — never use float for money
const amount = 150.5; // floating point errors!
```

## Relation Loading — Always Explicit

```typescript
// CORRECT — explicit include
const brand = await this.prisma.brand.findUnique({
  where: { id },
  include: {
    products: {
      where: { deletedAt: null },
      take: 10,
    },
    owner: {
      select: { id: true, name: true, email: true }
    }
  }
});

// WRONG — never assume relations are loaded
brand.products.forEach(...) // may throw if not included
```

## Upsert Pattern

```typescript
// For operations that should create-or-update
await this.prisma.brandRanking.upsert({
  where: { brandId },
  create: { brandId, score: initialScore },
  update: { score: newScore, updatedAt: new Date() },
});
```

## Migration Rules

- Migration file naming: descriptive and timestamped (Prisma handles this automatically)
- NEVER edit a migration file after it has been applied to any environment
- For production: always run `prisma migrate deploy` — never `prisma migrate dev`
- For schema changes that affect existing data: write a data migration script separately
- Before merging any schema change: run `prisma validate` and `prisma format`

```bash
# Development
npx prisma migrate dev --name add_cod_risk_score_to_orders

# Production (CI/CD)
npx prisma migrate deploy
```

## Index Guidelines

Add indexes for:

- Foreign keys used in WHERE clauses
- Fields used in ORDER BY with large tables
- Composite indexes for common query patterns

```prisma
model Order {
  id        String   @id
  userId    String
  brandId   String
  status    OrderStatus
  createdAt DateTime @default(now())

  @@index([userId])           // frequent: get orders by user
  @@index([brandId, status])  // frequent: brand sees pending orders
  @@index([createdAt])        // frequent: admin date-range queries
}
```

## What NOT To Do

- NEVER use `prisma.user.update` on financial/ledger tables — append only
- NEVER use raw SQL with string interpolation — use Prisma's parameterized query API
- NEVER return a full record without `select` — always limit fields
- NEVER use `Float` for monetary values — always `Decimal`
- NEVER skip transactions for multi-table writes
- NEVER run `prisma migrate dev` in production
- NEVER include `password` or `refreshToken` in any response select
