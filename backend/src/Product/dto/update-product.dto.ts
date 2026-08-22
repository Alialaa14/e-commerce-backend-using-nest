import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class updateProductParamDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
export class updateProductDto {
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
}
