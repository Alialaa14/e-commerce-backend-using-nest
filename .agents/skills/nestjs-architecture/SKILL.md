---
name: nestjs-architecture
description: NestJS modular monolith architecture patterns for FashionConnect. Triggers when writing NestJS modules, controllers, services, DTOs, guards, or any backend code for the platform.
---

# NestJS Architecture Skill — FashionConnect

## Module Structure

Every feature follows this exact structure:

```
src/
└── modules/
    └── {feature}/
        ├── {feature}.module.ts
        ├── {feature}.controller.ts
        ├── {feature}.service.ts
        ├── dto/
        │   ├── create-{feature}.dto.ts
        │   ├── update-{feature}.dto.ts
        │   └── {feature}-response.dto.ts
        └── entities/
            └── {feature}.entity.ts (if needed)
```

## Controller Rules

- Controllers are THIN — only handle HTTP in/out
- Extract userId from JWT, NEVER from request body: `@GetUser() user: User`
- Apply guards at controller or method level: `@UseGuards(JwtAuthGuard, RolesGuard)`
- Apply role decorators: `@Roles(UserRole.ADMIN, UserRole.BRAND)`
- Apply Swagger decorators on EVERY method: `@ApiOperation`, `@ApiResponse`, `@ApiTags`
- Return service result directly — no business logic in controllers

```typescript
@Controller("api/v1/brands")
@ApiTags("brands")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @Roles(UserRole.BRAND)
  @ApiOperation({ summary: "Create brand profile" })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  create(@GetUser() user: User, @Body() dto: CreateBrandDto) {
    return this.brandService.create(user.id, dto);
  }
}
```

## Service Rules

- ALL business logic lives in services
- Inject PrismaService — never use repository pattern, Prisma IS the repository
- Use `this.prisma.$transaction()` for all multi-table operations
- Throw `NotFoundException`, `BadRequestException`, `ForbiddenException` — never return raw errors
- Always check ownership before mutations: verify `userId === resource.ownerId`
- Log all admin actions using `AuditLogService`

```typescript
@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(userId: string, dto: CreateBrandDto): Promise<BrandResponseDto> {
    const existing = await this.prisma.brand.findFirst({ where: { userId } });
    if (existing)
      throw new ConflictException("Brand already exists for this user");

    const brand = await this.prisma.brand.create({
      data: { ...dto, userId, verificationStatus: "PENDING" },
      select: BrandService.SAFE_SELECT,
    });
    return brand;
  }
}
```

## DTO Rules

- EVERY DTO uses `class-validator` decorators — no exceptions
- EVERY input DTO uses `@IsString()`, `@IsEmail()`, `@IsEnum()`, etc.
- EVERY optional field uses `@IsOptional()` before the type validator
- EVERY DTO is documented with `@ApiProperty()` or `@ApiPropertyOptional()`
- Response DTOs use `@Expose()` and `@Exclude()` from `class-transformer`

```typescript
export class CreateBrandDto {
  @ApiProperty({ example: "My Brand Name" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
```

## Response Format

ALL endpoints return this format:

```json
// Success
{ "data": {...}, "message": "Brand created successfully", "statusCode": 201 }

// List
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }, "statusCode": 200 }

// Error (handled by global exception filter)
{ "error": "NOT_FOUND", "message": "Brand not found", "statusCode": 404 }
```

## URL Convention

```
GET    /api/v1/brands          → list brands
POST   /api/v1/brands          → create brand
GET    /api/v1/brands/:id      → get brand by id
PATCH  /api/v1/brands/:id      → partial update
DELETE /api/v1/brands/:id      → soft delete

GET    /api/v1/brands/:id/products      → nested resource
POST   /api/v1/brands/:id/verify        → action on resource
```

## Module Registration

```typescript
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService], // only export if needed by other modules
})
export class BrandModule {}
```

## What NOT To Do

- NEVER put business logic in controllers
- NEVER use `req.body.userId` — always get from JWT via `@GetUser()`
- NEVER return Prisma model directly — always use a `select` or map to DTO
- NEVER catch and swallow exceptions — let the global filter handle them
- NEVER create a module without registering it in `AppModule`
- NEVER skip Swagger decorators — the OpenAPI spec is enforced in CI
