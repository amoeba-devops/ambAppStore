import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { successResponse } from '../../common/dto/base-response.dto';

@ApiTags('users')
@Controller('profile')
@Auth()
export class ProfileController {
  constructor(private readonly service: UserService) {}

  @Get()
  async getProfile(@CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.findById(user.sub);
    return successResponse(result);
  }
}
