---
name: idempotency-key-management
description: Idempotency patterns for payment operations, checkout, and financial mutations. Triggers when implementing checkout, payments, refunds, or any operation that must not execute twice.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Idempotency Key Management — FashionConnect

## Why Idempotency Matters

In distributed systems with network failures:

- Client sends checkout → network timeout → retries
- **Result**: Double orders, double charges, inventory oversold

**Idempotency ensures:** Same request executed N times = same result as executing once.

---

## Critical Operations Requiring Idempotency

| Operation | Risk |
|-----------|------|
| **Checkout** | Double orders, inventory oversold |
| **Payment capture** | User charged twice |  
| **Refund** | Double refund issued |
| **Payout to brand** | Brand paid twice |
| **WALLET debit** | Balance deducted multiple times |

---

## Idempotency Key Pattern

### Client Implementation

```typescript
// Client generates UUID for each financial operation
const idempotencyKey = crypto.randomUUID();

fetch('/api/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey, // Required
  },
  body: JSON.stringify(checkoutData),
});
```

### Server-Side Pattern

```typescript
// src/modules/checkout/checkout.controller.ts
@Post('checkout')
async checkout(
  @Body() dto: CheckoutDto,
  @Headers('idempotency-key') key: string,
  @GetUser('id') userId: string,
) {
  // 1. Validate key format
  if (!key || !isValidUUID(key)) {
    throw new BadRequestException('Valid Idempotency-Key required');
  }

  // 2. Check if already processed
  const existing = await this.checkoutService.findByIdempotencyKey(key, userId);
  if (existing) {
    return existing.responseBody; // Return cached result
  }

  // 3. Process with atomicity
  return await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ /* ... */ });
    
    // Store idempotency record IN SAME TRANSACTION
    await tx.idempotencyKey.create({
      data: {
        key,
        userId,
        statusCode: 200,
        responseBody: { orderId: order.id },
        expiresAt: addHours(new Date(), 24),
      },
    });

    return order;
  });
}
```

---

## Database Schema

```prisma
model IdempotencyKey {
  key           String   @id
  userId        String
  requestHash   String   // SHA256(body) for key reuse detection
  responseBody  Json
  statusCode    Int
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  
  @@index([userId])
  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

---

## Integration with Ledger Model

```typescript
// src/modules/checkout/checkout.service.ts
async processCheckout(dto, userId, idempotencyKey) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.order.create({
      data: { ...dto, userId, idempotencyKey }
    });

    // 2. Create ledger entries (append-only)
    await tx.ledgerEntry.create({
      data: {
        orderId: order.id,
        amount: -order.total,
        type: 'ORDER_CREATED',
        status: 'PENDING',
      },
    });

    // 3. Store idempotency record
    await tx.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId,
        requestHash: hashRequest(dto),
        responseBody: order,
        statusCode: 201,
        expiresAt: addHours(new Date(), 24),
      },
    });

    return order;
  });
}
```

---

## Payment Gateway Idempotency

```typescript
// Stripe handles idempotency natively
async createPaymentIntent(amount: number, idempotencyKey: string) {
  return this.stripe.paymentIntents.create(
    {
      amount: amount * 100, // Convert to cents
      currency: 'egp',
    },
    { idempotencyKey }, // Stripe prevents duplicates
  );
}

// Paymob idempotency
async processPaymobPayment(payload: any, idempotencyKey: string) {
  const existing = await this.prisma.transaction.findUnique({
    where: { gatewayTransactionId: payload.id },
  });
  
  if (existing) {
    return existing; // Already processed
  }
  
  // Process payment...
}
```

---

## What NOT To Do

- NEVER skip idempotency keys on financial operations
- NEVER use client-provided keys without validation
- NEVER store idempotency keys forever (expire after 24 hours)
- NEVER allow reuse of same key with different request bodies
- NEVER process financial operations outside transactions
- NEVER return different responses for same idempotency key

---

## Idempotency Checklist

- [ ] Idempotency-Key header required for checkout/payment endpoints
- [ ] UUID format validation (v4 recommended)
- [ ] Database table for storing processed keys
- [ ] Request body hash comparison (prevent key reuse abuse)
- [ ] 24-hour expiration for keys
- [ ] Idempotent response returned for duplicate requests
- [ ] User ID scoped (user A can't use user B's key)
- [ ] Integration with Stripe/Paymob native idempotency
- [ ] Cleanup cron job for expired keys

---

## Related Skills
- webhook-security-patterns (webhook idempotency)
- ledger-financial-model (financial integrity)
- cod-workflow (COD reconciliation idempotency)
- prisma-patterns (transaction patterns)