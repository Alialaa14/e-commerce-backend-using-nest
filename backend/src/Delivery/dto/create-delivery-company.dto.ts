import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDeliveryCompanyDto {
  @ApiProperty({ example: 'Nile Express' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '12 Nile Street, Cairo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;

  @ApiProperty({ example: '+201012345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber!: string;
}
