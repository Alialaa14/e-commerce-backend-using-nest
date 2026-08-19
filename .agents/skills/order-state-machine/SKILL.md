---
name: order-state-machine
description: Order lifecycle state machine with strict transitions for multi-brand marketplace. Triggers when implementing order creation, brand acceptance, delivery handoff, courier tracking, COD reconciliation, cancellation, or refund flows.
risk: critical
source: fashionconnect-core
date_added: "2026-08-06"
---

# Order State Machine — FashionConnect

## Why Strict State Machine Is Critical

Orders are the heart of FashionConnect. In a multi-brand marketplace with COD:

- **Sub-orders** per brand have independent lifecycles
- **COD payments** mean state drives financial reconciliation
- **Brand acceptance** is mandatory before fulfillment
- **Invalid transitions** cause financial loss, disputes, audit failures

---

## Sub-Order State Diagram

```
PENDING_BRAND_ACTION
    │
    ├──► ACCEPTED
    │       │
    │       ├──► PACKED
    │       │       │
    │       │       ├──► HANDED_TO_DELIVERY
    │       │       │       │
    │       │       │       ├──► OUT_FOR_DELIVERY
    │       │       │       │       │
    │       │       │       │       ├──► DELIVERED
    │       │       │       │       │       │
    │       │       │       │       │       ├──► COD_RECONCILED
    │       │       │       │       │       │       │
    │       │       │       │       │       │       ├──► SETTLED
    │       │       │       │       │       │       │
    │       │       │       │       │       └──► RETURNED
    │       │       │       │       │               │
    │       │       │       │       │               └──► REFUNDED
    │       │       │       │       │
    │       │       │       │       └──► CANCELLED_BY_BRAND
    │       │       │       │
    │       │       └──► CANCELLED_BY_BRAND
    │       │
    │       └──► CANCELLED_BY_BRAND
    │
    ├──► REJECTED_BY_BRAND
    │
    └──► CANCELLED_BY_USER (before brand action)
```

---

## Valid Transitions

| From State | To State | Trigger | Who |
|------------|----------|---------|-----|
| PENDING_BRAND_ACTION | ACCEPTED | Brand accepts | Brand |
| PENDING_BRAND_ACTION | REJECTED_BY_BRAND | Brand rejects | Brand |
| PENDING_BRAND_ACTION | CANCELLED_BY_USER | User cancels | User |
| ACCEPTED | PACKED | Brand packs | Brand |
| ACCEPTED | CANCELLED_BY_BRAND | Brand cancels | Brand |
| PACKED | HANDED_TO_DELIVERY | Brand hands off | Brand |
| PACKED | CANCELLED_BY_BRAND | Brand cancels | Brand |
| HANDED_TO_DELIVERY | OUT_FOR_DELIVERY | Courier picks up | Courier |
| HANDED_TO_DELIVERY | CANCELLED_BY_BRAND | Brand cancels | Brand |
| OUT_FOR_DELIVERY | DELIVERED | Courier delivers | Courier |
| OUT_FOR_DELIVERY | RETURNED | Customer refuses | Courier |
| DELIVERED | COD_RECONCILED | COD collected | Delivery Co |
| DELIVERED | RETURNED | Customer returns | Customer |
| RETURNED | REFUNDED | Refund processed | Admin/System |
| COD_RECONCILED | SETTLED | Payout to brand | Admin |

---

## Invalid Transitions (NEVER ALLOW)

- ❌ Skip brand acceptance: `PENDING_BRAND_ACTION` → `PACKED`/`HANDED_TO_DELIVERY`
- ❌ Skip packing: `ACCEPTED` → `HANDED_TO_DELIVERY`/`OUT_FOR_DELIVERY`
- ❌ Skip delivery: `PACKED` → `OUT_FOR_DELIVERY`/`DELIVERED`
- ❌ Financial states without delivery: `PENDING_BRAND_ACTION`/`ACCEPTED`/`PACKED` → `COD_RECONCILED`
- ❌ Backwards transitions: `DELIVERED` → `OUT_FOR_DELIVERY`, `SETTLED` → `COD_RECONCILED`
- ❌ Cancel after point of no return: `OUT_FOR_DELIVERY`/`DELIVERED` → `CANCELLED`

---

## State Machine Service

