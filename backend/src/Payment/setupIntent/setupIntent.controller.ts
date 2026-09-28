import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SetupIntentService } from './setupIntent.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { getCurrentUser } from '../../common/decorators/Current-user-decorator';

@Controller('setup-intent')
export class SetupIntentController {
  constructor(private readonly setupIntentService: SetupIntentService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('user')
  async createSetupIntent(
    @getCurrentUser() user: { sub: string; role: string },
  ): Promise<any> {
    return this.setupIntentService.createSetupIntent(user.sub);
  }
}
