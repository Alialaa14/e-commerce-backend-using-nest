import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailModule } from '../utils/email/email.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [ConfigModule, PrismaModule, MailModule],
  controllers: [StaffController],
  providers: [StaffService, AuthGuard, RolesGuard],
})
export class StaffModule {}
