import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BranchRole, Prisma, Role } from '../generated/prisma';
import { PrismaService } from '../utils/prisma/prisma.service';
import { MailService } from '../utils/email/email.service';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

export interface StaffActor {
  sub: string;
  role: string;
  brandId?: string | null;
  branchId?: string | null;
}

const INVITATION_EXPIRY_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class StaffService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async inviteCustomerService(actor: StaffActor, email: string) {
    if (actor.role !== Role.admin) {
      throw new ForbiddenException(
        'Only platform admins can invite customer-service agents',
      );
    }

    return this.createInvitation({
      actorId: actor.sub,
      email,
      role: Role.customer_Service,
    });
  }

  async inviteBranchManager(
    actor: StaffActor,
    brandId: string,
    branchId: string,
    email: string,
  ) {
    if (actor.role !== Role.brandOwner || actor.brandId !== brandId) {
      throw new ForbiddenException(
        'Only the brand owner can invite branch managers for this brand',
      );
    }

    const ownedBrand = await this.prismaService.prisma.brand.findFirst({
      where: { id: brandId, userId: actor.sub, isActive: true },
      select: { id: true },
    });
    if (!ownedBrand) {
      throw new NotFoundException('Brand not found');
    }

    const branch = await this.prismaService.prisma.brandBranch.findFirst({
      where: {
        id: branchId,
        brandId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.createInvitation({
      actorId: actor.sub,
      email,
      role: Role.BRANCH_MANAGER,
      brandId,
      branchId,
    });
  }

  async inviteBranchSales(actor: StaffActor, branchId: string, email: string) {
    if (actor.role !== Role.BRANCH_MANAGER || actor.branchId !== branchId) {
      throw new ForbiddenException(
        'Only the branch manager can invite sales staff for this branch',
      );
    }

    const managerMembership =
      await this.prismaService.prisma.branchStaff.findUnique({
        where: {
          branchId_userId: { branchId, userId: actor.sub },
        },
        select: {
          isActive: true,
          role: true,
          branch: {
            select: {
              id: true,
              brandId: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      });
    if (
      !managerMembership?.isActive ||
      managerMembership.role !== BranchRole.manager ||
      !managerMembership.branch.isActive ||
      managerMembership.branch.deletedAt ||
      managerMembership.branch.brandId !== actor.brandId
    ) {
      throw new ForbiddenException('Active branch manager membership required');
    }

    return this.createInvitation({
      actorId: actor.sub,
      email,
      role: Role.Branch_Sales,
      brandId: managerMembership.branch.brandId,
      branchId,
    });
  }

  async acceptInvitation(
    token: string,
    email: string,
    username: string,
    password: string,
  ) {
    const tokenHash = this.hashToken(token);
    const normalizedEmail = this.normalizeEmail(email);
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    try {
      return await this.prismaService.prisma.$transaction(async (tx) => {
        const invitation = await tx.staffInvitation.findFirst({
          where: {
            tokenHash,
            email: normalizedEmail,
            expiresAt: { gt: now },
            acceptedAt: null,
            revokedAt: null,
          },
          select: {
            id: true,
            email: true,
            role: true,
            brandId: true,
            branchId: true,
          },
        });
        if (!invitation) {
          throw new BadRequestException(
            'Invitation is invalid, expired, or already used',
          );
        }

        const isBranchRole =
          invitation.role === Role.BRANCH_MANAGER ||
          invitation.role === Role.Branch_Sales;
        if (
          (invitation.role === Role.customer_Service &&
            (invitation.brandId || invitation.branchId)) ||
          (isBranchRole && (!invitation.brandId || !invitation.branchId)) ||
          (!isBranchRole && invitation.role !== Role.customer_Service)
        ) {
          throw new BadRequestException('Invitation has invalid role scope');
        }

        if (isBranchRole) {
          if (!invitation.brandId || !invitation.branchId) {
            throw new BadRequestException(
              'Invitation has invalid branch scope',
            );
          }
          const branch = await tx.brandBranch.findFirst({
            where: {
              id: invitation.branchId,
              brandId: invitation.brandId,
              isActive: true,
              deletedAt: null,
              brand: { isActive: true },
            },
            select: { id: true },
          });
          if (!branch) {
            throw new BadRequestException(
              'The invited branch is no longer available',
            );
          }
        }

        const claimed = await tx.staffInvitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Invitation has already been accepted or revoked',
          );
        }

        const user = await tx.user.create({
          data: {
            username: username.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: invitation.role,
            brandId: invitation.brandId,
            branchId: invitation.branchId,
            isVerified: true,
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            brandId: true,
            branchId: true,
          },
        });

        if (invitation.branchId) {
          await tx.branchStaff.create({
            data: {
              branchId: invitation.branchId,
              userId: user.id,
              role:
                invitation.role === Role.BRANCH_MANAGER
                  ? BranchRole.manager
                  : BranchRole.sales,
            },
          });
        }

        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account already exists for this email');
      }
      throw error;
    }
  }

  async listBranchStaff(actor: StaffActor, branchId: string) {
    if (actor.role !== Role.brandOwner && actor.role !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException('Branch staff access is not permitted');
    }

    if (actor.role === Role.BRANCH_MANAGER) {
      if (actor.branchId !== branchId) {
        throw new ForbiddenException('Branch staff access is not permitted');
      }
      const membership = await this.prismaService.prisma.branchStaff.findUnique(
        {
          where: {
            branchId_userId: { branchId, userId: actor.sub },
          },
          select: { isActive: true, role: true },
        },
      );
      if (!membership?.isActive || membership.role !== BranchRole.manager) {
        throw new ForbiddenException(
          'Active branch manager membership required',
        );
      }
    }

    const branch = await this.prismaService.prisma.brandBranch.findFirst({
      where: {
        id: branchId,
        isActive: true,
        deletedAt: null,
        ...(actor.role === Role.brandOwner
          ? { brand: { userId: actor.sub } }
          : { id: actor.branchId ?? '' }),
      },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.prismaService.prisma.branchStaff.findMany({
      where: { branchId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            isVerified: true,
          },
        },
      },
    });
  }

  async listCustomerServiceAgents(actor: StaffActor) {
    if (actor.role !== Role.admin) {
      throw new ForbiddenException('Only platform admins can list this staff');
    }

    return this.prismaService.prisma.user.findMany({
      where: { role: Role.customer_Service },
      orderBy: { created_At: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        isBanned: true,
        isVerified: true,
        created_At: true,
      },
    });
  }

  private async createInvitation(input: {
    actorId: string;
    email: string;
    role: Role;
    brandId?: string;
    branchId?: string;
  }) {
    const email = this.normalizeEmail(input.email);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_MS);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const invitationUrl = new URL('/accept-staff-invitation', frontendUrl);

    let invitation: {
      id: string;
      email: string;
      role: Role;
      expiresAt: Date;
      brandId: string | null;
      branchId: string | null;
    };
    try {
      invitation = await this.prismaService.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        });
        if (existingUser) {
          throw new ConflictException(
            'An account already exists for this email',
          );
        }

        await tx.staffInvitation.updateMany({
          where: {
            email,
            role: input.role,
            brandId: input.brandId ?? null,
            branchId: input.branchId ?? null,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { lte: now },
          },
          data: { revokedAt: now },
        });

        const existing = await tx.staffInvitation.findFirst({
          where: {
            email,
            role: input.role,
            brandId: input.brandId ?? null,
            branchId: input.branchId ?? null,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException(
            'An active invitation already exists for this email',
          );
        }

        return tx.staffInvitation.create({
          data: {
            email,
            role: input.role,
            brandId: input.brandId,
            branchId: input.branchId,
            tokenHash,
            expiresAt,
            createdById: input.actorId,
          },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            brandId: true,
            branchId: true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An active invitation already exists for this email',
        );
      }
      throw error;
    }
    invitationUrl.searchParams.set('token', token);

    try {
      await this.mailService.sendEmail(
        email,
        'FashionConnect staff invitation',
        `<p>You have been invited to join FashionConnect as ${invitation.role}.</p><p><a href="${invitationUrl.toString()}">Accept invitation</a></p><p>This link expires in 48 hours and can be used once.</p>`,
        `Accept your FashionConnect staff invitation: ${invitationUrl.toString()}`,
      );
    } catch {
      await this.prismaService.prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });
      throw new ServiceUnavailableException(
        'Unable to send the invitation email',
      );
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      brandId: invitation.brandId,
      branchId: invitation.branchId,
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
