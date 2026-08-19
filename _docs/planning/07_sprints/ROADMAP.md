# Implementation Roadmap for the Backend Team

## 1. Delivery Model and Execution Principles

This roadmap is structured for a team of exactly three backend developers working feature by feature. Each feature is treated as a fully shippable slice of the platform. No endpoint is owned by more than one developer, and every endpoint must be implemented end to end, including validation, service logic, database access, tests, Swagger documentation, review, and merge.

### Team Rules

- No duplicate ownership of any endpoint.
- One endpoint has one primary owner.
- A second developer performs code review for every endpoint.
- Every endpoint must include automated tests.
- Swagger must be updated before merge.
- No pull request may be merged unless the generated OpenAPI spec (`npm run build:openapi`) matches the committed version in `docs/openapi.yaml`. This is enforced automatically via the `swagger_check` CI job.

- No pull request is merged without passing CI.
- No direct pushes to main or develop.
- A feature is considered complete only when all assigned endpoints are implemented, reviewed, tested, and merged.

### Default Ownership Model

- Developer A: authentication, identity, profile, and core platform account flows
- Developer B: catalog, cart, checkout, and order lifecycle flows
- Developer C: delivery, payments, admin/governance, messaging, and notifications

This distribution may shift slightly per feature, but the ownership boundaries remain explicit and reviewable.

---

## 2. Feature Delivery Plan

| Feature                             | Purpose                                                                                       | Database Tables                                                                                          | Dependencies                               | Business Rules                                                                   | Complexity | Estimated Time |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ---------- | -------------- |
| F1. Authentication & Identity       | Register, login, OTP, refresh, logout, profile access                                         | users, refresh_tokens, otp_codes, addresses, permissions, user_permissions                               | Password hashing, JWT, OTP provider, Redis | Passwords never stored plaintext; OTP single-use; refresh tokens revocable       | Medium     | 4 days         |
| F2. User Profiles & Addresses       | Manage user profile, addresses, and account preferences                                       | users, addresses                                                                                         | F1                                         | One default address per user; role and ownership must remain intact              | Medium     | 3 days         |
| F3. Brand Onboarding & Verification | Brand registration, document upload, verification tier management                             | brands, brand_documents, brand_social_links, brand_followers                                             | F1, upload service, admin workflow         | Verification tier transitions require admin review; documents must be auditable  | High       | 6 days        |
| F4. Catalog & Wishlist              | Categories, products, variants, media, wishlist, low-stock alerts                             | categories, products, product_media, variants, wishlists                                                 | F3                                         | Soft-delete for products; category deletion requires reassignment or soft-delete | High       | 6 days        |
| F5. Cart & Checkout                 | Add to cart, edit cart, checkout, split into sub-orders                                       | carts, cart_items, orders, sub_orders, order_items, discounts, discount_usages                           | F4, payments, delivery pricing             | Checkout must be atomic; COD is supported as a first-class payment method        | High       | 6 days        |
| F6. Orders, Reviews & Fulfillment   | Order detail, status transitions, accept/reject, reviews, tracking                            | orders, sub_orders, sub_order_status_history, order_items, returns, reviews, review_images               | F5, delivery, notifications                | Status changes must be append-only; proof of delivery required for completion    | High       | 6 days        |
| F7. Delivery & Courier Ops          | Delivery company onboarding, fee tiers, courier assignment, proof of delivery, reconciliation | delivery_companies, delivery_zones, couriers, delivery_proofs, cod_reconciliations                       | F6                                         | COD reconciliation must be auditable and linked to the originating sub-order     | High       | 6 days        |
| F8. Payments, Payouts & Wallets     | Payment intents, webhooks, wallet behavior, payout approvals                                  | transactions, payouts, wallets, wallet_transactions, loyalty_points, referrals                           | F5, F6, admin workflow                     | Payments must be idempotent; balances must be derived from ledger rows           | High       | 6 days        |
| F9. Chat, Notifications & Messaging | Thread creation, message handling, read receipts, notification delivery                       | chat_threads, chat_messages, notifications, notification_templates                                       | F1, F6, Socket.IO                          | Notifications are asynchronous; chat threads remain shared across relevant roles | Medium     | 4 days         |
| F10. Admin Governance & Trust       | Admin dashboard, moderation, disputes, ranking overrides, sub-admin permissions               | disputes, dispute_evidence, moderation_flags, admin_audit_log, ad_packages, ad_campaigns, ranking_scores | F3, F6, F8, F9                             | All admin actions must be logged; dispute resolution must be auditable           | High       | 6 days        |

### Acceptance Criteria by Feature

