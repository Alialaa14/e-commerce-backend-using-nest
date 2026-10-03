import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreatePayoutDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @Matches(/^[a-z]{3}$/)
  currency!: string;

  @IsOptional()
  @IsIn(['standard', 'instant'])
  method?: 'standard' | 'instant';
}
