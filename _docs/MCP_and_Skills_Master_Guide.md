# ⚡ Ultimate MCP & Skills Master Guide
## FashionConnect × Antigravity IDE × GitHub Student Pack

> Researched live from MCP registries, GitHub, and official docs — August 2026
> Stack: NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ + Socket.IO + Docker

---

## 🏆 PRIORITY 1 — SET UP TODAY (Highest Impact, Zero Cost)

These 5 MCPs give you the biggest immediate power boost. All free, all battle-tested.

| # | MCP | What It Does for You | Install |
|---|---|---|---|
| 1 | **Prisma MCP** | Agent reads your DB schema, runs migrations, debugs queries — built into Prisma CLI | `npx prisma mcp` |
| 2 | **GitHub MCP** | Agent creates PRs, reviews code, manages issues and branches | Docker image |
| 3 | **Playwright MCP** | Agent tests your UI, fills forms, takes screenshots, verifies flows | `npx @playwright/mcp@latest` |
| 4 | **Context7 MCP** | Gives agent LIVE, version-specific docs for NestJS, Prisma, BullMQ — kills hallucinations | `npx @upstash/context7-mcp` |
| 5 | **Mem0 MCP** | Agent remembers decisions, patterns, and context ACROSS sessions | `npx @mem0/mem0-mcp` |

---

## 📦 FULL MCP CATALOG — MAPPED TO YOUR STUDENT PACK

### TIER 1 — FREE VIA STUDENT PACK ✅

---

#### 1. Prisma MCP ⭐ MUST HAVE
- **Source:** Built into Prisma CLI v6.6.0+ (official)
- **What it solves for FashionConnect:** Agent can inspect your full schema, run `prisma migrate`, generate queries for complex joins (sub-orders, ledger entries, brand verification tiers), debug N+1 problems
- **Student Pack:** Free (Prisma is open source)
- **Config:**
```json
{
  "mcpServers": {
    "prisma": {
      "command": "npx",
      "args": ["-y", "prisma", "mcp"]
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 2. GitHub MCP ⭐ MUST HAVE
- **Source:** `ghcr.io/github/github-mcp-server` (Official GitHub)
- **What it solves for FashionConnect:** Agent opens PRs for each completed module, reviews code against your API contract, reads issues, manages branches, enforces your OpenAPI check policy on every PR
- **Student Pack:** GitHub Pro is FREE for students → PAT included
- **Note:** The old npm package is deprecated. Use Docker image.
- **Config:**
```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
               "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-pat-here"
      }
    }
  }
}
```
- **Setup Difficulty:** Medium (needs Docker running)

---

#### 3. Playwright MCP ⭐ MUST HAVE
- **Source:** `@playwright/mcp` (Official Microsoft/Playwright)
- **What it solves for FashionConnect:** Visual testing of checkout flows, COD confirmation screens, brand dashboard, admin panels — agent can click through the UI and report what it sees
- **Student Pack:** Free (open source)
- **Config:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 4. Context7 MCP ⭐ MUST HAVE
- **Source:** `@upstash/context7-mcp` (Upstash)
- **What it solves for FashionConnect:** Every time I write NestJS code, Prisma queries, or BullMQ jobs — I get LIVE docs from the correct version. Prevents outdated API usage and hallucinations.
- **Student Pack:** Free tier available
- **Why it's critical:** NestJS, Prisma, and BullMQ all change frequently. Without this, AI agents use stale training data.
- **Config:**
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 5. Mem0 MCP — Persistent Memory ⭐ MUST HAVE
- **Source:** `mem0ai/mem0` (Mem0 — OpenMemory local version)
- **What it solves for FashionConnect:** Agent remembers: your coding decisions, why you chose BullMQ over Kafka, COD business rules, which endpoints are done, your team's naming conventions — across ALL sessions
- **Student Pack:** Free (open source local version)
- **Config:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@mem0/mem0-mcp@latest"],
      "env": {
        "MEM0_API_KEY": "your-mem0-key-or-use-local"
      }
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 6. Sentry MCP ⭐ HIGH PRIORITY
- **Source:** `https://mcp.sentry.dev/mcp` (Official Sentry — cloud hosted)
- **What it solves for FashionConnect:** Agent reads production errors, gets stack traces, triages issues, uses Sentry's AI root-cause analysis — without you having to switch tabs
- **Student Pack:** Sentry FREE — 50K errors/month, 100K transactions, 500 replays for 1 year ✅
- **Config (cloud hosted — recommended):**
```json
{
  "mcpServers": {
    "sentry": {
      "command": "uvx",
      "args": ["mcp-server-sentry", "--auth-token", "YOUR_SENTRY_AUTH_TOKEN"]
    }
  }
}
```
- **Setup Difficulty:** Easy ✅ (sign in with Sentry account)

