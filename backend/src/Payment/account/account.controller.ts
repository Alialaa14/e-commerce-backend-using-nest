import { Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { getCurrentUser } from '../../common/decorators/Current-user-decorator';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('brand', 'delievryC', 'user')
  async createAccount(@getCurrentUser() user: { sub: string }) {
    return this.accountService.createAccount(user.sub);
  }

  @Patch()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('brand', 'delievryC', 'user')
  async updateAccount(@getCurrentUser() user: { sub: string }) {
    return this.accountService.updateAccount(user.sub);
  }

  @Post('/close')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('brand', 'delievryC', 'user')
  async closeAccount(@getCurrentUser() user: { sub: string }) {
    return this.accountService.closeAccount(user.sub);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async getAccounts() {
    return this.accountService.getAccounts();
  }

  @Get('/me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('brand', 'delievryC', 'user')
  async getAccount(@getCurrentUser() user: { sub: string }) {
    return this.accountService.getAccount(user.sub);
  }
}
