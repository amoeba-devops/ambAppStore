import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AsmJwtPayload } from './interfaces/jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { entity_code: string; email: string; password: string }) {
    const result = await this.authService.login(body.entity_code, body.email, body.password);
    return successResponse(result);
  }

  @Public()
  @Post('ama-sso')
  @HttpCode(HttpStatus.OK)
  async amaSso(@Body() body: { ama_token: string }) {
    const result = await this.authService.amaSsoExchange(body.ama_token);
    return successResponse(result);
  }

  @Auth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AsmJwtPayload,
    @Body() body: { current_password: string; new_password: string },
  ) {
    const result = await this.authService.changePassword(user.sub, body.current_password, body.new_password);
    return successResponse(result);
  }

  @Auth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: AsmJwtPayload) {
    const result = await this.authService.refreshToken(user);
    return successResponse(result);
  }

  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return successResponse({ message: 'Logged out successfully' });
  }
}