---

#### 7. Datadog MCP ⭐ HIGH PRIORITY
- **Source:** Official Datadog MCP (datadoghq.com)
- **What it solves for FashionConnect:** Agent queries production metrics, searches logs, inspects APM traces, reads incident details — full observability from inside the IDE
- **Student Pack:** Datadog Pro FREE for 2 years — 10 servers ✅ (massive value)
- **Config:**
```json
{
  "mcpServers": {
    "datadog": {
      "command": "npx",
      "args": ["-y", "@datadog/mcp-server"],
      "env": {
        "DATADOG_API_KEY": "your-datadog-api-key",
        "DATADOG_APP_KEY": "your-datadog-app-key",
        "DATADOG_SITE": "datadoghq.com"
      }
    }
  }
}
```
- **Setup Difficulty:** Medium

---

#### 8. New Relic MCP
- **Source:** `@newrelic/mcp-server` (Official New Relic)
- **What it solves for FashionConnect:** Alternative to Datadog — full observability, log analysis, performance metrics, incident tracking
- **Student Pack:** New Relic FREE for students ($300/mo value) ✅
- **Config:**
```json
{
  "mcpServers": {
    "newrelic": {
      "command": "npx",
      "args": ["-y", "@newrelic/mcp-server"],
      "env": {
        "NEWRELIC_API_KEY": "your-api-key",
        "NEWRELIC_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```
- **Note:** Choose EITHER Datadog OR New Relic — both do the same job. Datadog is slightly better for Egyptian-market deployments (EU region support).
- **Setup Difficulty:** Easy ✅

---

#### 9. Stripe MCP
- **Source:** Official Stripe MCP (stripe.com)
- **What it solves for FashionConnect:** Future international payment support — agent can test Stripe payment flows, inspect transactions, debug webhook events
- **Student Pack:** Stripe waives fees on first $1,000 revenue ✅
- **Config:**
```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/agent-toolkit@latest"],
      "env": {
        "STRIPE_SECRET_KEY": "sk_test_your-key-here"
      }
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 10. LocalStack MCP
- **Source:** `@localstack/localstack-mcp-server` (Official LocalStack)
- **What it solves for FashionConnect:** Emulate AWS services (S3 for image uploads, SQS as alternative to BullMQ, SNS for notifications) locally without AWS costs
- **Student Pack:** LocalStack FREE for students ✅
- **Config:**
```json
{
  "mcpServers": {
    "localstack": {
      "command": "npx",
      "args": ["-y", "@localstack/localstack-mcp-server"],
      "env": {
        "LOCALSTACK_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```
- **Setup Difficulty:** Medium

---

#### 11. Notion MCP
- **Source:** Official Notion MCP
- **What it solves for FashionConnect:** Sync team documentation, meeting notes, sprint decisions directly into the IDE context
- **Student Pack:** Notion Education Plan FREE ✅
- **Config:**
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer your-notion-token\", \"Notion-Version\": \"2022-06-28\"}"
      }
    }
  }
}
```
- **Setup Difficulty:** Medium

---

#### 12. Firecrawl MCP
- **Source:** `@mendableai/firecrawl-mcp-server`
- **What it solves for FashionConnect:** Agent can scrape Paymob docs, Egyptian delivery company APIs, competitor research — converts any website to clean markdown instantly
- **Student Pack:** Free tier available
- **Config:**
```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "your-api-key"
      }
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 13. Docker MCP
- **Source:** Docker Desktop MCP Toolkit (Official Docker)
- **What it solves for FashionConnect:** Agent manages your containers, inspects logs, rebuilds services, checks health — without you running terminal commands manually
- **Student Pack:** Docker Desktop is free
- **Note:** Install Docker Desktop — it now includes a built-in MCP Toolkit with a catalog of pre-built MCP servers
- **Setup Difficulty:** Easy ✅ (visual UI in Docker Desktop)

