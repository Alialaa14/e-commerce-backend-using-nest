import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { TokenModule } from '../../utils/Token/token.module';
@Module({
  exports: [],
  providers: [AccountService],
  controllers: [AccountController],
  imports: [PrismaModule, StripeModule, TokenModule],
})
export class AccountModule {}
