import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../generated/prisma';
import { UpdateBranchOrderStatusDto } from './dto/update-branch-order-status.dto';
import { OrderService } from './order.service';

@Controller('orders')
@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Patch('branches/:branchOrderId/status')
  @Roles(Role.BRANCH_MANAGER, Role.Branch_Sales)
  @ApiOperation({ summary: 'Advance a branch order or hand it to delivery' })
  @ApiResponse({ status: 200, description: 'Branch order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid order transition' })
  @ApiResponse({ status: 403, description: 'Branch access denied' })
  updateBranchOrderStatus(
    @getCurrentUser() actor: AuthUser,
    @Param('branchOrderId', ParseUUIDPipe) branchOrderId: string,
    @Body() dto: UpdateBranchOrderStatusDto,
  ) {
    return this.orderService.updateBranchOrderStatus(
      actor,
      branchOrderId,
      dto.status,
      dto.deliveryCompanyId,
    );
  }
}
