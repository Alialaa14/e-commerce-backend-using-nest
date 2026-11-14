import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { getCurrentUser } from '../common/decorators/Current-user-decorator';
import type { AuthUser } from '../common/decorators/Current-user-decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';

@Controller('users/me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getProfile(@getCurrentUser() user: AuthUser) {
    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: await this.userService.getCurrentUser(user.sub),
    };
  }

  @Patch()
  async updateProfile(
    @getCurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return {
      success: true,
      message: 'Profile updated successfully',
      data: await this.userService.updateProfile(user.sub, dto),
    };
  }
}
