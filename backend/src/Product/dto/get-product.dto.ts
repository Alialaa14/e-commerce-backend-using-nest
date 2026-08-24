import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class getProductDto {
  @IsUUID()
  @IsNotEmpty()
  @IsString()
  id!: string;
}
