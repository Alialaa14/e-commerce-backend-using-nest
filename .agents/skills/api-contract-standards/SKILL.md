---
name: api-contract-standards
description: API contract and OpenAPI documentation standards for FashionConnect. Triggers when writing controllers, route handlers, DTOs, response types, or Swagger documentation.
---

# API Contract Standards Skill — FashionConnect

## Core API Rules

- ALL APIs are versioned: `/api/v1/`
- ALL protected routes require `JwtAuthGuard`
- ALL routes have Swagger decorators — CI enforces OpenAPI spec match
- ALL responses follow the standard format below
- NEVER change a response shape without updating the OpenAPI spec

## Standard Response Format

```typescript
// Success — single resource
{
  "data": { ...resource },
  "message": "Brand retrieved successfully",
  "statusCode": 200
}

// Success — created resource
{
  "data": { ...newResource },
  "message": "Brand created successfully",
  "statusCode": 201
}

// Success — list with pagination
{
  "data": [ ...items ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  },
  "statusCode": 200
}

// Success — action with no body
{
  "message": "Brand suspended successfully",
  "statusCode": 200
}

// Error (handled automatically by global exception filter)
{
  "error": "NOT_FOUND",
  "message": "Brand with id abc123 not found",
  "statusCode": 404,
  "timestamp": "2026-08-05T17:00:00.000Z",
  "path": "/api/v1/brands/abc123"
}
```

## HTTP Status Codes

```
200 OK           → GET success, PATCH success, DELETE success, action success
201 Created      → POST success (resource created)
400 Bad Request  → Invalid input, validation failure, business rule violation
401 Unauthorized → Missing or invalid JWT token
403 Forbidden    → Valid token but insufficient role/permission
404 Not Found    → Resource does not exist
409 Conflict     → Resource already exists (e.g., duplicate email, brand already registered)
422 Unprocessable Entity → Valid format but business logic rejection
429 Too Many Requests    → Rate limit exceeded
500 Internal Server Error → Unexpected server error (never expose stack traces)
```

## Required Swagger Decorators

Every controller method MUST have these:

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get brand by ID', description: 'Returns a brand profile with its verification status' })
@ApiParam({ name: 'id', description: 'Brand UUID', type: String })
@ApiResponse({ status: 200, description: 'Brand found', type: BrandResponseDto })
@ApiResponse({ status: 404, description: 'Brand not found' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiBearerAuth()
async findOne(@Param('id') id: string): Promise<BrandResponseDto> {
  return this.brandService.findOne(id);
}
```

Every controller class MUST have:

```typescript
@ApiTags('brands')  // groups in Swagger UI
@ApiBearerAuth()    // if protected
```

## Pagination Query DTO

```typescript
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

## Filter/Search Query Pattern

```typescript
export class BrandQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;
}
```

## Global Exception Filter (Reference)

```typescript
// This is already registered globally — don't catch exceptions manually
// Just throw NestJS built-in exceptions:
throw new NotFoundException("Brand not found");
throw new BadRequestException("Invalid COD amount");
throw new ForbiddenException("Access denied to this brand");
throw new ConflictException("Email already registered");
throw new UnauthorizedException("Invalid or expired token");
```

## OpenAPI CI Enforcement

The CI job `swagger_check` runs on every PR:

```bash
npm run build:openapi   # regenerates docs/openapi.yaml
git diff --exit-code docs/openapi.yaml  # fails PR if spec doesn't match code
```

**Always run `npm run build:openapi` before committing if you changed any route, DTO, or response shape.**

## API Versioning Strategy

Current: v1 only
When breaking changes happen:

- Create `/api/v2/` routes
- Keep v1 running for 6 months with deprecation header
- Document breaking changes in `CHANGELOG.md`

## What NOT To Do

- NEVER return raw Prisma model — always map through response DTO
- NEVER skip `@ApiResponse` decorators — spec enforcement will fail CI
- NEVER return stack traces in error responses
- NEVER use `any` type in DTOs or response types
- NEVER return passwords, tokens, or sensitive fields in any response
- NEVER create endpoints without input validation DTOs
- NEVER commit without regenerating OpenAPI spec if routes changed
