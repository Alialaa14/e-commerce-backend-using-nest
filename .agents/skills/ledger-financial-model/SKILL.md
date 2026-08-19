---
name: ledger-financial-model
description: "Append-only financial ledger model for FashionConnect. Use when working on wallets, balances, payouts, refunds, commissions, financial reports, or any money-related data operations."
risk: critical
source: fashionconnect-core
date_added: "2026-08-06"
---

# Ledger Financial Model — FashionConnect

**(FinTech · Double-Entry Ledger · Financial Integrity)**

You are a **FinTech Systems Architect**. Your job is to ensure absolute financial integrity within FashionConnect by strictly enforcing an append-only ledger system.

---

## 1. Financial Risk Index (BFRI)

Before modifying any money-related flows, assess the risk.

| Dimension                     | Question                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| **Immutability**              | Does this code attempt to UPDATE or DELETE a ledger entry?       |
| **Atomicity**                 | Is the ledger entry created in the SAME transaction as the action?|
| **Precision**                 | Are monetary values handled safely (e.g., using integers/cents)? |

**Rule**: Any violation of append-only design or transaction atomicity is a critical failure.

---

## 2. Core Principles (Non-Negotiable)

- **Append-Only Immutability**: `LedgerEntry` records CANNOT be updated or deleted. Ever. To correct a mistake, you must create a new compensating entry (a reversal).
- **Atomic Transactions**: A business action (like fulfilling an order) and its corresponding financial impact (creating a ledger entry) MUST happen in a single Prisma `$transaction`.
- **Derived Balances**: Wallet balances are derived dynamically by summing ledger entries. You may cache the balance on a `Wallet` model, but the `LedgerEntry` table is the absolute source of truth.
- **Base Units Only**: Store all monetary values in base units (e.g., Piastres/Cents) as Integers. NEVER use floats for money.

---

## 3. Capabilities

- Financial transactions recording (Credits/Debits)
- Wallet balance calculation
- Commission splits
- Refund processing
- Payout generation

---

## 4. Scope

- **IN SCOPE**: `LedgerEntry`, `Wallet`, `Payout`, and `Commission` models and services.
- **OUT OF SCOPE**: Payment Gateway Integration (e.g. Paymob SDK usage) — though the *result* of the gateway must be recorded here.

---

## 5. Patterns

### Atomic Ledger Entry Pattern
**When to use**: Whenever money changes hands.

```typescript
@Injectable()
export class WalletService {
  async creditBrandWallet(tx: Prisma.TransactionClient, params: {
    brandId: string;
    amount: number;
    referenceId: string;
    description: string;
  }) {
    // 1. Create the immutable ledger entry
    await tx.ledgerEntry.create({
      data: {
        walletId: params.brandId,
        amount: params.amount, // Positive for credit
        type: 'CREDIT',
        referenceId: params.referenceId,
        description: params.description,
      }
    });

    // 2. Update the cached balance
    await tx.wallet.update({
      where: { ownerId: params.brandId },
      data: { balance: { increment: params.amount } }
    });
  }
}
```

### Reversal Pattern
**When to use**: Fixing a mistake or processing a refund.

```typescript
async refundOrder(orderId: string, amount: number) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Mark order as refunded
    await tx.order.update({ ... });
    
    // 2. Create DEBIT to reverse the original CREDIT
    await tx.ledgerEntry.create({
      data: {
        walletId: brandId,
        amount: -amount, // Negative for debit
        type: 'REFUND_DEBIT',
        referenceId: orderId,
        description: 'Refund for returned order',
      }
    });
    
    // 3. Decrement cached balance
    await tx.wallet.update({
      where: { ownerId: brandId },
      data: { balance: { decrement: amount } }
    });
  });
}
```

---

## 6. What NOT To Do

- NEVER use `prisma.ledgerEntry.update()` or `prisma.ledgerEntry.delete()`.
- NEVER calculate percentages or taxes using JavaScript floats; use a safe decimal library or integer math.
- NEVER record a successful payment from a gateway without immediately recording it in the ledger within the same transaction.
