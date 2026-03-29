import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { successResponse, errorResponse } from '../common/dto/base-response.dto';

interface LoginDto {
  ent_id: string;
  email: string;
  password: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const { ent_id, email, password } = dto;

    if (!ent_id || !email || !password) {
      return errorResponse('PLT-E1001', 'Entity ID, email, and password are required');
    }

    // DEV/Staging: 간단한 자격 증명 검증 (추후 AMA SSO 연동으로 대체)
    // 현재는 password가 'amoeba1!' 이면 인증 통과
    if (password !== 'amoeba1!') {
      return errorResponse('PLT-E1002', 'Invalid credentials');
    }

    const name = email.split('@')[0] || 'User';
    const isAdmin = email.toLowerCase().includes('admin');

    const payload = {
      sub: `user-${ent_id}-${Date.now()}`,
      ent_id,
      ent_code: ent_id.toUpperCase(),
      email,
      name,
      level: isAdmin ? 'ADMIN_LEVEL' : 'USER_LEVEL',
      role: isAdmin ? 'ADMIN' : 'USER',
      roles: isAdmin ? ['ADMIN', 'USER'] : ['USER'],
    };

    const token = this.jwtService.sign(payload);

    return successResponse({
      token,
      user: {
        userId: payload.sub,
        entityId: payload.ent_id,
        entityCode: payload.ent_code,
        email: payload.email,
        name: payload.name,
        level: payload.level,
        roles: payload.roles,
      },
    });
  }
}