---

#### 14. Filesystem MCP
- **Source:** `@modelcontextprotocol/server-filesystem` (Official Anthropic)
- **What it solves for FashionConnect:** Agent gets unrestricted access to read/write your full project directory — essential for large refactoring tasks
- **Student Pack:** Free (open source)
- **Config:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "d:/fashionconnect"]
    }
  }
}
```
- **Setup Difficulty:** Easy ✅

---

#### 15. Slack MCP
- **Source:** Official Slack MCP
- **What it solves for FashionConnect:** Agent sends deployment notifications, sprint completion messages, error alerts to your team Slack channel automatically
- **Student Pack:** Slack Free (generous for small teams)
- **Config:**
```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "SLACK_TEAM_ID": "your-team-id"
      }
    }
  }
}
```
- **Setup Difficulty:** Medium

---

#### 16. Doppler MCP — Secrets Management
- **Source:** Doppler MCP
- **What it solves for FashionConnect:** Agent can read and inject environment variables securely — no hardcoded secrets, no .env files in Git
- **Student Pack:** Doppler Team FREE for students ✅
- **Why critical:** You have JWT secrets, Paymob keys, DB passwords, Redis URLs — Doppler keeps them all safe and centralized
- **Setup Difficulty:** Medium

---

#### 17. BrowserStack MCP
- **Source:** Official BrowserStack MCP
- **What it solves for FashionConnect:** Cross-browser testing of your marketplace UI — test on Chrome, Firefox, Safari, mobile browsers
- **Student Pack:** BrowserStack Automate Mobile Plan FREE for 1 year ✅
- **Setup Difficulty:** Medium

---

### TIER 2 — HIGHLY RECOMMENDED (Free/Open Source, No Student Pack Needed)

| MCP | Purpose | npm Package |
|---|---|---|
| **Git MCP** | Agent runs git status, diff, log, commit | `@modelcontextprotocol/server-git` |
| **Redis MCP** | Inspect BullMQ queues, cache keys, debug jobs | Community server |
| **Memory MCP** | Graph-based persistent memory (alternative to Mem0) | `@modelcontextprotocol/server-memory` |
| **Postgres MCP** | Direct SQL queries against your PostgreSQL DB | `@modelcontextprotocol/server-postgres` |
| **Brave Search MCP** | Web search from inside agent | `@modelcontextprotocol/server-brave-search` |

---

## 🎓 STUDENT PACK → MCP MAPPING (Complete)

| Student Pack Tool | Has MCP? | MCP Name | Value |
|---|---|---|---|
| **GitHub Pro** | ✅ YES | GitHub MCP (Docker) | Create PRs, manage issues |
| **Sentry** | ✅ YES | Sentry MCP (cloud) | Error triage from IDE |
| **Datadog** | ✅ YES | Datadog MCP | Full observability |
| **New Relic** | ✅ YES | New Relic MCP | Log & metric queries |
| **Stripe** | ✅ YES | Stripe MCP | Payment testing |
| **LocalStack** | ✅ YES | LocalStack MCP | AWS emulation |
| **Notion** | ✅ YES | Notion MCP | Docs integration |
| **1Password** | ✅ YES | 1Password MCP | Secrets access |
| **Doppler** | ✅ YES | Doppler MCP | Env var management |
| **DigitalOcean** | 🟡 Partial | Community DO MCP | Droplet management |
| **MongoDB** | ✅ YES | MongoDB MCP | Atlas integration |
| **Heroku** | ❌ No official MCP | — | Use CLI |
| **JetBrains** | ❌ IDE (not MCP) | — | Full IDEs free |
| **Clerk** | 🟡 Partial | Custom via API | Auth management |
| **BrowserStack** | ✅ YES | BrowserStack MCP | Cross-browser testing |
| **Travis CI** | ❌ No MCP | — | Use GitHub Actions instead |
| **Microsoft Azure** | 🟡 Via Azure SRE | Datadog+Azure connector | Cloud management |

---

## 📚 SKILLS TO CREATE FOR FASHIONCONNECT

Skills live in `.agents/skills/` inside your Git repo. Every developer who clones the repo gets them automatically.

### Create These Skills Now:

---

### Skill 1: `nestjs-architecture`
**Path:** `d:\fashionconnect\.agents\skills\nestjs-architecture\SKILL.md`

**Key rules to encode:**
- Every feature is a NestJS module with `module.ts`, `controller.ts`, `service.ts`, `dto/`
- Business logic goes in services ONLY — controllers are thin
- Use `@Injectable()` for all services, register in module providers
- Use `class-validator` decorators on every DTO
- Use `@UseGuards(JwtAuthGuard, RolesGuard)` on protected routes
- Use `@Roles(UserRole.ADMIN)` for role-specific endpoints
- Return consistent `{ data, message, statusCode }` format
- Never return raw Prisma objects — always map to response DTOs

---

### Skill 2: `prisma-patterns`
**Path:** `d:\fashionconnect\.agents\skills\prisma-patterns\SKILL.md`

**Key rules to encode:**
- Always use `prisma.$transaction()` for operations that touch multiple tables
- Use soft deletes (`deletedAt`) — never hard delete products, orders, or financial data
- Always use `select` to limit returned fields — never return full user/brand records with passwords
- For pagination: use `{ skip, take, cursor }` pattern
- For financial queries: always use `Decimal` type, never `Float`
- Load relations explicitly with `include` — never rely on lazy loading
- Migration naming: `YYYYMMDD_descriptive_name`

---

### Skill 3: `cod-workflow`
**Path:** `d:\fashionconnect\.agents\skills\cod-workflow\SKILL.md`

**Key rules to encode:**
- COD is a WORKFLOW not just a payment type
- COD order states: `placed → accepted → handed_to_delivery → out_for_delivery → delivered → collected → remitted`
- COD collection by courier creates a ledger entry — it is NOT automatically a settled payment
- Remittance requires admin approval before brand payout is triggered
- COD risk scoring: flag orders with repeated cancellations from same address/phone
- Never mark a COD order as financially settled until delivery company confirms remittance
- COD reconciliation report: brand sees pending vs settled COD amounts separately

---

### Skill 4: `ledger-financial-model`
**Path:** `d:\fashionconnect\.agents\skills\ledger-financial-model\SKILL.md`

**Key rules to encode:**
- ALL financial data is append-only — no UPDATE on financial records, ever
- Every financial event creates a new ledger entry with: `amount, type, referenceId, createdAt, status`
- Brand balance = sum of all credit entries minus sum of all debit entries from the ledger
- Wallet balance = derived from ledger, NOT stored as a mutable field
- Payout requires: (1) admin approval, (2) dual authorization above threshold, (3) audit log entry
- Use `Decimal` type for all money — never `Float` or `Number`
- Refund = new negative ledger entry — not a modification of original entry

---

### Skill 5: `rbac-auth`
**Path:** `d:\fashionconnect\.agents\skills\rbac-auth\SKILL.md`

**Key rules to encode:**
- JWT access token: short expiry (15 min), contains `{ userId, role, permissions[] }`
- Refresh token: long expiry (7 days), stored in DB with `deviceId`, revocable
- OTP: single-use, 6-digit, expires in 5 minutes, stored hashed
- Role hierarchy: `ADMIN > SUB_ADMIN > BRAND > DELIVERY_COMPANY > COURIER > END_USER`
- `@Roles()` decorator for endpoint access, `@Permissions()` for granular sub-admin scopes
- Never trust userId from request body — always extract from JWT token
- Rate limit OTP requests: max 3 attempts per 15 minutes per phone number

---

### Skill 6: `api-contract-standards`
**Path:** `d:\fashionconnect\.agents\skills\api-contract-standards\SKILL.md`

**Key rules to encode:**
- Every endpoint must have: `@ApiOperation`, `@ApiResponse`, `@ApiTags` (Swagger decorators)
- Success response: `{ data: T, message: string, statusCode: 200 }`
- Error response: `{ error: string, message: string, statusCode: number }`
- Pagination response: `{ data: T[], meta: { total, page, limit, totalPages } }`
- HTTP methods: GET (read), POST (create), PATCH (partial update), DELETE (soft delete)
- URL format: `/api/v1/{resource}` — always versioned
- OpenAPI spec must be regenerated (`npm run build:openapi`) before every PR merge
- All DTOs exported from `dto/` folder within the module

---

### Skill 7: `security-checklist`
**Path:** `d:\fashionconnect\.agents\skills\security-checklist\SKILL.md`

**Key rules to encode:**
- Every input passes through class-validator DTO — no raw `req.body` access
- Use `helmet()` middleware for HTTP security headers
- Use `express-rate-limit` or Redis rate limiting for all auth endpoints
- Never log passwords, tokens, or payment credentials
- Admin actions: always create an audit log entry (`admin_actions` table)
- Financial mutations: always log with userId, action, timestamp, amount
- Use parameterized queries (Prisma does this automatically — never use raw SQL with string interpolation)
- Validate all file uploads: type, size, extension before storing

---

### Skill 8: `testing-standards`
**Path:** `d:\fashionconnect\.agents\skills\testing-standards\SKILL.md`

**Key rules to encode:**
- Unit tests: test service methods in isolation with mocked Prisma client
- Integration tests: use Supertest to hit actual endpoints with test DB
- Test DB: separate `test` database, seeded before each test suite
- Test naming: `describe('ServiceName') → describe('methodName') → it('should...')`
- Always test: happy path, unauthorized access, invalid input, not found case
- Coverage threshold: minimum 80% for services, 70% for controllers
- Mock external services (Paymob, SMS gateway) — never call real APIs in tests
- Before each test: seed minimum required data. After each: clean up.

---

## ⚙️ COMPLETE MCP CONFIG FILE FOR ANTIGRAVITY IDE

Save this as your MCP configuration (paste into Antigravity IDE settings → MCP section):

```json
{
  "mcpServers": {
    "prisma": {
      "command": "npx",
      "args": ["-y", "prisma", "mcp"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "d:/fashionconnect"]
    },
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
               "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_PAT_HERE"
      }
    },
    "sentry": {
      "command": "uvx",
      "args": ["mcp-server-sentry", "--auth-token", "YOUR_SENTRY_TOKEN"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@mem0/mem0-mcp@latest"]
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "YOUR_FIRECRAWL_KEY"
      }
    }
  }
}
```

---

## 🚀 THE AGENTIC SUPERPOWER WORKFLOW

Once MCPs + Skills are set up, this is what a complete feature cycle looks like — all autonomous:

```
1. READ REQUIREMENTS
   Context7 MCP → fetches latest NestJS/Prisma docs
   Mem0 MCP     → recalls team decisions from past sessions
   Filesystem   → reads existing code for context

