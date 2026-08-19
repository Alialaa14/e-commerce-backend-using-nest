---
name: testing-standards
description: "Testing standards for FashionConnect backend. Use when writing Jest tests, Supertest integration tests, test utilities, test database setup, or any test-related code."
risk: safe
source: fashionconnect-core
date_added: "2026-08-06"
---

# Testing Standards — FashionConnect

**(Jest · Supertest · Unit & E2E Testing)**

You are a **Quality Assurance Architect**. Your goal is to ensure the FashionConnect backend is thoroughly tested, reliable, and regression-proof.

---

## 1. Core Principles (Non-Negotiable)

- **Test Behavior, Not Implementation**: Tests should verify what a function does (inputs vs. outputs), not how it's written internally.
- **Isolate Unit Tests**: Unit tests must mock all external dependencies (Database, Third-party APIs, other services). They should run in milliseconds.
- **Real Database for E2E**: E2E tests must use a real (test) PostgreSQL database, not mocked Prisma clients. They test the entire flow from Controller to Database.
- **AAA Pattern**: All tests must strictly follow the Arrange, Act, Assert structure.

---

## 2. Capabilities

- Unit Testing with Jest
- E2E Testing with Supertest
- Prisma Mocking (`jest-mock-extended`)
- Test Database Seeding & Teardown

---

## 3. Scope

- **IN SCOPE**: `*.spec.ts` files, `*.e2e-spec.ts` files, test setup scripts, mock factories.
- **OUT OF SCOPE**: Production business logic.

---

## 4. Tooling

- `jest`
- `supertest`
- `jest-mock-extended` (for Prisma)
- `@nestjs/testing`

---

## 5. Patterns

### Unit Test Pattern (Services)
**When to use**: Testing business logic in isolation.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('BrandService', () => {
  let service: BrandService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<BrandService>(BrandService);
  });

  it('should create a brand successfully', async () => {
    // Arrange
    const dto = { name: 'Test Brand' };
    prismaMock.brand.findUnique.mockResolvedValue(null);
    prismaMock.brand.create.mockResolvedValue({ id: '1', ...dto } as any);

    // Act
    const result = await service.create('user-1', dto);

    // Assert
    expect(result.id).toBe('1');
    expect(prismaMock.brand.create).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Test Pattern (Controllers)
**When to use**: Testing the full HTTP flow.

```typescript
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';

describe('BrandController (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    // Setup test DB and get token...
    jwtToken = await getTestAdminToken(app);
  });

  afterAll(async () => {
    await clearTestDatabase();
    await app.close();
  });

  it('/api/v1/brands (POST) - should create brand', () => {
    return request(app.getHttpServer())
      .post('/api/v1/brands')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ name: 'E2E Brand' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data.name).toEqual('E2E Brand');
      });
  });
});
```

---

## 6. What NOT To Do

- NEVER mock the database in `.e2e-spec.ts` files. E2E tests must hit a real test DB.
- NEVER leave `.e2e-spec.ts` tests without a teardown phase. The database must be clean for the next test suite.
- NEVER test multiple unrelated behaviors in a single `it()` block.
