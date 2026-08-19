// otp.service.ts
import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';

export interface GeneratedOtp {
  otp: string;
  otp_expiration_date: Date;
  otp_expiration_minutes: number;
}

@Injectable()
export class OtpService {
  generateOtp(expirationMinutes: number): GeneratedOtp {
    const nanoidGenerator = customAlphabet('0123456789', 5);
    const otp = nanoidGenerator();
    const otp_expiration_date = new Date(
      Date.now() + expirationMinutes * 60 * 1000,
    );

    return {
      otp,
      otp_expiration_date,
      otp_expiration_minutes: expirationMinutes,
    };
  }

  isExpired(expirationDate: Date): boolean {
    return Date.now() > expirationDate.getTime();
  }
}