| Feature | Acceptance Criteria                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------ |
| F1      | Users can register, log in, verify OTP, refresh tokens, and log out successfully.                      |
| F2      | Authenticated users can create and update addresses and manage a single default address.               |
| F3      | Brands can register, upload documents, and move through verification tiers based on admin action.      |
| F4      | Brands can create categories and products with variants and users can save wishlist items.             |
| F5      | Users can add items to cart, modify quantities, and checkout into orders with COD or digital payments. |
| F6      | Brands can accept or reject orders and users can view tracking and submit reviews.                     |
| F7      | Delivery companies can assign orders, couriers can update status, and delivery proof is accepted.      |
| F8      | Payments are processed, webhook events are handled, and payouts can be approved with audit logging.    |
| F9      | Users and brands can exchange messages and receive asynchronous notifications.                         |
| F10     | Admin users can review disputes, moderate content, and manage sub-admin permissions.                   |

### Definition of Done by Feature

| Feature | Definition of Done                                                                       |
| ------- | ---------------------------------------------------------------------------------------- |
| F1      | All auth-related endpoints implemented, tested, documented, reviewed, and merged.        |
| F2      | Profile and address flows complete with ownership checks and test coverage.              |
| F3      | Brand application, document handling, verification workflow, and admin actions complete. |
| F4      | Catalog CRUD, media handling, variants, and wishlist flows complete.                     |
| F5      | Cart and checkout paths pass end-to-end happy path and failure-case tests.               |
| F6      | Order lifecycle, reviews, and tracking flows are fully functional and audited.           |
| F7      | Delivery workflows and reconciliation are implemented and validated.                     |
| F8      | Payments and payout flows are idempotent and fully tested.                               |
| F9      | Messaging and notification flows run successfully with real async behavior.              |
| F10     | Admin governance flows, moderation, and audit trails are complete.                       |

---

## 6. Sprint Plan

| Week | Focus |
|---|---|
| Week 1 | Auth + Brand onboarding basic + Schema final + CI/CD |
| Week 2 | Catalog + Cart |
| Week 3 | Checkout + Orders/Sub-orders + COD + Paymob basic |
| Week 4 | Delivery/Courier basic + Admin dashboard basic + Hardening |

## 7. Risks and Mitigations

| Risk                                                             | Impact                                     | Mitigation                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Checkout and payment flows become tightly coupled                | Delays release of core revenue path        | Keep payment and checkout flows isolated behind clear service boundaries and shared contracts. |
| Delivery handoff depends on brand acceptance and sub-order state | Introduces scheduling risk                 | Define a strict state machine early and enforce it in service logic.                           |
| Admin moderation and dispute resolution become bottlenecks       | Blocks trust and safety readiness          | Implement admin endpoints early and ensure they are reviewable and auditable.                  |
| Swagger and tests fall behind implementation                     | Causes integration pain                    | Make Swagger and tests mandatory before PR merge.                                              |
| Endpoint ownership confusion                                     | Causes duplicate work and review conflicts | Use the ownership table as a source of truth and enforce branch ownership.                     |

---

## 8. Merge Sequence

| Sequence | Feature                            | Primary Owner | Reviewer    | Merge Target |
| -------- | ---------------------------------- | ------------- | ----------- | ------------ |
| 1        | F1 Authentication & Identity       | Developer A   | Developer B | develop      |
| 2        | F2 Profiles & Addresses            | Developer A   | Developer C | develop      |
| 3        | F3 Brand Onboarding & Verification | Developer A   | Developer C | develop      |
| 4        | F4 Catalog & Wishlist              | Developer B   | Developer A | develop      |
| 5        | F5 Cart & Checkout                 | Developer B   | Developer C | develop      |
| 6        | F6 Orders, Reviews & Fulfillment   | Developer B   | Developer A | develop      |
| 7        | F7 Delivery & Courier Ops          | Developer C   | Developer B | develop      |
| 8        | F8 Payments, Payouts & Wallets     | Developer C   | Developer B | develop      |
| 9        | F9 Chat, Notifications & Messaging | Developer C   | Developer A | develop      |
| 10       | F10 Admin Governance & Trust       | Developer C   | Developer A | develop      |

---

## 9. Absence Policy

If a developer is absent:

- Only their remaining endpoints are reassigned.
- Completed work remains intact and is not rewritten.
- Branch ownership is transferred if needed.
- Sprint planning is updated immediately.
- A backup reviewer is assigned for all affected endpoints.
- All changes are recorded in the project documentation and sprint tracker.

This roadmap is designed so the team can begin implementation immediately without additional planning. It is intentionally feature-driven, endpoint-specific, and ownership-bound to minimize coordination overhead while preserving engineering quality.

---

## 2. Modern Engineering Implementation Plan

### 2.1 Delivery Model and Operating Principles

This plan is optimized for a three-developer backend team that needs fast delivery with low merge-conflict risk.

