import { Module } from '@nestjs/common';
import { TokenModule } from '../../utils/Token/token.module';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { SetupIntentService } from './setupIntent.service';
import { SetupIntentController } from './setupIntent.controller';

@Module({
  controllers: [SetupIntentController],
  providers: [SetupIntentService],
  exports: [],
  imports: [TokenModule, PrismaModule, StripeModule],
})
export class SetupIntentModule {}
