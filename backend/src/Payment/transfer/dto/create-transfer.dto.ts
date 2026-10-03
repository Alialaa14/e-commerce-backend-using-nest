import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @Matches(/^[a-z]{3}$/)
  currency!: string;

  @IsString()
  @MinLength(1)
  @Matches(/^acct_[A-Za-z0-9]+$/)
  destination!: string;

  @IsUUID()
  orderId!: string;
}
