---
name: caching-and-invalidation-strategy
description: Redis caching patterns with proper invalidation for e-commerce. Triggers when implementing product catalog, brand profiles, order history, category pages, or any read-heavy API endpoints.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Caching and Invalidation Strategy — FashionConnect

## Why Caching Strategy Is Critical

E-commerce is read-heavy:
- Product catalog browsed 1000x more than written
- Brand profiles viewed by thousands
- Category pages hit on every navigation

**Without caching:** Database overload, slow pages, poor conversion.
**With wrong invalidation:** Stale prices, sold-out items showing available, wrong stock.

---

## Core Principles

1. **Cache-Aside Pattern** (read-through) for all GET endpoints
2. **Write-Through Invalidation** on mutations
3. **Tag-Based Invalidation** for related data
4. **TTL + Event-Driven** hybrid
5. **Never cache writes** (only reads)
6. **Never cache decrypted sensitive data** (passcodes, tokens, PII)

---

## Cache Keys & Tags

```typescript
// src/common/cache/cache-keys.ts
export const CacheKeys = {
  product: (id: string) => `product:${id}`,
  productDetail: (id: string, locale: string) => `product:${id}:detail:${locale}`,
  productVariants: (productId: string) => `product:${productId}:variants`,
  
  categoryProducts: (categoryId: string, page: number, filters: string) =>
    `category:${categoryId}:products:p${page}:${filters}`,
  searchResults: (query: string, filters: string, page: number) =>
    `search:${hash(query)}:${filters}:p${page}`,
  
  brandProfile: (brandId: string, locale: string) => `brand:${brandId}:profile:${locale}`,
  brandProducts: (brandId: string, page: number) => `brand:${brandId}:products:p${page}`,
  
  userProfile: (userId: string) => `user:${userId}:profile`,
  userCart: (userId: string) => `user:${userId}:cart`,
  userOrders: (userId: string, page: number, status?: string) =>
    `user:${userId}:orders:p${page}:${status || 'all'}`,
  
  orderDetail: (orderId: string) => `order:${orderId}:detail`,
  orderTracking: (orderId: string) => `order:${orderId}:tracking`,
  
  // Tags for bulk invalidation
  TAGS: {
    PRODUCT: (id: string) => `tag:product:${id}`,
    BRAND: (id: string) => `tag:brand:${id}`,
    CATEGORY: (id: string) => `tag:category:${id}`,
    USER: (id: string) => `tag:user:${id}`,
    ORDER: (id: string) => `tag:order:${id}`,
  },
};
```

---

## Cache Service

```typescript
// src/common/cache/cache.service.ts
@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl = 300, tags?: string[]): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await factory();
    if (data) {
      const pipe = this.redis.pipeline();
      pipe.setex(key, ttl, JSON.stringify(data));
      if (tags) for (const tag of tags) pipe.sadd(tag, key);
      await pipe.exec();
    }
    return data;
  }

  async invalidate(key: string): Promise<void> { await this.redis.del(key); }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(tag);
    if (keys.length) {
      const pipe = this.redis.pipeline();
      pipe.del(...keys); pipe.del(tag);
      await pipe.exec();
    }
  }

  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) await this.invalidateByTag(tag);
  }
}
```

---

## Read-Through in Services

```typescript
// src/modules/products/products.service.ts
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  async getProductDetail(id: string, locale: 'ar' | 'en') {
    const key = CacheKeys.productDetail(id, locale);
    const tags = [CacheKeys.TAGS.PRODUCT(id)];
    return this.cache.getOrSet(key, async () => {
      const p = await this.prisma.product.findUnique({
        where: { id, isActive: true },
        include: { variants: { where: { isActive: true } }, category: true, brand: true, media: true },
      });
      if (!p) return null;
      return { ...p, name: locale === 'ar' ? p.nameAr : p.nameEn, category: { ...p.category, name: locale === 'ar' ? p.category.nameAr : p.category.nameEn } };
    }, 300, tags);
  }
}
```

---

## Write-Through Invalidation

