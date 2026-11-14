import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { orderStatus } from '../../generated/prisma';

export class UpdateBranchOrderStatusDto {
  @IsEnum(orderStatus)
  status: orderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  deliveryCompanyId?: string;
}
