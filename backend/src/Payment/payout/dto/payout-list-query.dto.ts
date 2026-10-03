import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class PayoutListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  @Matches(/^po_[A-Za-z0-9]+$/)
  starting_after?: string;

  @IsOptional()
  @IsString()
  @Matches(/^po_[A-Za-z0-9]+$/)
  ending_before?: string;
}
