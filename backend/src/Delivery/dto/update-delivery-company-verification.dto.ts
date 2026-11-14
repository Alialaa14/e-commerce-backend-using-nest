import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateDeliveryCompanyVerificationDto {
  @ApiProperty()
  @IsBoolean()
  isVerified!: boolean;
}
