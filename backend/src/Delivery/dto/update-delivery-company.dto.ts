import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDeliveryCompanyDto {
  @ApiPropertyOptional({ example: 'Nile Express' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '12 Nile Street, Cairo' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: '+201012345678' })
  @IsOptional()
  @IsString()
  @MinLength(11)
  @MaxLength(20)
  phoneNumber?: string;
}
