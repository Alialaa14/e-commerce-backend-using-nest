import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class VariantDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  productId!: string;
  @IsNotEmpty()
  @IsString()
  color!: string;

  @IsNotEmpty()
  @IsString()
  size!: string;

  @IsNumber()
  @Min(0)
  stock!: number;
}

export class createProductDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsUUID()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discount?: number;
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  variants!: VariantDto[];
}
