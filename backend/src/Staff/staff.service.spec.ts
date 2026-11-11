import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../generated/prisma';
import { MailService } from '../utils/email/email.service';
import { PrismaService } from '../utils/prisma/prisma.service';
import { StaffService } from './staff.service';

const runTransaction = (transaction: unknown) =>
  jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
    callback(transaction),
  );

describe('StaffService', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('https://fashionconnect.test'),
  };
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  const mailService = { sendEmail } as unknown as MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getOrThrow.mockReturnValue('https://fashionconnect.test');
  });

  it('allows only admins to invite customer-service agents', async () => {
    const service = new StaffService(
      {} as PrismaService,
      mailService,
      configService as never,
    );

    await expect(
      service.inviteCustomerService(
        { sub: 'owner-1', role: 'brandOwner' },
        'agent@example.com',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('allows only admins to list customer-service agents', async () => {
    const service = new StaffService(
      {} as PrismaService,
      mailService,
      configService as never,
    );

    await expect(
      service.listCustomerServiceAgents({
        sub: 'owner-1',
        role: Role.brandOwner,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a customer-service invitation with its role assigned by the server', async () => {
    let createInput: unknown;
    const create = jest.fn((input: unknown) => {
      createInput = input;
      return Promise.resolve({
        id: 'invitation-1',
        email: 'agent@example.com',
        role: Role.customer_Service,
        expiresAt: new Date(),
        brandId: null,
        branchId: null,
      });
    });
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      staffInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(transaction),
      },
    } as unknown as PrismaService;
    const service = new StaffService(
      prismaService,
      mailService,
      configService as never,
    );

    await service.inviteCustomerService(
      { sub: 'admin-1', role: 'admin' },
      ' AGENT@example.com ',
    );

    const createdData = asRecord(asRecord(createInput).data);
    expect(createdData.email).toBe('agent@example.com');
    expect(createdData.role).toBe(Role.customer_Service);
    expect(createdData.createdById).toBe('admin-1');
    expect(typeof createdData.tokenHash).toBe('string');
    expect(createdData.expiresAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledWith(
      'agent@example.com',
      expect.any(String),
      expect.stringContaining('accept-staff-invitation'),
      expect.stringContaining('accept-staff-invitation'),
    );
  });

  it('does not let a brand owner invite a manager into another brand branch', async () => {
    const create = jest.fn();
    const branchFindFirst = jest.fn().mockResolvedValue(null);
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      staffInvitation: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        create,
      },
    };
    const prismaService = {
      prisma: {
        brand: {
          findFirst: jest.fn().mockResolvedValue({ id: 'brand-1' }),
        },
        brandBranch: { findFirst: branchFindFirst },
        $transaction: runTransaction(transaction),
      },
    } as unknown as PrismaService;
    const service = new StaffService(
      prismaService,
      mailService,
      configService as never,
    );

    await expect(
      service.inviteBranchManager(
        { sub: 'owner-1', role: 'brandOwner', brandId: 'brand-1' },
        'brand-1',
        'branch-2',
        'manager@example.com',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(create).not.toHaveBeenCalled();
    expect(branchFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'branch-2',
        brandId: 'brand-1',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('rejects inviting an email that already has an active invitation', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'invitation-1',
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      staffInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst,
        create: jest.fn(),
      },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(transaction),
      },
    } as unknown as PrismaService;
    const service = new StaffService(
      prismaService,
      mailService,
      configService as never,
    );

    await expect(
      service.inviteCustomerService(
        { sub: 'admin-1', role: 'admin' },
        'AGENT@example.com',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates a sales invitation scoped to the branch manager branch', async () => {
    let createInput: unknown;
    const create = jest.fn((input: unknown) => {
      createInput = input;
      return Promise.resolve({
        id: 'invitation-1',
        email: 'sales@example.com',
        role: Role.Branch_Sales,
        expiresAt: new Date(),
        brandId: 'brand-1',
        branchId: 'branch-1',
      });
    });
    const transaction = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      staffInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const prismaService = {
      prisma: {
        branchStaff: {
          findUnique: jest.fn().mockResolvedValue({
            isActive: true,
            role: 'manager',
            branch: {
              id: 'branch-1',
              brandId: 'brand-1',
              isActive: true,
              deletedAt: null,
            },
          }),
        },
        $transaction: runTransaction(transaction),
      },
    } as unknown as PrismaService;
    const service = new StaffService(
      prismaService,
      mailService,
      configService as never,
    );

    await expect(
      service.inviteBranchSales(
        {
          sub: 'manager-1',
          role: 'BRANCH_MANAGER',
          brandId: 'brand-1',
          branchId: 'branch-1',
        },
        'branch-1',
        ' SALES@example.com ',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        email: 'sales@example.com',
        role: Role.Branch_Sales,
        branchId: 'branch-1',
      }),
    );
    const createdData = asRecord(asRecord(createInput).data);
    expect(createdData.email).toBe('sales@example.com');
    expect(createdData.role).toBe(Role.Branch_Sales);
    expect(createdData.brandId).toBe('brand-1');
    expect(createdData.branchId).toBe('branch-1');
    expect(createdData.createdById).toBe('manager-1');
  });

  it('creates the invited branch role and membership when accepted', async () => {
    const invitation = {
      id: 'invitation-1',
      email: 'manager@example.com',
      role: Role.BRANCH_MANAGER,
      brandId: 'brand-1',
      branchId: 'branch-1',
    };
    let userCreateInput: unknown;
    const userCreate = jest.fn((input: unknown) => {
      userCreateInput = input;
      return Promise.resolve({
        id: 'user-1',
        username: 'Branch Manager',
        email: invitation.email,
        role: Role.BRANCH_MANAGER,
        brandId: invitation.brandId,
        branchId: invitation.branchId,
      });
    });
    const membershipCreate = jest.fn().mockResolvedValue({});
    const transaction = {
      staffInvitation: {
        findFirst: jest.fn().mockResolvedValue(invitation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      brandBranch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }),
      },
      user: { create: userCreate },
      branchStaff: { create: membershipCreate },
    };
    const prismaService = {
      prisma: {
        $transaction: runTransaction(transaction),
      },
    } as unknown as PrismaService;
    const service = new StaffService(
      prismaService,
      mailService,
      configService as never,
    );

    await service.acceptInvitation(
      'invitation-token',
      invitation.email,
      'Branch Manager',
      'SecurePass12345',
    );

    const createdUser = asRecord(asRecord(userCreateInput).data);
    expect(createdUser.role).toBe(Role.BRANCH_MANAGER);
    expect(createdUser.brandId).toBe('brand-1');
    expect(createdUser.branchId).toBe('branch-1');
    expect(createdUser.isVerified).toBe(true);
    expect(membershipCreate).toHaveBeenCalledWith({
      data: {
        branchId: 'branch-1',
        userId: 'user-1',
        role: 'manager',
      },
    });
  });

  function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError('Expected an object');
    }
    return value as Record<string, unknown>;
  }
});
