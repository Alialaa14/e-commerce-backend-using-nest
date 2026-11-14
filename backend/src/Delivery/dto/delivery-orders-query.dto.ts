import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { orderStatus } from '../../generated/prisma';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DeliveryOrdersQueryDto {
  @ApiPropertyOptional({ enum: orderStatus })
  @IsOptional()
  @IsEnum(orderStatus)
  status?: orderStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
