import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignCourierDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  courierId!: string;
}
