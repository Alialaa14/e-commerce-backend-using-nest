import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  governorate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  building?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+20|0)?1[0125]\d{8}$/)
  contactPhone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
