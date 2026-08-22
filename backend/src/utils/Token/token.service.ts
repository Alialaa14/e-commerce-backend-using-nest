// token.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  [key: string]: any;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>(
        'ACCESS_TOKEN_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  signRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>(
        'REFRESH_TOKEN_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
  }
  verifyAccessToken<T extends object = JwtPayload>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  verifyRefreshToken<T extends object = JwtPayload>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // Convenience: issue both at once (common on login)
  generateTokenPair(payload: JwtPayload): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
    };
  }

  decode<T extends object = any>(token: string): T | null {
    return this.jwtService.decode(token) as T | null;
  }

  signCustomToken<T extends object>(
    payload: T,
    expiresIn: string | number,
  ): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: expiresIn as any,
    });
  }

  verifyCustomToken<T extends object>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
