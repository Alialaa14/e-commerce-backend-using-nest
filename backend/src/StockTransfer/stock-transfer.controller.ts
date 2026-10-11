import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { ReceiveStockTransferDto } from './dto/receive-stock-transfer.dto';
import { StockTransferListQueryDto } from './dto/stock-transfer-list-query.dto';
import { StockTransferService } from './stock-transfer.service';

@Controller('stock-transfers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('brandOwner', 'BRANCH_MANAGER')
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Post()
  async create(
    @getCurrentUser() user: AuthUser,
    @Body() dto: CreateStockTransferDto,
  ) {
    return {
      success: true,
      message: 'Stock transfer requested successfully',
      data: await this.stockTransferService.createTransfer(user, dto),
    };
  }

  @Get()
  async list(
    @getCurrentUser() user: AuthUser,
    @Query() query: StockTransferListQueryDto,
  ) {
    const result = await this.stockTransferService.listTransfers(user, query);
    return {
      success: true,
      message: 'Stock transfers retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':transferId')
  async get(
    @getCurrentUser() user: AuthUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ) {
    return {
      success: true,
      message: 'Stock transfer retrieved successfully',
      data: await this.stockTransferService.getTransfer(user, transferId),
    };
  }

  @Post(':transferId/approve')
  async approve(
    @getCurrentUser() user: AuthUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ) {
    return {
      success: true,
      message: 'Stock transfer approved successfully',
      data: await this.stockTransferService.approveTransfer(user, transferId),
    };
  }

  @Post(':transferId/ship')
  async ship(
    @getCurrentUser() user: AuthUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ) {
    return {
      success: true,
      message: 'Stock transfer shipped successfully',
      data: await this.stockTransferService.shipTransfer(user, transferId),
    };
  }

  @Post(':transferId/receive')
  async receive(
    @getCurrentUser() user: AuthUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: ReceiveStockTransferDto,
  ) {
    return {
      success: true,
      message: 'Stock transfer receipt recorded successfully',
      data: await this.stockTransferService.receiveTransfer(
        user,
        transferId,
        dto.items,
      ),
    };
  }

  @Post(':transferId/cancel')
  async cancel(
    @getCurrentUser() user: AuthUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
  ) {
    return {
      success: true,
      message: 'Stock transfer cancelled successfully',
      data: await this.stockTransferService.cancelTransfer(user, transferId),
    };
  }
}
