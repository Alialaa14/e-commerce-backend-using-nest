import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../generated/prisma';
import { AcceptStaffInvitationDto } from './dto/accept-staff-invitation.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('customer-service/invitations')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.admin)
  inviteCustomerService(
    @getCurrentUser() actor: AuthUser,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.inviteCustomerService(actor, dto.email);
  }

  @Get('customer-service')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.admin)
  listCustomerServiceAgents(@getCurrentUser() actor: AuthUser) {
    return this.staffService.listCustomerServiceAgents(actor);
  }

  @Post('brands/:brandId/branches/:branchId/manager-invitations')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.brandOwner)
  inviteBranchManager(
    @getCurrentUser() actor: AuthUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.inviteBranchManager(
      actor,
      brandId,
      branchId,
      dto.email,
    );
  }

  @Post('branches/:branchId/sales-invitations')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.BRANCH_MANAGER)
  inviteBranchSales(
    @getCurrentUser() actor: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: InviteStaffDto,
  ) {
    return this.staffService.inviteBranchSales(actor, branchId, dto.email);
  }

  @Get('branches/:branchId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.brandOwner, Role.BRANCH_MANAGER)
  listBranchStaff(
    @getCurrentUser() actor: AuthUser,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.staffService.listBranchStaff(actor, branchId);
  }

  @Post('invitations/accept')
  acceptInvitation(@Body() dto: AcceptStaffInvitationDto) {
    return this.staffService.acceptInvitation(
      dto.token,
      dto.email,
      dto.username,
      dto.password,
    );
  }
}
