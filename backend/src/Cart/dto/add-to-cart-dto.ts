import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SizeEnum } from '../../Variants/dto/create-variant-dto';

class VariantDto {
  @IsNotEmpty()
  @IsEnum(SizeEnum)
  size!: SizeEnum;

  @IsNotEmpty()
  @IsString()
  color!: string;
}

export class AddToCartDto {
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => VariantDto)
  variant!: VariantDto;
}
