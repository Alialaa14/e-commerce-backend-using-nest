import { IsNotEmpty, IsNumber, IsString, MinLength } from 'class-validator';

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

  @IsString()
  location!: string; // JSON string containing {latitude, longitude}

  @IsString()
  branchName!: string;
}
