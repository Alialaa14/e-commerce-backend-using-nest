import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class ForgetPasswordDto {
  @IsNotEmpty()
  @IsString()
  email!: string;
  @IsNotEmpty()
  @IsString()
  @IsEnum(['resetpassword', 'signup'])
  purpose!: string;
}
