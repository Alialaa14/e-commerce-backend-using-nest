import {
  IsNotEmpty,
  IsNumber,
  IsString,
  isUUID,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class updateVariantDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  color!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(3)
  size!: string;

  @IsUUID()
  @IsNotEmpty()
  @IsString()
  productId!: string;
}

export class updateVariantParamDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
