import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProductDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  name!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  categoryId!: string;
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  price!: number;
}
