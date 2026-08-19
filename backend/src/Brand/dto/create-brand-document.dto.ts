import { IsArray, IsEnum } from 'class-validator';
import { BrandDocType } from '../../generated/prisma/client';

export class CreateBrandDocumentDto {
  @IsArray()
  @IsEnum(BrandDocType, { each: true })
  docTypes!: BrandDocType[];
}
