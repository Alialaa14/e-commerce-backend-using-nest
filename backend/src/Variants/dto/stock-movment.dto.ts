import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
enum movmentType {
  in = 'in',
  out = 'out',
}
export class stockMovementDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNotEmpty()
  @IsEnum(movmentType)
  movmentType!: movmentType;
}
