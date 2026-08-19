---
name: webhook-security-patterns
description: Webhook signature verification for payment gateways (Stripe/Paymob/Fawry) and delivery partners. Triggers when implementing payment webhooks or delivery callbacks.
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Webhook Security Patterns — FashionConnect

## Why Signature Verification Is Critical

Webhooks can update payment status → trigger payouts, confirm delivery → release payments, process refunds → affect wallets. **Without signature verification**, an attacker can forge webhook requests and manipulate financial data.

---

## Core Security Principles

1. **Always verify signatures** before processing webhook data
2. **Use constant-time comparison** to prevent timing attacks
3. **Replay prevention** - track processed webhook IDs
4. **Idempotency** - webhooks may arrive multiple times
5. **Raw body preservation** - JSON parsing breaks signatures

---

## Payment Gateway Webhooks

### Stripe (HMAC-SHA256)

```typescript
// src/modules/payments/services/stripe-webhook.service.ts
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookService {
  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async handlePaymentIntent(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Idempotency: check if already processed
    const existing = await this.prisma.transaction.findUnique({
      where: { gatewayTransactionId: paymentIntent.id },
    });
    if (existing) return; // Already handled

    if (paymentIntent.status === 'succeeded') {
      await this.processSuccessfulPayment(paymentIntent);
    }
  }
}
```

### Paymob (HMAC-SHA512) - Egyptian Gateway

```typescript
// src/modules/payments/services/paymob-webhook.service.ts
import * as crypto from 'crypto';

@Injectable()
export class PaymobWebhookService {
  verifyWebhook(payload: PaymobWebhookDto, receivedHmac: string): boolean {
    const secret = process.env.PAYMOB_HMAC_SECRET;

    // Paymob concatenates specific fields
    const data = [
      payload.amount_cents, payload.created_at, payload.currency,
      payload.error_occured, payload.has_parent_transaction, payload.id,
      payload.integration_id, payload.is_3d_secure, payload.is_auth,
      payload.is_capture, payload.is_refunded, payload.is_standalone_payment,
      payload.is_voided, payload.order, payload.owner, payload.pending,
      payload.source_data_pan, payload.source_data_sub_type,
      payload.source_data_type, payload.success,
    ].join('');

    const calculatedHmac = crypto
      .createHmac('sha512', secret)
      .update(data)
      .digest('hex');

    // Constant-time comparison prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(receivedHmac),
    );
  }
}
```

---

## Delivery Partner Webhooks

```typescript
// src/modules/delivery/services/delivery-webhook.service.ts
@Injectable()
export class DeliveryWebhookService {
  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const calculated = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(calculated),
      Buffer.from(signature),
    );
  }

  async handleDeliveryUpdate(payload: any) {
    const { orderId, status, proofUrl } = payload;

    // Idempotency check
    if (await this.redis.get(`delivery_webhook:${payload.id}`)) return;

    await this.prisma.subOrder.update({
      where: { id: orderId },
      data: { status, deliveryProofUrl: proofUrl },
    });

    await this.redis.setex(`delivery_webhook:${payload.id}`, 86400, '1');
  }
}
```

---

## Controller Pattern

```typescript
// src/modules/payments/payments-webhook.controller.ts
@Controller('webhooks')
export class WebhooksController {
  // Stripe - needs RAW body
  @Post('stripe')
  async handleStripe(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.stripeWebhook.verifyWebhook(req['rawBody'], signature);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.stripeWebhook.handlePaymentIntent(event);
        break;
    }
    
    return { received: true }; // Always respond 200 quickly
  }

  // Paymob - HMAC query parameter
  @Post('paymob')
  async handlePaymob(@Body() payload: any, @Query('hmac') hmac: string) {
    if (!this.paymobWebhook.verifyWebhook(payload, hmac)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    await this.paymobWebhook.handleTransaction(payload);
    return { received: true };
  }
}
```

---

## Raw Body Configuration (NestJS)

```typescript
// src/main.ts
const app = await NestFactory.create(AppModule, {
  rawBody: true, // Essential for webhook signature verification
});

app.use(json());
// Webhook routes need raw body preserved
app.use('/webhooks/stripe', json({ verify: (req, _, buf) => {
  req['rawBody'] = buf;
}}));
```

---

## What NOT To Do

- NEVER process webhooks without signature verification
- NEVER use JSON.parse() before signature check (breaks signature)
- NEVER return non-2xx status (triggers retries → duplicates)
- NEVER use simple string comparison for HMAC (timing attacks)
- NEVER log sensitive webhook data (card details, PII)
- NEVER skip idempotency checks (webhooks can arrive multiple times)

---

## Webhook Checklist

- [ ] Stripe webhook signature verified with `constructEvent`
- [ ] Paymob HMAC-SHA512 validation with constant-time comparison
- [ ] Delivery partner HMAC-SHA256 verification
- [ ] Raw body preserved for signature verification
- [ ] Idempotency check via Redis (webhook ID tracking)
- [ ] Rate limiting on webhook endpoints
- [ ] Secrets stored in environment variables (never in code)
- [ ] 200 response sent immediately, processing in background
- [ ] HTTPS only for webhook endpoints

---

## Related Skills
- idempotency-key-management
- ledger-financial-model
- security-checklist
- rate-limiting-redis
