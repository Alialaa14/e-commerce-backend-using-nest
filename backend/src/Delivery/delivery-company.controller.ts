import {
  Body,
  Controller,
  Get,
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
import { InviteStaffDto } from '../Staff/dto/invite-staff.dto';
import { CloudinaryService } from '../utils/cloudinary/cloudinary.service';
import { UploadedFastifyFile } from '../utils/multer/multer-file.decorator';
import { MultipartInterceptor } from '../utils/multer/multer.interceptor';
import { MulterService } from '../utils/multer/multer.service';
import { AssignCourierDto } from './dto/assign-courier.dto';
import { CreateDeliveryCompanyDto } from './dto/create-delivery-company.dto';
import { DeliveryOrdersQueryDto } from './dto/delivery-orders-query.dto';
import { InviteCourierDto } from './dto/invite-courier.dto';
import { UpdateCourierManagementDto } from './dto/update-courier-management.dto';
import { UpdateDeliveryCompanyDto } from './dto/update-delivery-company.dto';
import { UpdateDeliveryCompanyVerificationDto } from './dto/update-delivery-company-verification.dto';
import { DeliveryImageFile, uploadDeliveryImage } from './delivery-image.util';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery-companies')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('delivery-companies')
export class DeliveryCompanyController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly multerService: MulterService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create a delivery-company profile' })
  @ApiResponse({ status: 201, description: 'Company profile created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  createCompany(
    @getCurrentUser() actor: AuthUser,
    @Body() dto: CreateDeliveryCompanyDto,
  ) {
    return this.deliveryService.createCompany(actor, dto);
  }

  @Post(':deliveryCompanyId/manager-invitations')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Invite a manager to claim a company profile' })
  @ApiParam({ name: 'deliveryCompanyId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  inviteCompanyManager(
    @getCurrentUser() actor: AuthUser,
    @Param('deliveryCompanyId', ParseUUIDPipe) deliveryCompanyId: string,
    @Body() dto: InviteStaffDto,
  ) {
    return this.deliveryService.inviteCompanyManager(
      actor,
      deliveryCompanyId,
      dto.email,
    );
  }

  @Patch(':deliveryCompanyId/verification')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Verify or suspend delivery-company operations' })
  @ApiParam({ name: 'deliveryCompanyId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Verification status updated' })
  updateCompanyVerification(
    @getCurrentUser() actor: AuthUser,
    @Param('deliveryCompanyId', ParseUUIDPipe) deliveryCompanyId: string,
    @Body() dto: UpdateDeliveryCompanyVerificationDto,
  ) {
    return this.deliveryService.setCompanyVerification(
      actor,
      deliveryCompanyId,
      dto.isVerified,
    );
  }

  @Get('me')
  @Roles(Role.deliveryC)
  @ApiOperation({ summary: 'Get the authenticated company profile' })
  @ApiResponse({ status: 200, description: 'Company profile retrieved' })
  getMyCompany(@getCurrentUser() actor: AuthUser) {
    return this.deliveryService.getCompanyProfile(actor);
  }

  @Patch('me')
  @Roles(Role.deliveryC)
  @ApiOperation({ summary: 'Update the authenticated company profile' })
  @ApiResponse({ status: 200, description: 'Company profile updated' })
  updateMyCompany(
    @getCurrentUser() actor: AuthUser,
    @Body() dto: UpdateDeliveryCompanyDto,
  ) {
    return this.deliveryService.updateCompanyProfile(actor, dto);
  }

  @Get('me/couriers')
  @Roles(Role.deliveryC)
  @ApiOperation({ summary: 'List this company’s couriers' })
  @ApiResponse({ status: 200, description: 'Courier list retrieved' })
  listCouriers(@getCurrentUser() actor: AuthUser) {
    return this.deliveryService.listCouriers(actor);
  }

  @Post('me/couriers/invitations')
  @Roles(Role.deliveryC)
  @UseInterceptors(MultipartInterceptor)
  @ApiOperation({
    summary: 'Invite a courier and create their delivery profile',
  })
  @ApiResponse({ status: 201, description: 'Courier invitation sent' })
  async inviteCourier(
    @getCurrentUser() actor: AuthUser,
    @Body() dto: InviteCourierDto,
    @UploadedFastifyFile() photo: DeliveryImageFile | undefined,
  ) {
    const upload = await uploadDeliveryImage(
      photo,
      'delivery/couriers',
      this.multerService,
      this.cloudinaryService,
    );
    try {
      return await this.deliveryService.inviteCourier(actor, dto, {
        url: upload.secure_url,
        id: upload.public_id,
      });
    } catch (error) {
      try {
        await this.cloudinaryService.deleteFromCloudinary(upload.public_id);
      } catch (cleanupError) {
        console.error('Failed to remove an unused courier image', cleanupError);
      }
      throw error;
    }
  }

  @Patch('me/couriers/:courierId')
  @Roles(Role.deliveryC)
  @ApiOperation({ summary: 'Manage a courier in this company’s fleet' })
  @ApiParam({ name: 'courierId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Courier profile updated' })
  updateCourier(
    @getCurrentUser() actor: AuthUser,
    @Param('courierId', ParseUUIDPipe) courierId: string,
    @Body() dto: UpdateCourierManagementDto,
  ) {
    return this.deliveryService.updateCourierManagement(actor, courierId, dto);
  }

  @Get('me/orders')
  @Roles(Role.deliveryC)
  @ApiOperation({ summary: 'List orders handed to this company' })
  @ApiResponse({ status: 200, description: 'Delivery orders retrieved' })
  listOrders(
    @getCurrentUser() actor: AuthUser,
    @Query() query: DeliveryOrdersQueryDto,
  ) {
    return this.deliveryService.listCompanyOrders(actor, query);
  }

  @Patch('me/orders/:branchOrderId/assignment')
  @Roles(Role.deliveryC)
  @ApiOperation({
    summary: 'Assign one of this company’s couriers to an order',
  })
  @ApiParam({ name: 'branchOrderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Courier assigned' })
  assignCourier(
    @getCurrentUser() actor: AuthUser,
    @Param('branchOrderId', ParseUUIDPipe) branchOrderId: string,
    @Body() dto: AssignCourierDto,
  ) {
    return this.deliveryService.assignCourier(
      actor,
      branchOrderId,
      dto.courierId,
    );
  }
}
