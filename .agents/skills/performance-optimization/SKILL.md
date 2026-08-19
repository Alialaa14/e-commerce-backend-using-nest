---
name: performance-optimization
description: Performance optimization patterns for NestJS/Prisma/Next.js stack. Triggers when optimizing queries, reducing latency, fixing N+1 problems, implementing caching, or addressing performance bottlenecks.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Performance Optimization — FashionConnect

## Why Performance Matters

- **User experience**: 100ms of latency = 1% drop in conversion
- **Cost**: Inefficient queries increase DB/CPU usage → higher hosting costs
- **Scalability**: O(n) operations that should be O(1) break under load

---

## Critical Performance Anti-Patterns

### 1. Missing Database Indexes

#### ❌ WRONG: No index on frequently queried fields

```prisma
model RefreshToken {
  id           String   @id @default(uuid())
  token        String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  
  @@index([userId])
  // ⚠️ Missing: @@index([expiresAt]) for cleanup queries
  @@map("refresh_tokens")
}
```

```typescript
// This query scans the entire RefreshToken table
await prisma.refreshToken.deleteMany({
  where: { expiresAt: { lt: new Date() } }  // ⚠️ Sequential scan without index
});
```

#### ✅ CORRECT: Add indexes for all WHERE clauses

```prisma
model RefreshToken {
  id           String   @id @default(uuid())
  token        String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  
  @@index([userId])
  @@index([expiresAt])  // ✅ For cleanup cron
  @@index([userId, expiresAt])  // ✅ Composite for user-specific cleanup
  @@map("refresh_tokens")
}
```

#### Common Missing Indexes in E-Commerce

```prisma
model Order {
  // ✅ Add indexes for:
  @@index([userId, status])        // User's orders by status
  @@index([status, createdAt])     // Admin dashboard filters
  @@index([createdAt])             // Chronological queries
  @@index([paymentStatus])         // Payment reconciliation
}

model Product {
  // ✅ Add indexes for:
  @@index([brandId, isActive])     // Brand's active products
  @@index([categoryId, isActive])  // Category browsing
  @@index([isActive, createdAt])   // Recent products feed
  @@index([sku])                   // SKU lookups
}

model User {
  // ✅ Add indexes for:
  @@index([role])                  // Admin queries by role
  @@index([verificationStatus])    // Unverified users cleanup
  @@index([createdAt])             // Registration analytics
}
```

---

### 2. `include` vs `select` Over-Fetching

#### ❌ WRONG: Fetching all fields including sensitive data

```typescript
// ❌ Fetches ALL user fields (password, tokens, etc.)
const orders = await prisma.order.findMany({
  where: { userId },
  include: {
    user: true,  // ⚠️ ALL user columns including password hash
    subOrders: {
      include: {
        brand: true,  // ⚠️ ALL brand columns
        items: {
          include: {
            productVariant: {
              include: { product: true }  // ⚠️ ALL product columns
            }
          }
        }
      }
    }
  }
});

// Only uses: user.name, brand.name, product.nameAr/nameEn
// Fetched: 50+ columns per order × 20 orders = 1000+ unnecessary fields
```

#### ✅ CORRECT: Select only required fields

```typescript
// ✅ Select ONLY what you need
const orders = await prisma.order.findMany({
  where: { userId },
  select: {
    id: true,
    status: true,
    total: true,
    createdAt: true,
    user: {
      select: { id: true, name: true, phone: true }  // ✅ Only 3 fields
    },
    subOrders: {
      select: {
        id: true,
        status: true,
        subtotal: true,
        brand: {
          select: { id: true, name: true, logoUrl: true }  // ✅ Only 3 fields
        },
        items: {
          select: {
            quantity: true,
            price: true,
            productVariant: {
              select: {
                id: true,
                size: true,
                color: true,
                product: {
                  select: { nameAr: true, nameEn: true, imageUrl: true }
                }
              }
            }
          }
        }
      }
    }
  }
});
```

**Impact**: Reduces data transfer by 80-90%, speeds up serialization, prevents accidental exposure of sensitive fields.

---

### 3. N+1 Queries (Sequential Awaits in Loops)

#### ❌ WRONG: Sequential DB writes in a loop

```typescript
// ❌ For 50 products: 50 sequential DB writes (takes ~250ms)
for (const productId of productIds) {
  await prisma.product.update({
    where: { id: productId },
    data: { viewCount: { increment: 1 } }
  });
}
```