```typescript
// src/modules/products/products.service.ts
async updateProduct(id: string, dto: UpdateProductDto, userId: string) {
  await this.validateOwnership(id, userId);
  const product = await this.prisma.product.update({ where: { id }, data: dto });
  await this.invalidateProduct(id);
  return product;
}

private async invalidateProduct(id: string) {
  const product = await this.prisma.product.findUnique({ where: { id }, select: { brandId: true, categoryId: true } });
  const tags = [CacheKeys.TAGS.PRODUCT(id)];
  if (product) tags.push(CacheKeys.TAGS.BRAND(product.brandId), CacheKeys.TAGS.CATEGORY(product.categoryId));
  await this.cache.invalidateTags(tags);
}
```

---

## Brand & Category Invalidation

```typescript
// brands/brands.service.ts
async updateBrand(id: string, dto: UpdateBrandDto) {
  await this.prisma.brand.update({ where: { id }, data: dto });
  await this.cache.invalidateByTag(CacheKeys.TAGS.BRAND(id));
}

// categories/categories.service.ts
async updateCategory(id: string, dto: UpdateCategoryDto) {
  await this.prisma.category.update({ where: { id }, data: dto });
  await this.cache.invalidateByTag(CacheKeys.TAGS.CATEGORY(id));
}
```

---

## Order & Cart Cache

```typescript
// orders/orders.service.ts
async getUserOrders(userId: string, page = 1, status?: string) {
  return this.cache.getOrSet(CacheKeys.userOrders(userId, page, status), async () =>
    this.prisma.order.findMany({ where: { userId, ...(status ? { status } : {}) }, include: { subOrders: { include: { brand: true } } }, orderBy: { createdAt: 'desc' }, skip: (page-1)*20, take: 20 }), 60, [CacheKeys.TAGS.USER(userId)]);
}

async createOrder(userId: string, dto: CreateOrderDto) {
  const order = await this.prisma.$transaction(async (tx) => { /* create order */ });
  await this.cache.invalidateByTag(CacheKeys.TAGS.USER(userId));
  await this.cache.invalidate(CacheKeys.userCart(userId));
  return order;
}
```

---

## Invalidation Map

| Mutation | Tags to Invalidate | Also |
|----------|-------------------|------|
| Product update | `tag:product:{id}`, `tag:brand:{id}`, `tag:category:{id}` | Search results |
| Product delete | Same as update | Brand/category products |
| Brand update | `tag:brand:{id}` | Brand products |
| Category update | `tag:category:{id}` | Category products |
| Order create | `tag:user:{id}` | User cart, user orders |
| Order status change | `tag:order:{id}`, `tag:user:{id}` | Order tracking |
| Cart update | `tag:user:{id}` | Cart detail |

---

## TTL Guidelines

| Data | TTL | Reason |
|------|-----|--------|
| Product detail | 5 min | Price/stock changes infrequently |
| Product variants | 2 min | Stock changes on checkout |
| Search results | 2 min | Filters change often |
| Brand profile | 10 min | Rarely changes |
| Category tree | 15 min | Static structure |
| User profile | 10 min | Rarely changes |
| User orders | 1 min | Recent orders change |
| User cart | 30 sec | Changes on every add/remove |
| Order detail | 2 min | Status updates |
| Order tracking | 30 sec | Real-time delivery |

---

## What NOT To Do

- ❌ NEVER cache write operations
- ❌ NEVER cache without TTL
- ❌ NEVER invalidate only exact key
- ❌ NEVER use `KEYS *` in production
- ❌ NEVER cache user-specific data without user tag
- ❌ NEVER skip invalidation on write
- ❌ NEVER cache with TTL > 1 hour for dynamic data

---

## Caching Checklist

- [ ] All GET endpoints use cache-aside
- [ ] Every cache key has TTL
- [ ] Tag-based invalidation for related data
- [ ] Write operations invalidate in same transaction
- [ ] Product/brand/category updates invalidate correctly
- [ ] Order mutations invalidate user cache
- [ ] Cart mutations invalidate immediately
- [ ] Search results have short TTL (1-2 min)
- [ ] Use `SCAN` not `KEYS` for pattern invalidation
- [ ] Monitor cache hit rate (>80% target)

---

## Related Skills
- bullmq-specialist (async invalidation)
- prisma-patterns (transaction patterns)
- api-contract-standards (response caching headers)
- rate-limiting-redis (cache as rate limit store)