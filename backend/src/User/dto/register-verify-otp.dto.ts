import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Length(5)
  otp!: string;
  @IsNotEmpty()
  @IsString()
  token!: string;
}
