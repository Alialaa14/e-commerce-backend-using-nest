import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { StripeModule } from '../Payment/stripe/stripe.module';
import { PrismaModule } from '../utils/prisma/prisma.module';

@Module({
  exports: [],
  imports: [StripeModule, PrismaModule],
  providers: [],
  controllers: [WebhookController],
})
export class WebhookModule {}