- work in feature slices instead of one large release
- keep one primary owner per task and one reviewer per task
- prefer small, reviewable pull requests
- keep business logic in services, not controllers
- treat tests, Swagger, and CI as mandatory gates

### 2.2 Team Allocation Model

| Engineer    | Primary Focus                                         | Secondary Focus         |
| ----------- | ----------------------------------------------------- | ----------------------- |
| Developer A | Authentication, identity, profiles, brand onboarding  | Admin governance basics |
| Developer B | Catalog, cart, checkout, orders, reviews              | Fulfillment state       |
| Developer C | Delivery, payments, payouts, messaging, notifications | Trust and operations    |

### 2.3 Feature Portfolio

| Feature                             | Scope                                           | Owner       | Priority | Est. Time |
| ----------------------------------- | ----------------------------------------------- | ----------- | -------- | --------: |
| F1. Authentication & Identity       | Register, login, OTP, refresh, logout           | Developer A | P0       |    4 days |
| F2. Profiles & Addresses            | Profile updates and address management          | Developer A | P0       |    3 days |
| F3. Brand Onboarding & Verification | Brand application, docs, verification tiers     | Developer A | P0       |   6 days |
| F4. Catalog & Wishlist              | Categories, products, variants, media, wishlist | Developer B | P0       |   6 days |
| F5. Cart & Checkout                 | Cart management and order creation              | Developer B | P0       |   6 days |
| F6. Orders, Reviews & Fulfillment   | Order workflow, tracking, reviews               | Developer B | P0       |   6 days |
| F7. Delivery & Courier Ops          | Assignments, proof, reconciliation              | Developer C | P1       |   6 days |
| F8. Payments, Payouts & Wallets     | Payments, webhooks, payouts, wallets            | Developer C | P0       |   6 days |
| F9. Chat, Notifications & Messaging | Threads, messages, notifications                | Developer C | P1       |    4 days |
| F10. Admin Governance & Trust       | Disputes, moderation, ranking, sub-admins       | Developer A | P0       |   6 days |

### 2.4 Router Ownership by Developer

| Router             | Developer A                       | Developer B                   | Developer C                                      | | Frontend Consumer |
| ------------------ | --------------------------------- | ----------------------------- | ------------------------------------------------ | | Developer D |
| AuthRouter         | register, OTP send                | login, OTP verify             | refresh, logout                                  | | Developer D |
| UserRouter         | profile read/update               | address create/update         | address list/delete                              | | Developer D |
| BrandRouter        | brand register, brand public read | document upload, brand update | verification status, admin verify/reject/suspend | | Developer E |
| CategoryRouter     | list categories                   | create category               | update/delete category                           | | Developer D |
| ProductRouter      | list products                     | create/update product         | delete product                                   | | Developer D |
| CatalogRouter      | search products                   | product detail                | wishlist list/add/remove                         | | Developer D |
| CartRouter         | get cart                          | add item                      | update/remove item                               | | Developer D |
| CheckoutRouter     | create checkout                   | create checkout               | create checkout                                  | | Developer D |
| OrderRouter        | list user orders                  | order detail/tracking         | brand order accept/reject/handoff                | | Developer E |
| ReviewRouter       | create product review             | create brand review           | review follow-up and moderation                  | | Developer E |
| DeliveryRouter     | list company orders               | assign order                  | webhook, auto-assign, reconciliation             | | Developer D |
| CourierRouter      | list assigned orders              | update status                 | submit proof                                     | | Developer D |
| PaymentRouter      | create payment intent             | stripe webhook                | paymob webhook, payouts, approvals               | | Developer D |
| ChatRouter         | create thread                     | list messages                 | send message, report thread                      | | Developer D |
| NotificationRouter | list notifications                | —                             | mark as read                                     | | Developer D |
| AdminRouter        | dashboard overview                | disputes and flags            | resolve disputes, ranking override, sub-admins   | | Developer E |

This model ensures every router is shared across all three developers, with each developer owning a distinct set of endpoints inside each router.

### 2.5 Implementation Workflow

| Step                           | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| 1. Schema review               | Confirm table and relation impact       |
| 2. Migration                   | Apply database changes safely           |
| 3. Prisma model update         | Align code with the database contract   |
| 4. Validation                  | Enforce request and business rules      |
| 5. Service layer               | Implement domain logic and transactions |
| 6. Controller and route wiring | Expose the feature over REST            |
| 7. Tests                       | Add unit and integration coverage       |
| 8. Swagger update              | Keep API docs accurate                  |
| 9. PR and review               | Validate quality and ownership          |
| 10. Merge to develop           | Release after CI passes                 |

### 2.6 Parallel Development Plan

