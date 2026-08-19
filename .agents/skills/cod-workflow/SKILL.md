---
name: cod-workflow
description: Cash-on-Delivery (COD) workflow implementation for the Egyptian market. Triggers when working on payment flows, order states, delivery reconciliation, COD collection, or any financial settlement logic.
---

# COD Workflow Skill — FashionConnect Egyptian Market

## Why COD Is Different From Digital Payments

COD is NOT just a payment method. It is a multi-step business workflow that spans:

- Order placement → Brand acceptance → Delivery execution → Cash collection → Remittance → Settlement

Money does NOT exchange hands at checkout. It exchanges hands at the door, then flows back through the delivery company to the platform, and finally to the brand.

## COD Order State Machine

```
placed
  ↓ (brand accepts)
accepted
  ↓ (brand hands off to delivery company)
handed_to_delivery
  ↓ (delivery company assigns courier)
out_for_delivery
  ↓ (courier delivers and collects cash)
delivered_and_collected  ← cash is NOW with courier
  ↓ (courier submits to delivery company)
remittance_pending       ← cash is with delivery company
  ↓ (delivery company remits to platform)
remittance_received      ← cash is with platform
  ↓ (platform settles to brand after fee deduction)
settled                  ← brand receives payout
```

## States Where COD Can Be Cancelled

```
placed          → can cancel (no cost)
accepted        → can cancel (brand notified)
handed_to_delivery → can cancel (delivery company notified, possible fee)
out_for_delivery → CANNOT cancel (courier already in transit)
delivered_*     → CANNOT cancel (must go through dispute/return flow)
```

## Ledger Entry Pattern for COD

```typescript
// When order is placed (COD selected)
await tx.ledgerEntry.create({
  data: {
    type: "COD_ORDER_CREATED",
    orderId: order.id,
    brandId: order.brandId,
    amount: order.total,
    status: "PENDING", // NOT settled yet
    note: "COD order placed — pending delivery and collection",
  },
});

// When courier collects cash from customer
await tx.ledgerEntry.create({
  data: {
    type: "COD_COLLECTED_BY_COURIER",
    orderId: order.id,
    courierId: courier.id,
    amount: order.total,
    status: "COLLECTED", // cash is with courier
    collectedAt: new Date(),
  },
});

// When delivery company remits to platform
await tx.ledgerEntry.create({
  data: {
    type: "COD_REMITTED_TO_PLATFORM",
    orderId: order.id,
    deliveryCompanyId: company.id,
    amount: order.total,
    status: "REMITTED",
    remittedAt: new Date(),
  },
});

// When platform settles to brand
await tx.ledgerEntry.create({
  data: {
    type: "BRAND_PAYOUT",
    orderId: order.id,
    brandId: order.brandId,
    amount: order.total - platformFee,
    status: "SETTLED",
    settledAt: new Date(),
  },
});
```

## COD Risk Scoring Rules

Flag an order as HIGH RISK if any of these are true:

1. Same phone number has cancelled >3 COD orders in last 30 days
2. Same address has >50% COD cancellation rate in last 90 days
3. Order total >3000 EGP (configurable threshold)
4. First-time user placing large COD order
5. Delivery zone has historically low delivery success rate

```typescript
async assessCodRisk(dto: CreateOrderDto, userId: string): Promise<CodRiskLevel> {
  const recentCancellations = await this.prisma.order.count({
    where: {
      userId,
      paymentMethod: 'COD',
      status: 'CANCELLED',
      createdAt: { gte: subDays(new Date(), 30) }
    }
  });

  if (recentCancellations >= 3) return CodRiskLevel.HIGH;
  if (dto.total > 3000) return CodRiskLevel.MEDIUM;
  return CodRiskLevel.LOW;
}
```

## COD Reconciliation Report

Brands see two separate views:

1. **Pending COD** — orders delivered but not yet remitted to platform
2. **Settled COD** — orders where payout has been processed to brand

```typescript
async getBrandCodReconciliation(brandId: string) {
  const [pending, settled] = await this.prisma.$transaction([
    this.prisma.ledgerEntry.aggregate({
      where: { brandId, type: 'COD_COLLECTED_BY_COURIER', status: 'COLLECTED' },
      _sum: { amount: true }
    }),
    this.prisma.ledgerEntry.aggregate({
      where: { brandId, type: 'BRAND_PAYOUT', status: 'SETTLED' },
      _sum: { amount: true }
    })
  ]);

  return {
    pendingCod: pending._sum.amount ?? 0,
    settledCod: settled._sum.amount ?? 0,
  };
}
```

## What NOT To Do

- NEVER mark an order as financially settled until delivery company confirms remittance
- NEVER update a ledger entry — always create a new one
- NEVER skip the remittance_pending state — cash must be explicitly tracked
- NEVER allow a COD payout without admin approval
- NEVER treat COD collection by courier as platform receipt — they are separate events
- NEVER expose brand payout before platform fees are deducted
