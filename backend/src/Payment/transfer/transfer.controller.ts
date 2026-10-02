import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferListQueryDto } from './dto/transfer-list-query.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { TransferService } from './transfer.service';

@Controller('transfers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  createTransfer(@Body() payload: CreateTransferDto) {
    return this.transferService.createTransfer(payload);
  }

  @Patch(':transferId')
  updateTransfer(
    @Param('transferId') transferId: string,
    @Body() payload: UpdateTransferDto,
  ) {
    return this.transferService.updateTransfer(transferId, payload);
  }

  @Get(':transferId')
  getTransfer(@Param('transferId') transferId: string) {
    return this.transferService.getTransfer(transferId);
  }

  @Get()
  getTransfers(@Query() query: TransferListQueryDto) {
    return this.transferService.getTransfers(query.limit);
  }
}
