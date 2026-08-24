import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class getAllCartsDto {
  @IsOptional()
  @IsString()
  @Min(1)
  page?: number;
  @IsOptional()
  @IsString()
  @Min(0)
  limit?: number;

  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsString()
  orderType?: 'asc' | 'desc';

  @IsOptional()
  @IsUUID()
  userId?: string;
}
