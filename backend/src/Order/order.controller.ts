import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../generated/prisma';
import { UpdateBranchOrderStatusDto } from './dto/update-branch-order-status.dto';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Patch('branches/:branchOrderId/status')
  @Roles(Role.BRANCH_MANAGER, Role.Branch_Sales)
  updateBranchOrderStatus(
    @getCurrentUser() actor: AuthUser,
    @Param('branchOrderId', ParseUUIDPipe) branchOrderId: string,
    @Body() dto: UpdateBranchOrderStatusDto,
  ) {
    return this.orderService.updateBranchOrderStatus(
      actor,
      branchOrderId,
      dto.status,
    );
  }
}
