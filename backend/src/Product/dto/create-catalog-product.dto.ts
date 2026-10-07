import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CatalogVariantDto } from './catalog-variant.dto';

class ProductMediaDto {
  @IsString()
  secure_url!: string;

  @IsString()
  public_id!: string;
}

export class CreateCatalogProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media?: ProductMediaDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CatalogVariantDto)
  variants!: CatalogVariantDto[];

  @IsOptional()
  @IsBoolean()
  makeAvailableAtAllBranches?: boolean;
}
