import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('products')
@Controller('products')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    const list = await this.service.findAll(user.ent_id!);
    return successListResponse(list);
  }

  @Post()
  async create(@CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    const result = await this.service.create(user.ent_id!, body);
    return successResponse(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.findById(id, user.ent_id!);
    return successResponse(result);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    const result = await this.service.update(id, user.ent_id!, body);
    return successResponse(result);
  }

  @Delete(':id')
  @Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    await this.service.softDelete(id, user.ent_id!);
    return successResponse({ message: 'Deleted' });
  }
}
