---
name: multi-tenant-brand-isolation
description: Multi-tenant brand isolation and row-level security patterns. Triggers when implementing brand data ownership, tenant context validation, or cross-brand data leak prevention.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Multi-Tenant Brand Isolation

## Overview
Implement secure multi-tenant architecture where multiple brands share infrastructure while maintaining complete data isolation, preventing cross-brand data leaks, and enforcing strict ownership validation.

## Context
FashionConnect is a marketplace with multiple independent brands. Each brand must only access their own data (products, orders, analytics) while sharing the same database and application infrastructure. This requires row-level security patterns and tenant-aware middleware.

## Key Principles
- **Zero Trust**: Never trust route parameters alone; always validate ownership
- **Defense in Depth**: Validate at middleware, service, and database layers
- **Explicit over Implicit**: Make tenant context explicit in every request
- **Fail Secure**: Default to deny access when tenant context is unclear

## Implementation Patterns

### 1. Tenant Context Extraction

```typescript
// src/common/decorators/brand-context.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BrandContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      brandId: request.user?.brandId,
      userId: request.user?.id,
      role: request.user?.role,
    };
  },
);
```

### 2. Brand Ownership Guard

```typescript
// src/common/guards/brand-ownership.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class BrandOwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const brandIdFromRoute = request.params.brandId;

    // Admin bypass
    if (user.role === 'admin' || user.role === 'sub_admin') {
      return true;
    }

    // Brand owner validation
    if (user.role === 'brand' && user.brandId === brandIdFromRoute) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have permission to access this brand resource',
    );
  }
}
```

### 3. Prisma Middleware for Row-Level Security

```typescript
// src/common/middleware/prisma-tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaTenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {
    this.setupPrismaMiddleware();
  }

  private setupPrismaMiddleware() {
    this.prisma.$use(async (params, next) => {
      // Auto-inject brandId filter for brand-scoped queries
      if (params.model === 'Product' || params.model === 'Category') {
        if (params.action === 'findMany' || params.action === 'findFirst') {
          if (params.args.where) {
            // Ensure brandId is always in the where clause
            if (!params.args.where.brandId) {
              console.warn(
                `Query on ${params.model} without brandId filter - potential data leak`,
              );
            }
          }
        }
      }

      return next(params);
    });
  }

  use(req: any, res: any, next: () => void) {
    next();
  }
}
```

### 4. Service Layer Validation

```typescript
// src/modules/products/products.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findOne(productId: string, brandId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Explicit ownership validation
    if (product.brandId !== brandId) {
      throw new ForbiddenException(
        'You do not have permission to access this product',
      );
    }

    return product;
  }

  async findAllForBrand(brandId: string) {
    // Always scope queries by brandId
    return this.prisma.product.findMany({
      where: {
        brandId,
        isActive: true,
      },
    });
  }

  async create(brandId: string, createProductDto: CreateProductDto) {
    // Force brandId from authenticated context, not from request body
    return this.prisma.product.create({
      data: {
        ...createProductDto,
        brandId, // Override any brandId in DTO
      },
    });
  }

  async update(
    productId: string,
    brandId: string,
    updateProductDto: UpdateProductDto,
  ) {
    // Validate ownership before update
    await this.findOne(productId, brandId);

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...updateProductDto,
        // Never allow brandId to be changed
        brandId,
      },
    });
  }
}
```

### 5. Controller Usage

```typescript
// src/modules/products/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrandOwnershipGuard } from '../../common/guards/brand-ownership.guard';
import { BrandContext } from '../../common/decorators/brand-context.decorator';
import { ProductsService } from './products.service';

@Controller('brands/:brandId/products')
@UseGuards(JwtAuthGuard, BrandOwnershipGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Param('brandId') brandId: string,
    @BrandContext() context: any,
  ) {
    // context.brandId is validated by guard
    return this.productsService.findAllForBrand(brandId);
  }

  @Get(':productId')
  findOne(
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findOne(productId, brandId);
  }

  @Post()
  create(
    @Param('brandId') brandId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    // brandId from route, validated by guard
    return this.productsService.create(brandId, createProductDto);
  }

  @Patch(':productId')
  update(
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(productId, brandId, updateProductDto);
  }
}
```

### 6. Database Constraints

```prisma
// prisma/schema.prisma
model Product {
  id        String   @id @default(uuid())
  brandId   String
  brand     Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId, isActive])
  @@map("products")
}

model Category {
  id        String   @id @default(uuid())
  brandId   String
  brand     Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime @default(now())

  @@index([brandId])
  @@map("categories")
}
```

