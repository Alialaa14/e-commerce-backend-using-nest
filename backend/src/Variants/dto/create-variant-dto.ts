import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum SizeEnum {
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
  XXXL = 'XXXL',
  XXXXL = '4XL',
  XXXXXL = '5XL',
  XXXXXXL = '6XL',
  XXXXXXXL = '7XL',
}

export class createVariantDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  color!: string;

  @IsNotEmpty()
  @IsEnum(SizeEnum, { each: true })
  size!: SizeEnum;

  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  stock!: number;
}
