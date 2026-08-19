---
name: jwt-refresh-token-strategy
description: JWT access + refresh token authentication with OTP verification for multi-role marketplace. Triggers when working on auth flows, login, registration, token refresh, logout, or session management.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# JWT Refresh Token Strategy — FashionConnect

## Why Refresh Tokens Matter

In single-page and mobile apps, long-lived sessions require a smart token strategy:

- **Access tokens** are short-lived (15 min) and used per-request
- **Refresh tokens** are long-lived (30 days) and used only to get new access tokens
- If access token is stolen, damage is limited to 15 minutes
- Refresh tokens must be single-use (rotated) to prevent reuse attacks

---

## Token Architecture

```
┌─────────────────────────────────────────────────┐
│ User logs in with phone + OTP                   │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ Auth Service issues:                            │
│ • accessToken (15 min) → client memory          │
│ • refreshToken (30 days) → httpOnly cookie      │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ Every 14 min, client uses refresh token to:     │
│ • Get new accessToken                            │
│ • Get new refreshToken (old one is revoked)      │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ On logout: refresh token is revoked in database  │
└─────────────────────────────────────────────────┘
```

---

## Key Differences from Standard JWT

| Feature | Standard JWT | FashionConnect Approach |
|---------|--------------|------------------------|
| Token storage | Client decides | Refresh token in httpOnly cookie |
| Token revocation | None (until expiry) | Database lookup + revocation |
| Token rotation | Manual | Automatic on every refresh |
| User lookup | From token only | From token + database validation |

---

## Token Payload Structure

```typescript
// Access Token Payload (signed with JWT_ACCESS_SECRET)
interface AccessTokenPayload {
  sub: string;           // userId
  phone: string;
  role: UserRole;        // END_USER, BRAND, ADMIN, etc.
  brandId?: string;
  deliveryCompanyId?: string;
  courierId?: string;
  permissions?: string[]; // For sub-admins
  iat: number;
  exp: number;           // 15 minutes
}

// Refresh Token Payload (signed with JWT_REFRESH_SECRET)
interface RefreshTokenPayload {
  sub: string;           // userId
  tokenId: string;       // refresh token ID in DB
  deviceId?: string;
  iat: number;
  exp: number;           // 30 days
}
```

---

## Database Schema (RefreshToken Model)

```prisma
model RefreshToken {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token        String   @unique
  deviceId     String?
  deviceName   String?
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  revokedAt    DateTime?
  isRevoked    Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

---

## Authentication Flow

### 1. Registration Flow

```typescript
// Step 1: User registers with phone + password
// → System creates UNVERIFIED user
// → System sends OTP to phone
// → User cannot login until phone verified

// Step 2: User verifies OTP
// → System marks user as verified
// → System issues access + refresh tokens
// → Refresh token stored in DB with device info
```

### 2. Login Flow

```typescript
// Step 1: User submits phone + password
// → Validate password (bcrypt)
// → Check if user is verified
// → If not verified → send OTP, require 2FA flow
// → If verified → issue tokens

// Step 2: Issue tokens
// → Create refresh token record in DB
// → Return access token in response body
// → Set refresh token in httpOnly cookie
```

### 3. Token Refresh Flow

```typescript
// Step 1: Client calls POST /auth/refresh
// → Read refresh token from httpOnly cookie
// → Verify token signature (JWT_REFRESH_SECRET)
// → Look up token in DB → check isRevoked = false
// → Check expiresAt > now

// Step 2: On valid token:
// → Mark current refresh token as revoked
// → Generate NEW access + refresh token pair
// → Create new refresh token record in DB
// → Update httpOnly cookie with new refresh token

// Step 3: If refresh token is revoked or expired:
// → Clear httpOnly cookie
// → Return 401 → client must redirect to login
```

---

## Security Implementation

### Token Storage

```typescript
// NEVER store tokens in localStorage (XSS risk)
// NEVER store tokens in sessionStorage (tab sharing risk)

// CORRECT: Access token in memory, refresh token in httpOnly cookie
const setCookies = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,           // NOT accessible via JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',       // CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/auth/refresh',    // Only sent to refresh endpoint
  });
};
```

### Token Rotation

```typescript
// CRITICAL: Refresh tokens must be single-use
async refreshTokens(refreshToken: string) {
  // 1. Verify JWT signature
  const payload = this.jwtService.verify(refreshToken, {
    secret: process.env.JWT_REFRESH_SECRET,
  });

  // 2. Look up in database
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  // 3. Validate token status
  if (!tokenRecord || 
      tokenRecord.isRevoked || 
      tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid token');
  }

  // 4. REVOKE old token BEFORE creating new one
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { 
      isRevoked: true,
      revokedAt: new Date(),
    },
  });

  // 5. Create NEW token pair
  // → New refresh token in DB
  // → New access token in response
}
```

### Logout Implementation

```typescript
// Single device logout
async logout(userId: string, refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, token: refreshToken },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}

// Logout from ALL devices
async logoutAllDevices(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { 
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}
```

---

## Role-Based Access Control

```typescript
// Users have SINGLE role (not multiple roles)
// Sub-admins have permissions array

enum UserRole {
  END_USER
  BRAND
  DELIVERY_COMPANY
  COURIER
  ADMIN
  SUB_ADMIN
}

// JWT Payload includes:
// ┌─────────────┬────────────────────────────────┐
// │ Role        │ Permissions                    │
// ├─────────────┼────────────────────────────────┤
// │ END_USER    │ (none - own data only)         │
// │ BRAND       │ (own brand data)               │
// │ ADMIN       │ all permissions                │
// │ SUB_ADMIN   │ permissions array               │
// └─────────────┴────────────────────────────────┘

// Guard implementation:
@Injectable()
export class RolesGuard {
  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!roles) return true;
    
    const user = context.switchToHttp().getRequest().user;
    return roles.includes(user.role);
  }
}
```

---

## OTP Integration

```typescript
// OTP is required for:
// 1. Phone verification during registration
// 2. Login for unverified users
// 3. Password reset flow

// OTP rules:
// • 6 digits numeric
// • Stored HASHED in database
// • Single-use (marked used after verification)
// • Expires in 5 minutes
// • Rate limited per phone (max 3 per 15 minutes)
```

---

## Environment Variables

```env
JWT_ACCESS_SECRET=your-access-token-secret-key
JWT_REFRESH_SECRET=your-refresh-token-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

---

## What NOT To Do

- NEVER store refresh tokens in localStorage or client-side memory
- NEVER use the same secret for access and refresh tokens
- NEVER skip database lookup for refresh token revocation
- NEVER allow refresh token reuse (must rotate)
- NEVER trust user role from request body — always from JWT
- NEVER store OTP codes in plaintext
- NEVER set refresh cookie path="/" (limits security scope)
- NEVER allow infinite session duration — always expire refresh tokens

---

## Auth Checklist

- [ ] Access token short-lived (15 min max)
- [ ] Refresh token long-lived (7-30 days)
- [ ] Refresh tokens stored in database
- [ ] Token rotation implemented (single-use)
- [ ] httpOnly cookie for refresh token
- [ ] Different secrets for access/refresh
- [ ] OTP required for registration
- [ ] Single role per user (not array)
- [ ] Sub-admin permissions in JWT
- [ ] Device tracking in refresh tokens
- [ ] Logout revokes refresh token(s)
