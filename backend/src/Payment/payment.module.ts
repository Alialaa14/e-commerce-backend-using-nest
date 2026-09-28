import { Module } from '@nestjs/common';
import { CheckoutModule } from './checkout/checkout.module';
import { CustomerModule } from './customer/customer.module';
import { SetupIntentModule } from './setupIntent/setupIntent.module';
@Module({
  exports: [],
  imports: [CheckoutModule, CustomerModule, SetupIntentModule],
  providers: [],
  controllers: [],
})
export class PaymentModule {}
