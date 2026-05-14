import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';

export class MeResponse {
  userId: string;
  entityId: string;
  entityCode: string;
  email: string;
  name: string;
  roles: string[];
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('me')
export class MeController {
  @Get()
  @Auth()
  @ApiOperation({ summary: '현재 로그인한 사용자 정보 (JWT 기반)' })
  me(@CurrentUser() user: AmaJwtPayload): ApiSuccess<MeResponse> {
    return ok({
      userId: user.userId,
      entityId: user.entityId,
      entityCode: user.entityCode,
      email: user.email,
      name: user.name,
      roles: user.roles ?? [],
    });
  }
}
