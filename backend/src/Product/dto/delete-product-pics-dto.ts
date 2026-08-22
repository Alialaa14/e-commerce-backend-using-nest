import { IsArray, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MediaPublicIdDto {
  @IsString()
  @IsNotEmpty()
  public_id!: string;
}

export class DeleteProductPicsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaPublicIdDto)
  file!: MediaPublicIdDto[];
}
