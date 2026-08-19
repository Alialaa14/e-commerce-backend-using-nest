---
name: rate-limiting-redis
description: Redis-backed rate limiting for authentication endpoints, OTP abuse prevention, and DDoS protection. Triggers when implementing auth, OTP, login, or any endpoint requiring request throttling.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Rate Limiting with Redis — FashionConnect

## Why Rate Limiting Is Critical

FashionConnect handles sensitive operations that need protection:

- **OTP sends**: Cost money, prevent abuse
- **Logins**: Brute-force attack protection
- **Registrations**: Bot account prevention
- **API endpoints**: DDoS and abuse prevention

---

## Rate Limiting Strategies

### 1. Token Bucket (API Throttling)
Good for: General API rate limiting (requests per minute per user)

```typescript
// User: 100 requests per minute
// Bucket refills at 100/min, capacity 100
// Burst up to 100, then 1.67 req/sec
```

### 2. Fixed Window Counter (OTP Limits)
Good for: OTP sends, registration attempts

```typescript
// Phone: 3 OTP sends per 15 minutes
// Resets at fixed 15-min interval
// Easy to implement, slight unfairness at window edges
```

### 3. Sliding Window Log (Security Critical)
Good for: Login attempts, suspicious activity detection

```typescript
// IP: 5 login attempts per 60 seconds
// Rolling window, most accurate
// Tracks individual request timestamps
```

---

## Egyptian Market Considerations

### OTP Rate Limits (SMS Costs)
- **3 OTP sends per 15 minutes** per phone number
- **5 OTP sends per hour** max
- **3 verification attempts** per OTP (prevent guessing)

### Login Protection
- **5 login attempts per minute** per IP (DDoS protection)
- **10 login attempts per hour** per phone (brute force protection)
- **IP ban** after 20 failed attempts (1 hour duration)

### Registration Limits
- **3 registrations per hour** per IP
- **1 registration per phone** per 24 hours

---

## Redis Key Patterns

```typescript
// Pattern: rate_limit:{type}:{identifier}
// Examples:
// rate_limit:otp:+201012345678    (3 per 15min)
// rate_limit:login_ip:192.168.1.1  (5 per 1min)
// rate_limit:login_phone:+2010...   (10 per 1hr)
// rate_limit:register:192.168.1.1  (3 per 1hr)

// Key TTL matches window duration
// e.g., OTP limit: TTL = 900 seconds (15 min)
```

---

## Implementation Pattern

### NestJS Guard Approach

```typescript
@RateLimit({
  key: 'otp_send',
  ttl: 900,        // 15 minutes in seconds
  limit: 3,        // 3 attempts
  identifier: 'phone'  // Use phone number as key
})
@Post('otp/send')
async sendOtp(@Body() dto: SendOtpDto) {
  // Rate limiter runs BEFORE controller
  // If limit exceeded → 429 Too Many Requests
}
```

### Decorator-Based Limits

```typescript
@RateLimit({
  key: 'login',
  ttl: 60,
  limit: 5,
  identifier: 'ip'
})
@RateLimit({
  key: 'login_phone',
  ttl: 3600,
  limit: 10,
  identifier: 'body.phone'
})
@Post('login')
async login(@Body() dto: LoginDto) {
  // Dual limiting: per-IP + per-phone
}
```

---

## Critical Endpoints & Their Limits

