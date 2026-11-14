import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../generated/prisma';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';
import { MultipartInterceptor } from '../utils/multer/multer.interceptor';
import { MulterService } from '../utils/multer/multer.service';
import { DeliveryOrdersQueryDto } from './dto/delivery-orders-query.dto';
import { UpdateCourierOrderStatusDto } from './dto/update-courier-order-status.dto';
import { UpdateCourierProfileDto } from './dto/update-courier-profile.dto';
import { DeliveryImageFile, uploadDeliveryImage } from './delivery-image.util';
import { DeliveryService } from './delivery.service';

@ApiTags('couriers')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.courier)
@Controller('courier')
export class CourierController {
  private readonly logger = new Logger(CourierController.name);

  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly multerService: MulterService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated courier profile' })
  @ApiResponse({ status: 200, description: 'Courier profile retrieved' })
  getMyProfile(@getCurrentUser() actor: AuthUser) {
    return this.deliveryService.getCourierProfile(actor);
  }

  @Patch('me')
  @UseInterceptors(MultipartInterceptor)
  @ApiOperation({ summary: 'Customize the authenticated courier profile' })
  @ApiResponse({ status: 200, description: 'Courier profile updated' })
  async updateMyProfile(
    @getCurrentUser() actor: AuthUser,
    @Body() dto: UpdateCourierProfileDto,
    @UploadedFastifyFile() photo: DeliveryImageFile | undefined,
  ) {
    if (!photo) {
      return this.deliveryService.updateCourierProfile(actor, dto);
    }

    const upload = await uploadDeliveryImage(
      photo,
      'delivery/couriers',
      this.multerService,
      this.cloudinaryService,
    );
    try {
      return await this.deliveryService.updateCourierProfile(actor, dto, {
        url: upload.secure_url,
        id: upload.public_id,
      });
    } catch (error) {
      try {
        await this.cloudinaryService.deleteFromCloudinary(upload.public_id);
      } catch (cleanupError) {
        this.logger.error(
          'Failed to remove an unused courier image',
          cleanupError,
        );
      }
      throw error;
    }
  }

  @Get('me/orders')
  @ApiOperation({
    summary: 'List orders assigned to the authenticated courier',
  })
  @ApiResponse({ status: 200, description: 'Assigned orders retrieved' })
  listMyOrders(
    @getCurrentUser() actor: AuthUser,
    @Query() query: DeliveryOrdersQueryDto,
  ) {
    return this.deliveryService.listCourierOrders(actor, query);
  }

  @Patch('me/orders/:branchOrderId/status')
  @ApiOperation({ summary: 'Advance an assigned order through delivery' })
  @ApiParam({ name: 'branchOrderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Delivery status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateOrderStatus(
    @getCurrentUser() actor: AuthUser,
    @Param('branchOrderId', ParseUUIDPipe) branchOrderId: string,
    @Body() dto: UpdateCourierOrderStatusDto,
  ) {
    return this.deliveryService.updateCourierOrderStatus(
      actor,
      branchOrderId,
      dto.status,
    );
  }

  @Post('me/orders/:branchOrderId/proof')
  @UseInterceptors(MultipartInterceptor)
  @ApiOperation({ summary: 'Upload proof and complete an assigned delivery' })
  @ApiParam({ name: 'branchOrderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Delivery proof recorded' })
  async submitDeliveryProof(
    @getCurrentUser() actor: AuthUser,
    @Param('branchOrderId', ParseUUIDPipe) branchOrderId: string,
    @UploadedFastifyFile() photo: DeliveryImageFile | undefined,
  ) {
    const upload = await uploadDeliveryImage(
      photo,
      'delivery/proofs',
      this.multerService,
      this.cloudinaryService,
    );
    try {
      return await this.deliveryService.completeCourierOrder(
        actor,
        branchOrderId,
        { url: upload.secure_url, id: upload.public_id },
      );
    } catch (error) {
      try {
        await this.cloudinaryService.deleteFromCloudinary(upload.public_id);
      } catch (cleanupError) {
        this.logger.error(
          'Failed to remove unused delivery proof',
          cleanupError,
        );
      }
      throw error;
    }
  }
}