2. WRITE CODE
   Antigravity  → writes NestJS module following nestjs-architecture skill
   Prisma MCP   → validates schema before writing queries
   api-contract → enforces response format and OpenAPI decorators

3. RUN TESTS
   Playwright   → visual test of new UI flows
   Terminal     → runs Jest unit + integration tests

4. FIX ERRORS
   Sentry MCP   → reads stack traces if errors occur
   Datadog MCP  → checks if performance degraded

5. UPDATE DOCS
   Prisma MCP   → updates schema docs
   Filesystem   → updates OpenAPI spec file

6. OPEN PR
   GitHub MCP   → creates PR with description, assigns reviewers
   Slack MCP    → notifies team in channel

7. DEPLOY & MONITOR
   Docker MCP   → rebuilds containers
   Datadog MCP  → confirms metrics are healthy post-deploy
```

---

## 📋 SETUP SEQUENCE (Do In This Order)

**Day 1 — Core Setup (30 min)**
1. Install Prisma MCP → `npx prisma mcp` (just run it, it auto-configures)
2. Install Context7 → add to Antigravity MCP config
3. Install Filesystem MCP → add with path `d:/fashionconnect`
4. Install Playwright MCP → add to config
5. Create `d:\fashionconnect\.agents\skills\` folder structure

**Day 2 — Team & Monitoring (1 hour)**
6. Create GitHub PAT → install GitHub MCP
7. Activate Sentry student pack → install Sentry MCP
8. Activate Datadog student pack → install Datadog MCP
9. Write first 3 Skills: `nestjs-architecture`, `prisma-patterns`, `api-contract-standards`

**Week 1 — Complete Setup**
10. Activate Doppler student pack → centralize all secrets
11. Install Mem0 MCP → enable persistent memory
12. Install Firecrawl MCP → for documentation scraping
13. Write remaining Skills: `cod-workflow`, `ledger-financial-model`, `rbac-auth`, `security-checklist`, `testing-standards`

---

*Researched live — August 2026*
*Sources: modelcontextprotocol.io, smithery.ai, github.com/punkpeye/awesome-mcp-servers, mcp.so, official docs*

---

# 🚀 The Ultimate Guide to Your AI's Superpowers (MCP Servers)

Think of the **Model Context Protocol (MCP)** as giving your AI assistant (like me) a set of robotic arms and tools. Without MCP, I am just a chatbot in a box that can only talk to you. **With MCP**, I can actually *do things* in the real world—like writing files, reading your database, searching the web, or checking your Jira tickets.

Here is a detailed, plain-English explanation of exactly what each of your MCP "tools" does, along with examples of what you can ask me to do with them.

---

## 📁 Core System Tools

### 1. `filesystem` (Your Hard Drive)
*   **What it does:** This is my most important tool. It gives me permission to securely read, write, edit, and search the files in your `d:/fashionconnect` folder. 
*   **How to use it:** You don't have to do anything special. Just ask me to code!
*   **Example prompts:**
    *   *"Read the `index.js` file and find the bug."*
    *   *"Create a new folder called `components` and write a React button inside it."*

### 2. `memory` (The AI's Brain)
*   **What it does:** Usually, when we start a new chat, I forget everything from the last chat. The `memory` server acts as a permanent brain. I can save important facts about your project here (like "Always use TypeScript" or "The database password is X") so I remember them forever across all future chats.
*   **Example prompts:**
    *   *"Remember that my preferred styling library is Tailwind CSS."*
    *   *"Recall what we decided about the database architecture last week."*

---

## 🗄️ Databases & Infrastructure

### 3. `postgres` (Direct Database Access)
*   **What it does:** I can connect directly to your `fashionconnect` database. Instead of you having to open a database viewer (like pgAdmin or DBeaver) to check your data, I can run SQL queries for you right here in the chat.
*   **Example prompts:**
    *   *"Check the `users` table and tell me how many users registered today."*
    *   *"Find the user with email 'test@example.com' and delete their account."*

### 4. `prisma` (Database ORM)
*   **What it does:** Since you use Prisma to manage your database, this tool lets me read your Prisma schema (the blueprint of your database), run database migrations, and even test Prisma queries to make sure they work before we put them in your code.
*   **Example prompts:**
    *   *"Look at my Prisma schema and add a new `Orders` table."*
    *   *"Run the Prisma migration to update my database."*

### 5. `localstack` (Fake AWS for Testing)
*   **What it does:** LocalStack simulates Amazon Web Services (AWS) on your local computer so you don't have to pay Amazon while testing. This tool lets me interact with your fake AWS services (like uploading files to a fake S3 bucket).
*   **Example prompts:**
    *   *"Check if the image uploaded successfully to my LocalStack S3 bucket."*

---

## 🌐 Research & Web Browsing

### 6. `bravesearch` (Live Internet Search)
*   **What it does:** AI models are trained on data from the past. If you ask me about a brand-new software update that came out yesterday, I won't know it. But with `bravesearch`, I can actively search Google/Brave right now to read the latest news or find solutions to obscure errors.
*   **Example prompts:**
    *   *"Search the web for the latest Next.js 15 routing changes."*
    *   *"Search for how to fix the error code I just got."*

### 7. `firecrawl` (Website Scanner)
*   **What it does:** If you give me a URL, `firecrawl` visits that website, strips away all the messy ads and menus, and extracts the pure text so I can read it perfectly. It's amazing for reading external documentation.
*   **Example prompts:**
    *   *"Go to `https://docs.stripe.com/api` and tell me how to create a payment intent."*

