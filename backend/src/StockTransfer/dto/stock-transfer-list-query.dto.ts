import { Type } from 'class-transformer';
import { TransferStatus } from '../../generated/prisma';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class StockTransferListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;
}
