import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class updateCartDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  price?: number;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  cartNote?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
  // todo : add user location
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  userLocation?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber()
  userNumber?: string;
}

/**
 data: {
      price: number;
      totalPrice: number;
      cartNote?: string;
      discount?: number;
      userLocation?: string;
      userNumber?: string;
    },
 */
