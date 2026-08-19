# FashionConnect Workflows

> Workflow playbooks for FashionConnect Egyptian marketplace MVP using our actual skills.

---

## Workflow: FashionConnect MVP (6-Week Delivery)

Build the FashionConnect multi-role fashion marketplace for Egypt with COD payments, brand onboarding, real-time chat, and bilingual UI.

### Prerequisites

- NestJS 20 + TypeScript + Prisma + PostgreSQL
- Redis + BullMQ for queues
- Socket.IO for real-time
- Next.js 15 BFF frontend

---

### Week 1: Auth + Brand Foundation

**Goal:** Multi-role authentication, brand onboarding, schema finalization

1. **Plan Week 1 scope**
   - Skills: `concise-planning`, `writing-plans`
   - Prompt: "Use concise-planning to define Week 1 milestones: auth, brand registration, schema"

2. **Set up NestJS project with authentication**
   - Skills: `nestjs-architecture`, `prisma-patterns`, `jwt-refresh-token-strategy`, `security-checklist`
   - Prompt: "Use nestjs-architecture with prisma-patterns to create modular monolith with JWT+refresh tokens and OTP verification"

3. **Implement Egyptian market localization**
   - Skills: `egyptian-market-localization`
   - Prompt: "Use egyptian-market-localization for phone validation (+20), governorate/city data, EGP currency formatting, Arabic/English bilingual"

4. **Add rate limiting and multi-tenant isolation**
   - Skills: `rate-limiting-redis`, `multi-tenant-brand-isolation`
   - Prompt: "Use rate-limiting-redis for OTP/login throttling, multi-tenant-brand-isolation for brand data ownership"

5. **Validate with TDD**
   - Skills: `test-driven-development`, `testing-standards`
   - Prompt: "Use test-driven-development for auth endpoints, testing-standards for Jest/Supertest integration tests"

---

### Week 2: Catalog + Cart

**Goal:** Brand catalog management, user cart, product discovery

1. **Build catalog API with brand isolation**
   - Skills: `nestjs-architecture`, `prisma-patterns`, `api-contract-standards`, `multi-tenant-brand-isolation`
   - Prompt: "Use nestjs-architecture with multi-tenant-brand-isolation for brand-scoped CRUD on categories/products/variants"

2. **Implement cart and wishlist**
   - Skills: `prisma-patterns`, `security-checklist`
   - Prompt: "Use prisma-patterns for cart items with optimistic locking, security-checklist for authorization"

3. **Add file upload for product images**
   - Skills: `file-uploads`
   - Prompt: "Use file-uploads for product media with S3/CDN, presigned URLs, image optimization"

---

### Week 3: Checkout + Orders + Payments

**Goal:** Atomic checkout, COD support, payment gateway integration

1. **Build atomic checkout with idempotency**
   - Skills: `idempotency-key-management`, `ledger-financial-model`, `prisma-patterns`
   - Prompt: "Use idempotency-key-management for checkout deduplication, ledger-financial-model for append-only transactions"

2. **Integrate payment gateways with webhook security**
   - Skills: `webhook-security-patterns`, `cod-workflow`
   - Prompt: "Use webhook-security-patterns for Stripe/Paymob/Fawry HMAC verification, cod-workflow for COD reconciliation"

3. **Implement order lifecycle and sub-orders**
   - Skills: `prisma-patterns`, `api-contract-standards`, `cod-workflow`
   - Prompt: "Use prisma-patterns for order/sub-order state machine, cod-workflow for COD state transitions"

---

### Week 4: Chat + Real-Time + Admin

**Goal:** User-brand chat, real-time notifications, admin governance

1. **Build Socket.IO chat architecture**
   - Skills: `socketio-chat-architecture`, `jwt-refresh-token-strategy`
   - Prompt: "Use socketio-chat-architecture for thread rooms, moderation, read receipts; jwt-refresh-token-strategy for socket auth"

2. **Implement admin RBAC and moderation**
   - Skills: `security-checklist`, `multi-tenant-brand-isolation`
   - Prompt: "Use security-checklist for admin authorization, multi-tenant-brand-isolation for scoped permissions"

3. **Add Arabic RTL UI patterns**
   - Skills: `arabic-ui-design-patterns`, `nextjs-bff-communication`
   - Prompt: "Use arabic-ui-design-patterns for RTL layouts, Arabic typography; nextjs-bff-communication for BFF API integration"

---

### Week 5: Production Hardening

**Goal:** Observability, CI/CD, performance optimization

1. **Add monitoring and observability**
   - Skills: `testing-standards`, `deployment-procedures`
   - Prompt: "Use testing-standards for health checks, deployment-procedures for monitoring setup"

2. **Optimize performance and CI/CD**
   - Skills: `bullmq-specialist`, `prisma-patterns`, `deployment-procedures`
   - Prompt: "Use bullmq-specialist for queue monitoring, prisma-patterns for query optimization, deployment-procedures for GitHub Actions CI/CD"

---

### Week 6: Final Integration + Launch

**Goal:** End-to-end validation, staging deployment, launch preparation

1. **Full integration testing**
   - Skills: `test-driven-development`, `testing-standards`
   - Prompt: "Use test-driven-development for E2E user journeys, testing-standards for contract validation"

2. **Final security audit and deployment**
   - Skills: `security-checklist`, `deployment-procedures`
   - Prompt: "Use security-checklist for final penetration test, deployment-procedures for blue-green staging deploy"

---

## Quick Skill Reference

| Skill                          | Purpose                       |
| ------------------------------ | ----------------------------- |
| `nestjs-architecture`          | Modular monolith structure    |
| `prisma-patterns`              | Database operations           |
| `api-contract-standards`       | REST API design               |
| `security-checklist`           | Auth, validation, audit       |
| `testing-standards`            | Jest + Supertest              |
| `ledger-financial-model`       | Append-only financial data    |
| `cod-workflow`                 | COD reconciliation            |
| `nextjs-bff-communication`     | BFF API integration           |
| `jwt-refresh-token-strategy`   | Auth tokens + OTP             |
| `arabic-ui-design-patterns`    | RTL bilingual UI              |
| `rate-limiting-redis`          | OTP/login protection          |
| `multi-tenant-brand-isolation` | Brand data ownership          |
| `webhook-security-patterns`    | Payment/delivery webhooks     |
| `idempotency-key-management`   | Duplicate prevention          |
| `socketio-chat-architecture`   | Real-time chat                |
| `egyptian-market-localization` | Phone, currency, governorates |
| `file-uploads`                 | S3/CDN uploads                |
| `bullmq-specialist`            | Background jobs               |
| `test-driven-development`      | TDD workflow                  |
| `deployment-procedures`        | Safe deployments              |
| `frontend-design`              | UI design principles          |
| `frontend-developer`           | React/Next.js implementation  |
| `concise-planning`             | Sprint planning               |
| `writing-plans`                | Documentation                 |

---

_Use the exact skill names above when prompting for implementation steps._