```typescript
// src/modules/orders/state-machine.service.ts
@Injectable()
export class OrderStateMachineService {
  private validTransitions = new Map([
    ['PENDING_BRAND_ACTION', ['ACCEPTED', 'REJECTED_BY_BRAND', 'CANCELLED_BY_USER']],
    ['ACCEPTED', ['PACKED', 'CANCELLED_BY_BRAND']],
    ['PACKED', ['HANDED_TO_DELIVERY', 'CANCELLED_BY_BRAND']],
    ['HANDED_TO_DELIVERY', ['OUT_FOR_DELIVERY', 'CANCELLED_BY_BRAND']],
    ['OUT_FOR_DELIVERY', ['DELIVERED', 'RETURNED']],
    ['DELIVERED', ['COD_RECONCILED', 'RETURNED']],
    ['RETURNED', ['REFUNDED']],
    ['COD_RECONCILED', ['SETTLED']],
  ]);

  async transition(
    subOrderId: string,
    newState: SubOrderStatus,
    actor: { id: string; role: UserRole },
    metadata?: Record<string, any>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const subOrder = await tx.subOrder.findUnique({
        where: { id: subOrderId },
        select: { id: true, status: true, orderId: true, brandId: true, deliveryCompanyId: true, courierId: true },
      });

      if (!subOrder) throw new NotFoundException('Sub-order not found');

      const allowed = this.validTransitions.get(subOrder.status) || [];
      if (!allowed.includes(newState)) {
        throw new BadRequestException(`Invalid transition: ${subOrder.status} → ${newState}`);
      }

      this.validateRolePermission(subOrder.status, newState, actor);

      const updated = await tx.subOrder.update({
        where: { id: subOrderId },
        data: { status: newState, ...this.getStateSpecificData(newState) },
      });

      await tx.subOrderStatusHistory.create({
        data: {
          subOrderId,
          fromStatus: subOrder.status,
          toStatus: newState,
          changedBy: actor.id,
          changedByRole: actor.role,
          metadata: metadata || {},
        },
      });

      await this.triggerSideEffects(tx, subOrderId, newState, subOrder);
      return updated;
    });
  }

  private validateRolePermission(from: SubOrderStatus, to: SubOrderStatus, actor: { role: UserRole }) {
    const rolePermissions: Record<string, UserRole[]> = {
      'ACCEPTED': ['BRAND'], 'REJECTED_BY_BRAND': ['BRAND'], 'PACKED': ['BRAND'],
      'HANDED_TO_DELIVERY': ['BRAND'], 'OUT_FOR_DELIVERY': ['COURIER', 'DELIVERY_COMPANY'],
      'DELIVERED': ['COURIER'], 'RETURNED': ['COURIER', 'CUSTOMER'],
      'COD_RECONCILED': ['DELIVERY_COMPANY', 'ADMIN'], 'SETTLED': ['ADMIN'],
      'CANCELLED_BY_BRAND': ['BRAND'], 'CANCELLED_BY_USER': ['CUSTOMER'],
    };
    const allowed = rolePermissions[to];
    if (allowed && !allowed.includes(actor.role)) {
      throw new ForbiddenException(`Role ${actor.role} cannot transition to ${to}`);
    }
  }

  private getStateSpecificData(state: SubOrderStatus) {
    const now = new Date();
    switch (state) {
      case 'ACCEPTED': return { acceptedAt: now };
      case 'PACKED': return { packedAt: now };
      case 'HANDED_TO_DELIVERY': return { handedAt: now };
      case 'OUT_FOR_DELIVERY': return { outForDeliveryAt: now };
      case 'DELIVERED': return { deliveredAt: now };
      case 'COD_RECONCILED': return { codCollectedAt: now };
      case 'RETURNED': return { returnedAt: now };
      case 'REFUNDED': return { refundedAt: now };
      case 'SETTLED': return { settledAt: now };
      default: return {};
    }
  }

  private async triggerSideEffects(tx, subOrderId, newState, subOrder) {
    switch (newState) {
      case 'ACCEPTED': await this.notifications.sendOrderAccepted(subOrder.orderId); break;
      case 'DELIVERED':
        await this.inventory.confirmOrderReservation(subOrderId);
        await this.ledger.recordCodCollected(subOrderId); break;
      case 'COD_RECONCILED': await this.payouts.createBrandPayout(subOrderId); break;
      case 'RETURNED':
        await this.inventory.releaseOrderStock(subOrderId);
        await this.refunds.initiateRefund(subOrderId); break;
    }
  }
}
```

---

## Controller Usage

```typescript
@Patch('brands/:brandId/orders/:orderId/accept')
@Roles('BRAND')
async acceptOrder(@Param('orderId') orderId: string, @GetUser() user: User) {
  const subOrder = await this.prisma.subOrder.findFirst({
    where: { orderId, brandId: user.brandId },
  });
  return this.stateMachine.transition(subOrder.id, SubOrderStatus.ACCEPTED, { id: user.id, role: user.role });
}

@Patch('couriers/:courierId/orders/:orderId/deliver')
@Roles('COURIER')
async deliverOrder(@Param('orderId') orderId: string, @GetUser() user: User) {
  const subOrder = await this.prisma.subOrder.findFirst({
    where: { orderId, courierId: user.courierId },
  });
  return this.stateMachine.transition(subOrder.id, SubOrderStatus.DELIVERED, { id: user.id, role: user.role });
}
```

---

## What NOT To Do

- ❌ NEVER allow direct status update bypassing state machine
- ❌ NEVER skip history record (audit trail required)
- ❌ NEVER allow transition without role validation
- ❌ NEVER skip side effects (inventory, ledger, notifications)
- ❌ NEVER allow backward transitions
- ❌ NEVER allow skip states
- ❌ NEVER process COD reconciliation without DELIVERED state
- ❌ NEVER settle brand payout without COD_RECONCILED

---

## State Machine Checklist

- [ ] All states defined as enum
- [ ] Valid transitions map defined
- [ ] Invalid transitions explicitly documented
- [ ] Role-based transition authorization
- [ ] Append-only history table
- [ ] Atomic transition in Prisma transaction
- [ ] State-specific timestamps
- [ ] Side effects triggered in same transaction
- [ ] Invalid transitions tested and blocked
- [ ] COD states only reachable after DELIVERED

---

## Related Skills
- inventory-concurrency-management (stock moves with states)
- ledger-financial-model (financial side effects)
- cod-workflow (COD state flow)
- prisma-patterns (transaction patterns)
- security-checklist (role-based authorization)