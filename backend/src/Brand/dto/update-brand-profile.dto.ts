import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBrandProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
