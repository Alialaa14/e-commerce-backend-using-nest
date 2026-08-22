import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard } from '../common/guards/auth.guard';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { MulterService } from '../utils/multer/multer.service';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/register-verify-otp.dto';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MultipartInterceptor } from '../utils/multer/multer.interceptor';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';

const isProduction = process.env.NODE_ENV === 'production';

const baseCookieOptions: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
} = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

@Controller('auth')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly uploadService: MulterService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('login')
  async login(
    @Body() body: { identifier: string; password: string },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.userService.login(body.identifier, body.password);

    res.setCookie('refreshToken', result.refreshToken, {
      ...baseCookieOptions,
      maxAge:
        Number(process.env.REFRESH_TOKEN_EXPIRY ?? 7 * 24 * 60 * 60) * 1000,
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        accessTokenExpiration: result.accessTokenExpiration,
        user: result.user,
      },
    };
  }

  @Post('register')
  @UseInterceptors(MultipartInterceptor)
  async register(
    @UploadedFastifyFile() picture: any,
    @Body() body: RegisterDto,
  ) {
    let filePath: string | undefined;
    try {
      filePath = await this.uploadService.saveToDisk(picture, `users`);
      return this.userService.register(
        body.username,
        body.email,
        body.password,
        filePath,
      );
    } catch (error) {
      console.log(error);
      throw new BadRequestException('File upload failed');
    } finally {
      await this.uploadService.deleteFile(filePath);
    }
  }
  @Post('register-verify-otp')
  async verifyRegisterOtp(@Body() body: VerifyOtpDto) {
    await this.userService.verifyRegisterOtp(body.token, body.otp);

    return {
      success: true,
      message: 'Email verified successfully. You can now login.',
    };
  }

  @Post('forget-password')
  async sendOtp(@Body() body: ForgetPasswordDto) {
    const result = await this.userService.sendOtp(
      body.email,
      body.purpose as 'resetpassword' | 'signup',
    );

    return {
      success: true,
      message: 'OTP sent to email',
      data: result,
    };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    const result = await this.userService.verifyOtp(body.token, body.otp);

    return {
      success: true,
      message: 'OTP verified successfully',
      data: result,
    };
  }

  @Patch('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.userService.resetPassword(body.token, body.newPassword);

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    const userId = user?.sub ?? user?.id;

    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const profile = await this.userService.getCurrentUser(userId);

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const refreshToken = (req as any).cookies?.refreshToken;
    const accessToken = req.headers.authorization?.split(' ')[1];

    await this.userService.logout(refreshToken, accessToken);
    res.clearCookie('refreshToken', baseCookieOptions);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Post('refresh-access-token')
  async refreshAccessToken(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const incomingRefreshToken = (req as any).cookies?.refreshToken;

    if (!incomingRefreshToken) {
      throw new Error('No refresh token provided');
    }

    const result =
      await this.userService.refreshAccessToken(incomingRefreshToken);

    res.setCookie('refreshToken', result.refreshToken, {
      ...baseCookieOptions,
      maxAge:
        Number(process.env.REFRESH_TOKEN_EXPIRY ?? 7 * 24 * 60 * 60) * 1000,
    });

    return {
      success: true,
      message: 'Access token refreshed',
      data: {
        accessToken: result.accessToken,
        accessTokenExpiration: result.accessTokenExpiration,
      },
    };
  }
}
