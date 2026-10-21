import { Module } from '@nestjs/common';
import { VariantReservationModel } from './Reservation.model';
import { VariantReservationService } from './Reservation.service';
import { InventoryModule } from '../Inventory/inventory.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { ExpiryReservationProcessor } from './Reservation-expiry.processor';
import { ExpiryReservationQueue } from './Reservation.constants';
export { ExpiryReservationQueue } from './Reservation.constants';
@Module({
  exports: [VariantReservationService],
  imports: [
    InventoryModule,
    PrismaModule,
    BullModule.registerQueue({ name: ExpiryReservationQueue }),
  ],
  controllers: [],
  providers: [
    VariantReservationModel,
    VariantReservationService,
    ExpiryReservationProcessor,
  ],
})
export class VariantReservationModule {}