#### ✅ CORRECT: Batch with `$transaction`

```typescript
// ✅ Single transaction, parallel execution in DB (takes ~10ms)
await prisma.$transaction(
  productIds.map(productId =>
    prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } }
    })
  )
);
```

#### ❌ WRONG: Sequential reads before a write

```typescript
// ❌ 4 sequential DB round-trips (80-120ms)
const product = await prisma.product.findUnique({ where: { id } });      // 1
const brand = await prisma.brand.findUnique({ where: { id: brandId } }); // 2
const category = await prisma.category.findUnique({ where: { id } });    // 3
await prisma.product.update({ where: { id }, data: { ... } });           // 4
```

#### ✅ CORRECT: Parallelize independent reads

```typescript
// ✅ 2 round-trips: parallel reads + write (40-60ms)
const [product, brand, category] = await Promise.all([
  prisma.product.findUnique({ where: { id } }),
  prisma.brand.findUnique({ where: { id: brandId } }),
  prisma.category.findUnique({ where: { id: categoryId } })
]);

await prisma.product.update({ where: { id }, data: { ... } });
```

---

### 4. Double-Fetch Pattern (Read-Then-Write)

#### ❌ WRONG: Explicit check before update

```typescript
// ❌ 2 DB round-trips for authorization check
const order = await prisma.order.findUnique({
  where: { id: orderId },
  select: { userId: true }
});

if (order.userId !== currentUserId) {
  throw new ForbiddenException('Not your order');
}

await prisma.order.update({
  where: { id: orderId },
  data: { status: 'CANCELLED' }
});
```

#### ✅ CORRECT: Let Prisma handle the check atomically

```typescript
// ✅ 1 DB round-trip — update fails if not found or userId mismatch
try {
  await prisma.order.update({
    where: {
      id: orderId,
      userId: currentUserId  // ✅ Atomic authorization check
    },
    data: { status: 'CANCELLED' }
  });
} catch (e) {
  if (e.code === 'P2025') {  // Record not found
    throw new ForbiddenException('Order not found or not yours');
  }
  throw e;
}
```

---

### 5. Sequential I/O Chains

#### ❌ WRONG: Sequential external API calls

```typescript
// ❌ 3 sequential HTTP calls (600-900ms)
const paymentStatus = await paymobClient.getTransactionStatus(txId);
await this.emailService.sendReceipt(user.email, order);
await this.smsService.sendOrderConfirmation(user.phone, order);
```

#### ✅ CORRECT: Parallelize independent I/O

```typescript
// ✅ Parallel execution (200-300ms)
const [paymentStatus] = await Promise.all([
  paymobClient.getTransactionStatus(txId),
  this.emailService.sendReceipt(user.email, order).catch(err => 
    this.logger.error('Email failed', err)
  ),
  this.smsService.sendOrderConfirmation(user.phone, order).catch(err =>
    this.logger.error('SMS failed', err)
  )
]);
```

---

### 6. Singleton vs Per-Request Client Instantiation

#### ❌ WRONG: New HTTP client per request

```typescript
// ❌ Creates new Axios instance + TCP connection pool per call
async sendEmail(to: string, subject: string) {
  const client = axios.create({  // ⚠️ New client every time
    baseURL: 'https://api.resend.com',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }
  });
  return client.post('/emails', { to, subject });
}
```

#### ✅ CORRECT: Singleton HTTP client

```typescript
// ✅ Create once, reuse for all requests
@Injectable()
export class EmailService {
  private readonly client = axios.create({
    baseURL: 'https://api.resend.com',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    timeout: 5000,
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 })
  });

  async sendEmail(to: string, subject: string) {
    return this.client.post('/emails', { to, subject });
  }
}
```

---

### 7. Missing Timeouts on External Calls

#### ❌ WRONG: No timeout (hangs indefinitely)

```typescript
// ❌ If Paymob is slow, this blocks forever
const response = await this.http.post('https://api.paymob.com/...', payload);
```

#### ✅ CORRECT: Always add timeouts

```typescript
// ✅ Fail fast after 5 seconds
const response = await this.http.post(
  'https://api.paymob.com/...',
  payload,
  { timeout: 5000 }
).catch(err => {
  if (err.code === 'ETIMEDOUT') {
    throw new ServiceUnavailableException('Payment gateway timeout');
  }
  throw err;
});
```

---

### 8. Full-Text Search Without Indexes

