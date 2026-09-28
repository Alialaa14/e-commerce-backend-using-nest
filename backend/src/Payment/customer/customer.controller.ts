import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { getCurrentUser } from '../../common/decorators/Current-user-decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async createCustomer(@getCurrentUser() user: { sub: string; role: string }) {
    return this.customerService.createCustomer(user.sub);
  }
  @Patch()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async updateCustomer(
    @getCurrentUser() user: { sub: string; role: string },
    @Body() stripeCustomerId: string,
  ) {
    return this.customerService.updateCustomer(user.sub, stripeCustomerId);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async getCustomer(@getCurrentUser() user: { sub: string; role: string }) {
    return this.customerService.getCustomer(user.sub);
  }
}