### 8. `context7` (The Developer's Library)
*   **What it does:** This is a specialized, massive database of documentation for tools like React, Tailwind, Next.js, etc. Instead of me "guessing" how a library works based on old data, I use this tool to fetch the 100% accurate, up-to-date official manuals.
*   **Example prompts:**
    *   *"Fetch the latest Context7 documentation for Tailwind CSS grids and show me an example."*

---

## 🐛 Testing & Debugging

### 9. `playwright` (The Robot Browser)
*   **What it does:** Playwright is a tool that opens a real Chrome browser and clicks around like a human. I can use this tool to open your website, click buttons, fill out forms, and tell you if things are broken visually.
*   **Example prompts:**
    *   *"Open `localhost:3000`, click the Login button, and tell me if the popup appears."*

### 10. `sentry` (The Crash Detective)
*   **What it does:** Sentry tracks errors when your app is live. If a user complains your app crashed, I can use this tool to log into your Sentry account, find the exact crash report, read the stack trace, and write the code to fix it.
*   **Example prompts:**
    *   *"Look up the most recent crash in Sentry and tell me which file caused it."*

---

## 🏢 Teamwork & Management

### 11. `github` (Source Control)
*   **What it does:** I can control your GitHub account. I can read code from other branches, see what your coworkers changed, commit my own code, or create Pull Requests for you to review.
*   **Example prompts:**
    *   *"Read the comments on my open Pull Request and fix the issues my coworker pointed out."*
    *   *"Create a new branch and commit the changes we just made."*