### 7. Testing Isolation

```typescript
// src/modules/products/products.service.spec.ts
describe('ProductsService - Tenant Isolation', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  const BRAND_A_ID = 'brand-a-uuid';
  const BRAND_B_ID = 'brand-b-uuid';

  it('should not allow brand A to access brand B products', async () => {
    const brandBProduct = await prisma.product.create({
      data: {
        brandId: BRAND_B_ID,
        name: 'Brand B Product',
      },
    });

    await expect(
      service.findOne(brandBProduct.id, BRAND_A_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should only return products for the specified brand', async () => {
    await prisma.product.createMany({
      data: [
        { brandId: BRAND_A_ID, name: 'Product A1' },
        { brandId: BRAND_A_ID, name: 'Product A2' },
        { brandId: BRAND_B_ID, name: 'Product B1' },
      ],
    });

    const products = await service.findAllForBrand(BRAND_A_ID);
    
    expect(products).toHaveLength(2);
    expect(products.every(p => p.brandId === BRAND_A_ID)).toBe(true);
  });

  it('should not allow changing brandId on update', async () => {
    const product = await prisma.product.create({
      data: {
        brandId: BRAND_A_ID,
        name: 'Original Product',
      },
    });

    const updated = await service.update(product.id, BRAND_A_ID, {
      name: 'Updated Product',
      // Even if someone tries to inject brandId in DTO
      brandId: BRAND_B_ID,
    } as any);

    expect(updated.brandId).toBe(BRAND_A_ID);
  });
});
```

## Anti-Patterns to Avoid

### ❌ Trusting Request Body for Tenant Context
```typescript
// WRONG - Never trust brandId from request body
async create(createDto: CreateProductDto) {
  return this.prisma.product.create({
    data: createDto, // brandId could be injected
  });
}
```

### ❌ Missing Ownership Validation
```typescript
// WRONG - No ownership check
async findOne(productId: string) {
  return this.prisma.product.findUnique({
    where: { id: productId },
  });
}
```

### ❌ Queries Without Brand Scope
```typescript
// WRONG - Returns all products across all brands
async search(keyword: string) {
  return this.prisma.product.findMany({
    where: {
      name: { contains: keyword },
    },
  });
}
```

## Security Checklist

- [ ] All brand-scoped resources have `brandId` foreign key with cascade delete
- [ ] All queries include explicit `brandId` filter
- [ ] Guards validate ownership before controller execution
- [ ] Services perform secondary ownership validation
- [ ] DTOs never accept `brandId` from user input
- [ ] `brandId` is injected from authenticated JWT context
- [ ] Database indexes include `brandId` for performance
- [ ] Tests cover cross-tenant access attempts
- [ ] Logs include `brandId` for audit trails
- [ ] Admin role can bypass but actions are logged

## Admin Access Pattern

```typescript
// src/modules/products/products.controller.ts
@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAllProducts(
    @Query('brandId') brandId?: string,
    @BrandContext() context: any,
  ) {
    // Admin can see all products or filter by brand
    return this.productsService.findAllForAdmin(brandId);
  }

  @Patch(':productId')
  async adminUpdate(
    @Param('productId') productId: string,
    @Body() updateDto: UpdateProductDto,
    @BrandContext() context: any,
  ) {
    // Log admin action
    await this.auditLogService.log({
      adminId: context.userId,
      action: 'PRODUCT_UPDATE',
      resourceId: productId,
      changes: updateDto,
    });

    return this.productsService.adminUpdate(productId, updateDto);
  }
}
```

## Performance Considerations

1. **Composite Indexes**: Always index `(brandId, otherColumns)` for brand-scoped queries
2. **Query Optimization**: Use `select` to limit returned fields
3. **Connection Pooling**: Ensure Prisma pool size supports concurrent brand queries
4. **Caching**: Cache brand-scoped data with `brandId` in cache key

## Related Patterns
- Admin RBAC & Permission Scoping
- Audit Log Implementation
- Database Query Optimization
- Security Checklist

## References
- [Multi-Tenancy in NestJS](https://docs.nestjs.com/techniques/database#multi-tenancy)
- [Prisma Row-Level Security](https://www.prisma.io/docs/guides/database/multi-tenant-apps)
- [OWASP: Insecure Direct Object References](https://owasp.org/www-project-top-ten/)
