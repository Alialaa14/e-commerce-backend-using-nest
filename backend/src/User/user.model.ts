import { PrismaService } from '../utils/prisma/prisma.service';
import { Role } from '../generated/prisma/client';
import { Injectable } from '@nestjs/common';
@Injectable()
export class UserModel {
  constructor(private readonly prismaService: PrismaService) {}
  async findById(id: string) {
    return this.prismaService.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        picture_url: true,
        refreshToken: true,
        isBanned: true,
        isOnline: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        otp: true,
        otp_expiration: true,
        otp_purpose: true,
        passwordChangedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    console.log(this.prismaService.prisma);
    return this.prismaService.prisma.user.findFirst({
      where: { email },
    });
  }

  async findProfileById(userId: string) {
    return this.prismaService.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        picture_url: true,
      },
    });
  }

  async findUserByIdentifier(identifier: string) {
    return this.prismaService.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    picture_url?: string;
    picture_url_id?: string;
    isVerified?: boolean;
  }) {
    return this.prismaService.prisma.user.create({ data });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async updateAfterLogin(userId: string, refreshToken: string) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        isOnline: true,
        refreshToken,
      },
    });
  }

  async incrementFailedAttempts(userId: string) {
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return;
    const failedAttempts = user.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };
    if (failedAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async updateOtp(
    userId: string,
    otp: string,
    expiration: Date,
    purpose: string,
  ) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { otp, otp_expiration: expiration, otp_purpose: purpose as any },
    });
  }

  async clearOtp(userId: string) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { otp: null, otp_expiration: null, otp_purpose: null },
    });
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });
  }

  async setOffline(userId: string) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, isOnline: false },
    });
  }

  async updateUser(
    userId: string,
    data: {
      username?: string;
      email?: string;
      phone?: string;
      picture_url?: string | null;
      picture_url_id?: string | null;
      isVerified?: boolean;
      role?: Role;
    },
  ) {
    return this.prismaService.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
