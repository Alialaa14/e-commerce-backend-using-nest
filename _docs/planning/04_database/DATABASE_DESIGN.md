## 7. Database Operations and Transaction Strategy

### 7.1 Transaction Requirements

The following flows must be transactional:

- checkout and order creation
- payment confirmation with order state update
- payout approval and ledger update
- brand verification transition with notification dispatch
- dispute resolution and refund issuance

### 7.2 Read/Write Patterns

- Use Prisma transactions for multi-table writes.
- Use Redis for caching public catalog data and ranking scores.
- Use background jobs for ranking recalculation, notification dispatch, reporting generation, and returns processing.

### 7.3 Rollback Scenarios

- If checkout fails after order creation, the transaction rolls back and no partial order remains.
- If payment webhook arrives twice, the service must treat the second event as duplicate and not double-apply state changes.
- If payout approval fails after ledger mutation, the payout transition must be rolled back and logged.

---

## 14. Recommended Prisma Model Structure

The Prisma schema should reflect the corrected PostgreSQL model. Core model groups should include:

- Auth: User, RefreshToken, OtpCode, Permission, UserPermission
- Commerce: Brand, BrandDocument, Category, Product, Variant, Cart, CartItem, Order, SubOrder, OrderItem, Return
- Delivery: DeliveryCompany, DeliveryZone, Courier, DeliveryProof, CodReconciliation
- Finance: Transaction, Payout, Wallet, WalletTransaction, LoyaltyPoint, Referral
- Communication: Review, ReviewImage, ChatThread, ChatMessage, NotificationTemplate, Notification
- Admin: Dispute, DisputeEvidence, ModerationFlag, AdminAuditLog

---