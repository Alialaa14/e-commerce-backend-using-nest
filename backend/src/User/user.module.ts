import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { MailModule } from '../utils/email/email.module';
import { MulterModule } from '../utils/multer/multer.module';
import { OtpModule } from '../utils/Otp/otp.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { TokenModule } from '../utils/Token/token.module';
import { UserController } from './user.controller';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { ProfileController } from './profile.controller';
import { UserModel } from './user.model';
import { UserService } from './user.service';
@Module({
  controllers: [UserController, AddressController, ProfileController],
  providers: [UserModel, UserService, AddressService, AuthGuard, RolesGuard],
  exports: [UserModel, UserService],
  imports: [
    PrismaModule,
    CloudinaryModule,
    MailModule,
    OtpModule,
    TokenModule,
    MulterModule,
  ],
})
export class UserModule {}