| Endpoint | Limit Type | Window | Max Requests | Identifier |
|----------|------------|--------|--------------|------------|
| POST /otp/send | OTP abuse | 15 min | 3 | Phone number |
| POST /otp/send | Hourly cap | 1 hour | 5 | Phone number |
| POST /otp/verify | OTP brute force | 15 min | 10 | Phone number |
| POST /auth/login | Brute force | 1 min | 5 | IP address |
| POST /auth/login | Account theft | 1 hour | 10 | Phone number |
| POST /auth/register | Bot prevention | 1 hour | 3 | IP address |
| POST /auth/register | Reuse prevention | 24 hours | 1 | Phone number |
| GET /api/* (all) | DDoS protection | 1 min | 100 | User ID |
| GET /api/* (all) | Unauth DDoS | 1 min | 20 | IP address |
| POST /admin/* | Admin actions | 1 min | 20 | User ID |

---

## Redis Implementation

### Basic Counter Pattern

```typescript
async checkRateLimit(key: string, limit: number, ttl: number): Promise<boolean> {
  const current = await redis.get(key);
  
  if (current && parseInt(current, 10) >= limit) {
    return false; // Rate limited
  }

  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, ttl);
  await multi.exec();

  return true; // Allowed
}
```

### Sliding Window (Advanced)

```typescript
async slidingWindow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart.toString());

  // Count current requests
  const count = await redis.zcard(key);

  if (count >= limit) {
    return false; // Rate limited
  }

  // Add current request with timestamp
  await redis.zadd(key, now.toString(), `${now}-${Math.random()}`);
  await redis.pexpire(key, windowSeconds * 1000);

  return true; // Allowed
}
```

---

## OTP Abuse Prevention

```typescript
// BEFORE sending OTP:
// 1. Check phone limit (3 per 15 min)
// 2. Check hourly limit (5 per hour)
// 3. Check if recent OTP still valid

async canSendOtp(phone: string): Promise<{ allowed: boolean; message?: string }> {
  const phoneKey = `otp_limit:${phone}`;
  
  // Check 15-minute limit
  const recent = await redis.get(phoneKey);
  if (recent && parseInt(recent, 10) >= 3) {
    return { allowed: false, message: 'otp_limit_exceeded' };
  }

  // Check hourly limit
  const hourKey = `otp_hour:${phone}`;
  const hourly = await redis.get(hourKey);
  if (hourly && parseInt(hourly, 10) >= 5) {
    return { allowed: false, message: 'hourly_limit_exceeded' };
  }

  // Increment counters
  const multi = redis.multi();
  multi.incr(phoneKey);
  multi.expire(phoneKey, 900); // 15 min
  multi.incr(hourKey);
  multi.expire(hourKey, 3600); // 1 hour
  await multi.exec();

  return { allowed: true };
}
```

---

## Response on Rate Limit Exceeded

```typescript
// HTTP 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "تم تجاوز الحد المسموح لإرسال رمز التحقق. حاول مرة أخرى بعد 8 دقائق",
    "messageEn": "Too many OTP requests. Please try again after 8 minutes",
    "retryAfter": 480  // seconds until next try
  }
}
```

---

## Monitoring & Alerting

```typescript
// Log all rate limit violations
logger.warn({
  type: 'rate_limit_exceeded',
  key,
  identifier,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
}, 'Rate limit exceeded');

// Alert thresholds:
// • 10+ rate limit hits per IP in 5 minutes → log warning
// • 50+ rate limit hits per IP in 1 hour → block IP temporarily
// • 5+ OTP send failures per phone per hour → flag for review
```

---

## What NOT To Do

- NEVER block the Redis connection (use `maxRetriesPerRequest: null`)
- NEVER use in-memory rate limiting (doesn't scale across instances)
- NEVER set rate limits too high (defeats the purpose)
- NEVER forget to handle Redis connection failures (graceful degradation)
- NEVER rate limit legitimate users (adjust limits based on real usage)
- NEVER use predictable key names (use consistent prefix pattern)
- NEVER forget to set TTL on keys (memory leaks)
- NEVER ignore IPv6 addresses (use full IP string)
- NEVER hardcode limits without config file support

---

## Egyptian Market Checklist

- [ ] OTP sends limited to 3 per 15 min per phone
- [ ] OTP hourly cap at 5 per phone
- [ ] Login attempts limited per IP (5/min) and per phone (10/hour)
- [ ] IP auto-ban after 20 failed login attempts
- [ ] Registration limited per IP (3 per hour)
- [ ] API endpoints rate limited per authenticated user
- [ ] Rate limit responses include `retryAfter` in seconds
- [ ] All rate limit violations logged with IP and user context
- [ ] Redis keys use consistent naming pattern
- [ ] Graceful handling when Redis is unavailable