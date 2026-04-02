import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { DrdJwtPayload } from './interfaces/jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('ama-sso')
  @HttpCode(HttpStatus.OK)
  async amaSso(@Body() body: { ama_token: string }) {
    const result = await this.authService.amaSsoExchange(body.ama_token);
    return successResponse(result);
  }

  @Public()
  @Post('ama-entry')
  @HttpCode(HttpStatus.OK)
  async amaEntry(
    @Body() body: { ent_id: string; ent_code: string; ent_name: string; email: string },
  ) {
    const result = await this.authService.amaEntryLogin(
      body.ent_id,
      body.ent_code,
      body.ent_name,
      body.email,
    );
    return successResponse(result);
  }
}
