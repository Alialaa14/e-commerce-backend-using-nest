import { IsEnum } from 'class-validator';
import { orderStatus } from '../../generated/prisma';

export class UpdateBranchOrderStatusDto {
  @IsEnum(orderStatus)
  status: orderStatus;
}
