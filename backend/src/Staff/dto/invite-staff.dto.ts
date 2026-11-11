import { IsEmail, MaxLength } from 'class-validator';

export class InviteStaffDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