| Workstream                     | Can Start                                   | Depends On |
| ------------------------------ | ------------------------------------------- | ---------- |
| Auth and profile foundation    | Immediately                                 | None       |
| Brand and catalog foundation   | After auth is stable                        | F1         |
| Commerce core                  | After catalog is stable                     | F3, F4     |
| Delivery and finance           | After order lifecycle is stable             | F5, F6     |
| Messaging and admin governance | After auth, orders, and payments are stable | F1, F6, F8 |

### 2.7 Critical Path

| Dependency          | Why It Matters                                             |
| ------------------- | ---------------------------------------------------------- |
| F1 before F2 and F3 | Identity and role checks are required across the platform  |
| F3 before F4        | Catalog actions depend on brand ownership and verification |
| F4 before F5        | Checkout needs valid products and variants                 |
| F5 before F6        | Orders depend on successful checkout                       |
| F6 before F7 and F8 | Delivery and payments rely on order state                  |
| F8 before F10       | Admin payout and dispute flows depend on payment state     |

### 2.8 Git Flow and PR Standards

| Rule          | Standard                                                             |
| ------------- | -------------------------------------------------------------------- |
| Branch naming | feature/auth-register, feature/catalog-products                      |
| PR size       | One feature slice or one cohesive task                               |
| PR contents   | Description, ticket, API changes, DB changes, tests, docs, checklist |
| Review policy | One approval from a non-owner reviewer                               |
| Merge policy  | No direct pushes to main or develop                                  |
| CI gate       | Lint, tests, and type checks must pass                               |

### 2.9 Sprint Plan

| Week | Focus |
|---|---|
| Week 1 | Auth + Brand onboarding basic + Schema final + CI/CD |
| Week 2 | Catalog + Cart |
| Week 3 | Checkout + Orders/Sub-orders + COD + Paymob basic |
| Week 4 | Delivery/Courier basic + Admin dashboard basic + Hardening |

### 2.10 Absence Policy

| Scenario               | Response                                                 |
| ---------------------- | -------------------------------------------------------- |
| Developer unavailable  | Reassign only the remaining tasks for that feature       |
| PR already in progress | Preserve completed work and transfer ownership if needed |
| Reviewer unavailable   | Assign a backup reviewer before merge                    |
| Timeline slips         | Replan the affected sprint and update the tracker        |

### 2.11 Engineering Quality Standards

| Standard       | Requirement                                                       |
| -------------- | ----------------------------------------------------------------- |
| Tests          | Unit, integration, and contract tests for business-critical flows |
| Observability  | Structured logs and error codes for major operations              |
| Security       | JWT validation, role checks, permission checks, and rate limiting |
| Data integrity | Transactions for checkout, payouts, and status transitions        |
| Documentation  | Swagger updates and release notes for every merged API change     |

This roadmap is practical, ownership-driven, and ready for implementation without additional planning.

## 10. Implementation Order

### Phase 1 — Foundation

1. Authentication and user profiles
2. Address management
3. Brands and verification
4. Uploads

### Phase 2 — Commerce Core

5. Categories and products
6. Cart and checkout
7. Orders and sub-orders
8. Reviews

### Phase 3 — Delivery and Finance

9. Delivery companies, couriers, proofs
10. Payments, wallets, payouts
11. COD reconciliation

### Phase 4 — Experience and Governance

12. Notifications and chat
13. Admin moderation and disputes
14. Ads and ranking
15. Reporting and analytics

### Dependency Notes

- Checkout depends on products, cart, address, payment, and delivery pricing.
- Orders depend on checkout and brand verification.
- Delivery depends on order handoff and sub-order modeling.
- Payouts depend on payment state and admin approval.
- Admin workflows depend on role-based authorization and audit logging.

---

## 11. Team Planning (Three Backend Developers)

### Backend Developer A

- Modules: auth, users, addresses, brands, uploads
- Estimated days: 18
- Dependencies: none / basic shared auth services
- Parallel work: can develop validators and shared middleware independently
- Merge order: first merge after auth and users are stable

### Backend Developer B

- Modules: categories, products, cart, checkout, orders, reviews
- Estimated days: 24
- Dependencies: auth, users, brands, uploads
- Parallel work: can build catalog and checkout in parallel after shared models are ready
- Merge order: second merge after checkout and order flows are integrated

### Backend Developer C

- Modules: delivery, payments, payouts, wallets, notifications, chat, admin, queues, reports
- Estimated days: 26
- Dependencies: orders, payments, delivery, admin auth
- Parallel work: can build worker jobs and admin features while others finish commerce core
- Merge order: final merge after end-to-end order flow is validated

---

## 16. Definition of Done for Backend

The backend implementation is considered complete when:

- all critical routes are implemented and documented;
- authentication and authorization work end-to-end;
- checkout and payment flows are transactional and idempotent;
- order and delivery status transitions are audited;
- admin moderation and dispute flows are functional;
- tests cover critical happy paths and error handling;
- OpenAPI documentation is updated;
- Docker and environment configuration work locally.