### 12. `jira` (Ticket Management)
*   **What it does:** I can log into your Jira board. If your boss assigns you a ticket, I can read the requirements directly from Jira and even move the ticket to "In Progress" for you.
*   **Example prompts:**
    *   *"What tickets are assigned to me in Jira for this sprint?"*
    *   *"Move ticket PROJ-123 to 'Done'."*

### 13. `slack` (Team Communication)
*   **What it does:** I can send messages to your team's Slack channels or read what your team is talking about to gather context for a feature you're building.
*   **Example prompts:**
    *   *"Send a message to the `#engineering` Slack channel saying the deployment is finished."*

### 14. `notion` (Documentation)
*   **What it does:** I can read your company's Notion documents (like product requirements or feature specs) to understand what you want me to build, or I can write a summary of our work into a Notion page.
*   **Example prompts:**
    *   *"Read the 'User Login Specs' Notion page and build the feature exactly as described there."*

---

## 🤖 AI Models

### 15. `notebooklm` (Document Analysis)
*   **What it does:** Google NotebookLM lets you upload massive PDFs (like legal documents or huge manuals). I can use this tool to ask NotebookLM highly specific questions about those huge documents without having to read them myself.

### 16. `kimi-mcp-server` (Alternative Brain)
*   **What it does:** Sometimes you might want a second opinion from a different AI model. This tool allows me to "call" the Kimi AI model and ask it for help on a specific problem.
