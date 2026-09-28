import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { UserModel } from './user.model';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { MailService } from '../utils/email/email.service';
import { otpEmailTemplate } from '../utils/email/emailTemplates';
import { OtpService } from '../utils/Otp/otp.service';
import { TokenService } from '../utils/Token/token.service';

interface SignupPendingPayload {
  purpose: 'signup-pending';
  username: string;
  email: string;
  password: string;
  picture?: { url: string; id: string };
  otpHash: string;
}

interface ResetPasswordPayload {
  purpose: 'reset-password';
  id: string;
}

interface VerifyOtpPayload {
  purpose: 'verify-otp';
  id: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly userModel: UserModel,
    private readonly cloudinaryService: CloudinaryService,
    private readonly mailService: MailService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    username: string,
    email: string,
    password: string,
    filePath?: string,
  ) {
    const existingUser = await this.userModel.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let picture: { url: string; id: string } | undefined;

    if (filePath) {
      // const isRemoteUrl = /^https?:\/\//i.test(filePath); fo
      try {
        const result = await this.cloudinaryService.uploadToCloudinary(
          filePath,
          'users',
        );
        picture = { url: result.secure_url, id: result.public_id };
      } catch (error) {
        console.log(error);
        throw new BadRequestException('File upload failed');
      }
    }

    const generatedOtp = this.otpService.generateOtp(10);
    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(generatedOtp.otp, otpSalt);

    try {
      await this.mailService.sendEmail(
        email,
        'Sign up Verification',
        otpEmailTemplate({
          name: username,
          otp: generatedOtp.otp,
          expiresInMinutes: generatedOtp.otp_expiration_minutes,
          appName: 'Fashion Connect',
          supportEmail: 'example@gmail.com',
        }),
      );
    } catch (error) {
      console.log(error);
      if (picture?.id) {
        await this.cloudinaryService.deleteFromCloudinary(picture.id);
      }
      throw error;
    }

    const token = this.tokenService.signCustomToken<SignupPendingPayload>(
      {
        purpose: 'signup-pending',
        username,
        email,
        password: hashedPassword,
        picture,
        otpHash: hashedOtp,
      },
      generatedOtp.otp_expiration_minutes * 60,
    );

    return { Token: token, expiration: generatedOtp.otp_expiration_minutes };
  }

  async verifyRegisterOtp(token: string, otp: string) {
    const payload =
      this.tokenService.verifyCustomToken<SignupPendingPayload>(token);

    if (payload?.purpose !== 'signup-pending') {
      throw new BadRequestException('Invalid registration session');
    }

    const otpMatches = await bcrypt.compare(otp, payload.otpHash);
    if (!otpMatches) {
      throw new BadRequestException('OTP does not match');
    }

    const existingUser = await this.userModel.findByEmail(payload.email);
    if (existingUser) {
      if (payload.picture?.id) {
        await this.cloudinaryService.deleteFromCloudinary(payload.picture.id);
      }
      throw new ConflictException('Email already exists');
    }
    console.log(payload.picture?.url);

    await this.userModel.createUser({
      username: payload.username,
      email: payload.email,
      password: payload.password,
      picture_url: payload.picture?.url,
      picture_url_id: payload.picture?.id,
      isVerified: true,
    });
  }

  async getCurrentUser(userId: string) {
    const user = await this.userModel.findProfileById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      picture_url: user.picture_url,
    };
  }

  async login(identifier: string, password: string) {
    const user = await this.userModel.findUserByIdentifier(identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is locked');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Account is banned');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.userModel.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
    });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: user.id,
      role: user.role,
    });
    await this.userModel.updateAfterLogin(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiration: this.configService.get<number>(
        'ACCESS_TOKEN_EXPIRY',
      ),
      refreshTokenExpiration: this.configService.get<number>(
        'REFRESH_TOKEN_EXPIRY',
      ),
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        picture_url: user.picture_url,
      },
    };
  }

  async logout(refreshToken?: string, accessToken?: string) {
    if (!accessToken && !refreshToken) {
      throw new UnauthorizedException('No token');
    }

    try {
      const payload = accessToken
        ? this.tokenService.verifyAccessToken<{ sub: string }>(accessToken)
        : this.tokenService.verifyRefreshToken<{ sub: string }>(refreshToken!);
      await this.userModel.setOffline(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async sendOtp(email: string, purpose: 'resetpassword' | 'signup') {
    if (purpose !== 'resetpassword' && purpose !== 'signup') {
      throw new BadRequestException('Invalid purpose');
    }

    const user = await this.userModel.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const generatedOtp = this.otpService.generateOtp(5);

    await this.mailService.sendEmail(
      email,
      'OTP Verification',
      otpEmailTemplate({
        name: user.username,
        otp: generatedOtp.otp,
        expiresInMinutes: generatedOtp.otp_expiration_minutes,
        appName: 'Fashion Connect',
        supportEmail: 'example@gmail.com',
      }),
    );

    const token = this.tokenService.signCustomToken<ResetPasswordPayload>(
      { id: user.id, purpose: 'reset-password' },
      generatedOtp.otp_expiration_minutes * 60,
    );

    await this.userModel.updateOtp(
      user.id,
      generatedOtp.otp,
      generatedOtp.otp_expiration_date,
      purpose,
    );

    return { Token: token, expiration: generatedOtp.otp_expiration_minutes };
  }

  async verifyOtp(token: string, otp: string) {
    const payload =
      this.tokenService.verifyCustomToken<ResetPasswordPayload>(token);

    if (payload?.purpose !== 'reset-password') {
      throw new BadRequestException('Invalid session');
    }

    const user = await this.userModel.findById(payload.id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.otp_expiration || new Date() > user.otp_expiration) {
      throw new BadRequestException('OTP expired');
    }
    if (user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.userModel.clearOtp(user.id);

    const verifyToken = this.tokenService.signCustomToken<VerifyOtpPayload>(
      { id: user.id, purpose: 'verify-otp' },
      5 * 60,
    );

    return { Token: verifyToken, expiration: 5 };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload =
      this.tokenService.verifyCustomToken<VerifyOtpPayload>(token);

    if (payload?.purpose !== 'verify-otp') {
      throw new BadRequestException('Invalid session');
    }

    const user = await this.userModel.findById(payload.id);
    if (!user) throw new NotFoundException('User not found');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await this.userModel.updatePassword(user.id, hashedPassword);
  }

  async refreshAccessToken(incomingRefreshToken: string) {
    const payload = this.tokenService.verifyRefreshToken<{ sub: string }>(
      incomingRefreshToken,
    );

    const user = await this.userModel.findById(payload.sub);
    if (!user) throw new NotFoundException('User not found');

    if (user.refreshToken !== incomingRefreshToken) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Account banned');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account locked');
    }

    const newAccessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
    });
    const newRefreshToken = this.tokenService.signRefreshToken({
      sub: user.id,
      role: user.role,
    });
    await this.userModel.updateRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiration: this.configService.get<number>(
        'ACCESS_TOKEN_EXPIRY',
      ),
      refreshTokenExpiration: this.configService.get<number>(
        'REFRESH_TOKEN_EXPIRY',
      ),
    };
  }
}
