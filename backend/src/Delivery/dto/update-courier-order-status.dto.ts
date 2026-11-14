import { ApiProperty } from '@nestjs/swagger';
import { orderStatus } from '../../generated/prisma';
import { IsIn } from 'class-validator';

export class UpdateCourierOrderStatusDto {
  @ApiProperty({
    enum: [orderStatus.shipping, orderStatus.delivering, orderStatus.returned],
  })
  @IsIn([orderStatus.shipping, orderStatus.delivering, orderStatus.returned])
  status!: orderStatus;
}
