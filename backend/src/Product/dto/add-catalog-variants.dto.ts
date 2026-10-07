import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CatalogVariantDto } from './catalog-variant.dto';

export class AddCatalogVariantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CatalogVariantDto)
  variants!: CatalogVariantDto[];

  @IsOptional()
  @IsBoolean()
  makeAvailableAtAllBranches?: boolean;
}
