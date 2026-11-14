import { ApiPropertyOptional } from '@nestjs/swagger';
import { courierDocuments } from '../../generated/prisma';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCourierManagementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Set after the company verifies the courier documents.',
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ example: 'ABC-123' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  plateNumber?: string;

  @ApiPropertyOptional({ enum: courierDocuments, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(courierDocuments, { each: true })
  documents?: courierDocuments[];
}