#### ❌ WRONG: `ILIKE` on unindexed columns

```typescript
// ❌ Sequential scan on 100k+ products
const products = await prisma.product.findMany({
  where: {
    OR: [
      { nameAr: { contains: query, mode: 'insensitive' } },   // ILIKE '%query%'
      { nameEn: { contains: query, mode: 'insensitive' } },   // ILIKE '%query%'
      { descriptionAr: { contains: query, mode: 'insensitive' } }
    ]
  }
});
```

#### ✅ CORRECT: Use PostgreSQL trigram indexes

```sql
-- Migration: add trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX product_name_ar_trgm_idx ON "Product" USING GIN (name_ar gin_trgm_ops);
CREATE INDEX product_name_en_trgm_idx ON "Product" USING GIN (name_en gin_trgm_ops);
CREATE INDEX product_desc_ar_trgm_idx ON "Product" USING GIN (description_ar gin_trgm_ops);
```

```typescript
// ✅ Now ILIKE uses the GIN index (100× faster)
const products = await prisma.product.findMany({
  where: {
    OR: [
      { nameAr: { contains: query, mode: 'insensitive' } },
      { nameEn: { contains: query, mode: 'insensitive' } }
    ]
  }
});
```

---

### 9. Unbounded Queries (No Pagination)

#### ❌ WRONG: Fetching all records

```typescript
// ❌ Returns 10,000+ notifications (OOM risk)
const notifications = await prisma.notification.findMany({
  where: { userId }
});
```

#### ✅ CORRECT: Always paginate

```typescript
// ✅ Cursor-based pagination (most efficient)
async getUserNotifications(userId: string, cursor?: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    take: limit + 1,  // Fetch one extra to check if there's more
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }
  });
}
```

---

### 10. Unused Database Fetches

#### ❌ WRONG: Fetching data that's never used

```typescript
// ❌ Fetches user but never uses it
const user = await prisma.user.findUnique({ where: { id: userId } });

const orders = await prisma.order.findMany({
  where: { userId }
});

return orders;  // ⚠️ `user` is never used
```

#### ✅ CORRECT: Delete unused queries

```typescript
// ✅ Only fetch what you need
const orders = await prisma.order.findMany({
  where: { userId }
});

return orders;
```

---

## Performance Optimization Checklist

### Database Layer
- [ ] All `WHERE` clauses have corresponding indexes
- [ ] Composite indexes for multi-column queries
- [ ] Use `select` instead of `include` for relations
- [ ] Batch updates with `$transaction` instead of loops
- [ ] Parallelize independent queries with `Promise.all`
- [ ] Paginate all list queries (cursor or offset)
- [ ] Add trigram indexes for search fields
- [ ] Cleanup cron for expired/soft-deleted records

### External API Calls
- [ ] HTTP clients are singletons with connection pooling
- [ ] All external calls have timeouts (3-5 seconds)
- [ ] Parallelize independent external calls
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker for unreliable services

### Caching
- [ ] Redis instead of in-memory cache for multi-instance
- [ ] Cache expensive queries (>100ms) with appropriate TTLs
- [ ] Tag-based cache invalidation for related data
- [ ] Cache hit rate monitoring (>80% target)

### NestJS/Fastify
- [ ] Disable request logging in production (`disableRequestLogging: true`)
- [ ] Use `@Cacheable()` decorator for expensive operations
- [ ] ValidationPipe with `transform: false` when possible
- [ ] Compression middleware enabled (`compression()`)

### Next.js Frontend
- [ ] Server Actions for all backend calls (no client-side fetch)
- [ ] `optimizePackageImports` for large libraries
- [ ] Route-level caching with `revalidate`
- [ ] Image optimization with Next.js `<Image>`
- [ ] Parallel data fetching in Server Components

---

## Monitoring & Profiling

### Query Performance
```typescript
// Enable Prisma query logging in development
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'warn' }
  ]
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {  // Log slow queries
    console.warn(`Slow query (${e.duration}ms):`, e.query);
  }
});
```

### Request Tracing
```typescript
// Add request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn(`Slow request: ${req.method} ${req.url} (${duration}ms)`);
    }
  });
  next();
});
```

---

## Related Skills
- prisma-patterns (transaction patterns, query optimization)
- caching-and-invalidation-strategy (Redis patterns)
- nestjs-architecture (module organization, DI optimization)
- nextjs-bff-communication (server actions performance)
