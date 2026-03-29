import { Controller, Get, Patch, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('users')
@Controller('admin/users')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN)
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    const list = await this.service.findAllByEntity(user.ent_id!);
    return successListResponse(list);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findById(id);
    return successResponse(result);
  }

  @Patch(':id/role')
  async changeRole(@Param('id') id: string, @Body() body: { role: string }) {
    const result = await this.service.changeRole(id, body.role);
    return successResponse(result);
  }

  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const result = await this.service.changeStatus(id, body.status);
    return successResponse(result);
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string) {
    const tempPassword = await this.service.resetPassword(id);
    return successResponse({ tempPassword });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id);
    return successResponse({ message: 'Deleted' });
  }
}
