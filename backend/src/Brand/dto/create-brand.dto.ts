import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

class LocationDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @Transform(({ value }) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return plainToInstance(LocationDto, parsed);
    } catch {
      return value;
    }
  })
  @ValidateNested()
  location!: LocationDto;

  @IsString()
  @IsOptional()
  branchName?: string;
}
