---
name: security-checklist
description: Security standards and checklist for FashionConnect. Triggers when writing authentication, authorization, input validation, admin operations, financial operations, or any security-sensitive code.
---

# Security Checklist Skill — FashionConnect

## Input Validation — Every Endpoint

```typescript
// NEVER access req.body directly without a validated DTO
// CORRECT: all input comes through class-validator DTOs
@Post('register')
async register(@Body() dto: RegisterUserDto) { ... }

// class-validator ensures data is safe before reaching the service
export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number'
  })
  password: string;

  @IsPhoneNumber('EG')  // Egyptian phone numbers
  phone: string;
}
```

## Authentication Rules

```typescript
// ALWAYS extract userId from JWT — NEVER from request body
// WRONG:
const userId = req.body.userId;

// CORRECT:
@GetUser() user: User  // custom decorator that reads from JWT
// OR
const userId = req.user.id;  // set by JwtAuthGuard

// JWT payload should contain:
interface JwtPayload {
  sub: string;      // userId
  role: UserRole;   // single role
  permissions: string[];  // array of permission strings for sub-admins
  iat: number;
  exp: number;
}
```

## Rate Limiting — Apply To Auth Endpoints

```typescript
// Apply rate limiting to all auth-related routes
// Use Redis-backed rate limiter for distributed environments

@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } })  // 5 attempts per minute
async login(@Body() dto: LoginDto) { ... }

@Post('otp/send')
@Throttle({ default: { limit: 3, ttl: 900000 } })  // 3 OTP sends per 15 minutes
async sendOtp(@Body() dto: SendOtpDto) { ... }
```

## Admin Action Audit Logging

```typescript
// EVERY admin action must create an audit log — no exceptions
async suspendBrand(adminId: string, brandId: string, reason: string) {
  await this.prisma.$transaction(async (tx) => {
    // 1. Perform the action
    await tx.brand.update({
      where: { id: brandId },
      data: { verificationStatus: 'SUSPENDED', suspendedAt: new Date() }
    });

    // 2. ALWAYS create audit log
    await tx.adminAction.create({
      data: {
        adminId,
        action: 'BRAND_SUSPENDED',
        targetType: 'BRAND',
        targetId: brandId,
        reason,
        metadata: { brandId, suspendedAt: new Date() },
        ipAddress: this.requestContext.ip,  // capture request context
      }
    });
  });
}
```

## Financial Operation Logging

```typescript
// Any mutation to financial data requires an audit entry
// This includes: payouts, refunds, adjustments, ledger corrections

async processManualAdjustment(adminId: string, dto: ManualAdjustmentDto) {
  await this.prisma.$transaction(async (tx) => {
    // 1. Create ledger entry
    await tx.ledgerEntry.create({ data: { ...dto, type: 'MANUAL_ADJUSTMENT' } });

    // 2. Audit log with full context
    await tx.adminAction.create({
      data: {
        adminId,
        action: 'MANUAL_FINANCIAL_ADJUSTMENT',
        targetType: 'LEDGER',
        amount: dto.amount,
        reason: dto.reason,
        metadata: { brandId: dto.brandId, orderId: dto.orderId }
      }
    });
  });
}
```

## Password & Token Security

```typescript
// ALWAYS hash passwords with bcrypt (min 12 rounds)
const hashedPassword = await bcrypt.hash(password, 12);

// NEVER log or expose:
// - passwords (even hashed)
// - JWT tokens
// - OTP codes
// - Paymob API keys
// - Database connection strings

// OTP must be:
// - 6 digits numeric
// - single-use (mark as used after verification)
// - expire in 5 minutes
// - rate limited (max 3 per 15 min per phone)
// - stored HASHED (bcrypt or SHA-256)
// - verification attempts limited (max 10 per OTP)
// - rate limited per email/phone (max 10 attempts per 15 min)

// Refresh tokens must be:
// - revocable (stored in DB with status field)
// - device-scoped (deviceId in JWT claims)
// - rotated on use (old token invalidated, new issued)

// Encryption keys:
// - NEVER use fallback keys — fail fast if ENCRYPTION_KEY missing
// - NEVER store decrypted sensitive data in cache
```

## File Upload Security

```typescript
// NEVER accept files without validation
// Check: type, size, extension, magic bytes

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
  throw new BadRequestException("Only JPEG, PNG, and WebP images are allowed");
}

if (file.size > MAX_IMAGE_SIZE) {
  throw new BadRequestException("File size must not exceed 5MB");
}
```

## SQL Injection Prevention

```typescript
// Prisma prevents SQL injection automatically for standard queries
// SAFE:
const user = await prisma.user.findUnique({ where: { email: userInput } });

// DANGER — if using raw SQL, ALWAYS use parameterized queries:
// WRONG:
await prisma.$queryRaw`SELECT * FROM users WHERE email = '${userInput}'`;

// CORRECT:
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`;
// Prisma automatically parameterizes template literal values
```

## HTTP Security Headers

```typescript
// In main.ts — these must be present
app.use(helmet()); // sets security headers
app.use(compression()); // gzip compression
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true,
});
```

## OWASP Top 10 — Quick Checklist

```
✅ A01 Broken Access Control     → RBAC with JwtAuthGuard + RolesGuard on all protected routes
✅ A02 Cryptographic Failures     → bcrypt for passwords, HTTPS only, no secrets in logs
✅ A03 Injection                  → Prisma parameterized queries, class-validator on all inputs
✅ A04 Insecure Design            → Append-only ledger, dual auth for payouts, audit logs
✅ A05 Security Misconfiguration  → helmet(), CORS whitelist, no debug in production
✅ A06 Vulnerable Components      → Snyk scanning in CI (Student Pack)
✅ A07 Auth Failures              → Rate limiting on auth, OTP expiry, refresh token rotation
✅ A08 Software Integrity         → Package lock files committed, Snyk advisory alerts
✅ A09 Logging Failures           → Pino structured logs, audit log table, no sensitive data logged
✅ A10 SSRF                       → Validate all external URLs before fetching
```

## What NOT To Do

- NEVER log passwords, tokens, OTPs, or API keys — use `***` in logs
- NEVER trust data from request body for userId — always use JWT
- NEVER skip rate limiting on login, OTP, and password reset endpoints
- NEVER create admin operations without audit log entries
- NEVER return stack traces in API error responses
- NEVER store secrets in code or .env files committed to Git — use Doppler
- NEVER allow file uploads without type and size validation
- NEVER use raw string interpolation in SQL queries
- NEVER hardcode database passwords in docker-compose.yml — use Docker secrets
- NEVER expose database ports to host network in production
- NEVER set connection timeout to 0 (enables DoS)
- NEVER use fallback encryption keys — fail fast if ENCRYPTION_KEY missing
- NEVER store decrypted sensitive data (passcodes, tokens) in cache
- NEVER commit .env or credential files to Git
- NEVER skip ValidationPipe on admin mutation endpoints
- NEVER use IP-only rate limiting — add per-user/per-phone limits
- NEVER run without Docker network isolation in production
