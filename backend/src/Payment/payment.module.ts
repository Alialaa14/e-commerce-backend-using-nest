import { Module } from '@nestjs/common';
import { CheckoutModule } from './checkout/checkout.module';
import { CustomerModule } from './customer/customer.module';
import { SetupIntentModule } from './setupIntent/setupIntent.module';
import { AccountModule } from './account/account.module';
import { TransferModule } from './transfer/transfer.module';
import { PayoutModule } from './payout/payout.module';
@Module({
  exports: [],
  imports: [
    CheckoutModule,
    CustomerModule,
    SetupIntentModule,
    AccountModule,
    TransferModule,
    PayoutModule,
  ],
  providers: [],
  controllers: [],
})
export class PaymentModule {}
