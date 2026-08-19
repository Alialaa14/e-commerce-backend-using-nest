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
import { UserModel } from './user.model';
import { UserService } from './user.service';
@Module({
  controllers: [UserController],
  providers: [UserModel, UserService, AuthGuard, RolesGuard],
  exports: [UserModel],
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
