import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrderModule } from '../Order/order.module';
import { StaffModule } from '../Staff/staff.module';
import { SocketModule } from '../Socket/socket.module';
import { CloudinaryModule } from '../utils/cloudinary/cloudinary.module';
import { PrismaModule } from '../utils/prisma/prisma.module';
import { MulterModule } from '../utils/multer/multer.module';
import { CourierController } from './courier.controller';
import { DeliveryCompanyController } from './delivery-company.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [
    PrismaModule,
    StaffModule,
    OrderModule,
    SocketModule,
    MulterModule,
    CloudinaryModule,
  ],
  controllers: [DeliveryCompanyController, CourierController],
  providers: [DeliveryService, AuthGuard, RolesGuard],
})
export class DeliveryModule {}
