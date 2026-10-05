import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class CreateBranchOfferingDto {
  @IsUUID()
  variantId!: string;

  @IsOptional()
  @ValidateIf((dto: CreateBranchOfferingDto) => dto.price !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price?: number | null;
}

export class UpdateBranchOfferingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @ValidateIf((dto: UpdateBranchOfferingDto) => dto.price !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price?: number | null;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CopyOfferingsDto {
  @IsUUID()
  sourceBranchId!: string;
}
