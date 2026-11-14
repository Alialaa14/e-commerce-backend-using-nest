import { ApiProperty } from '@nestjs/swagger';
import { courierDocuments } from '../../generated/prisma';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class InviteCourierDto {
  @ApiProperty({ example: 'courier@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber!: string;

  @ApiProperty({ enum: courierDocuments, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(courierDocuments, { each: true })
  documents!: courierDocuments[];

  @ApiProperty({ example: 'ABC-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  plateNumber!: string;
}
