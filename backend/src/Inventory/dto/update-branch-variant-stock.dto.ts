import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBranchVariantStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  onHand!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
