import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('users/me/addresses')
@UseGuards(AuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  async list(@getCurrentUser() user: AuthUser) {
    return {
      success: true,
      message: 'Addresses retrieved successfully',
      data: { items: await this.addressService.list(user.sub) },
    };
  }

  @Post()
  async create(
    @getCurrentUser() user: AuthUser,
    @Body() dto: CreateAddressDto,
  ) {
    return {
      success: true,
      message: 'Address created successfully',
      data: await this.addressService.create(user.sub, dto),
    };
  }

  @Patch(':addressId')
  async update(
    @getCurrentUser() user: AuthUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return {
      success: true,
      message: 'Address updated successfully',
      data: await this.addressService.update(user.sub, addressId, dto),
    };
  }

  @Delete(':addressId')
  async remove(
    @getCurrentUser() user: AuthUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return {
      success: true,
      message: 'Address deleted successfully',
      data: await this.addressService.remove(user.sub, addressId),
    };
  }
}
