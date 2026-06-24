import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { InquiryService } from '../service/inquiry.service';
import { InquiryMapper } from '../mapper/inquiry.mapper';
import { CreateInquiryRequest } from '../dto/request/create-inquiry.request';
import { UpdateInquiryStatusRequest } from '../dto/request/update-inquiry-status.request';
import { ListInquiriesQuery } from '../dto/request/list-inquiries.query';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { InquiryResponse } from '../dto/response/inquiry.response';

@ApiTags('inquiries')
@ApiBearerAuth('access-token')
@Controller('inquiries')
export class InquiryController {
  constructor(private readonly service: InquiryService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Inquiry 목록 (페이징·필터)' })
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query() query: ListInquiriesQuery,
  ): Promise<
    ApiSuccess<{
      items: InquiryResponse[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    const result = await this.service.findAll(user.entityId, query);
    return ok({
      items: InquiryMapper.toListResponse(result.items),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Inquiry 단건 조회' })
  async findOne(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<InquiryResponse>> {
    const entity = await this.service.findById(user.entityId, id);
    return ok(InquiryMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Inquiry 신규 생성 (수입국 환경 검증 포함)' })
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: CreateInquiryRequest,
  ): Promise<ApiSuccess<InquiryResponse>> {
    const { entity, warnings } = await this.service.create(
      user.entityId,
      user.userId,
      body,
    );
    return ok(InquiryMapper.toResponse(entity, warnings));
  }

  @Patch(':id/status')
  @Auth()
  @ApiOperation({ summary: 'Inquiry 상태 전이' })
  async updateStatus(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInquiryStatusRequest,
  ): Promise<ApiSuccess<InquiryResponse>> {
    const entity = await this.service.updateStatus(user.entityId, id, body.status);
    return ok(InquiryMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Inquiry soft delete' })
  async remove(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(user.entityId, id);
    return ok({ deleted: true as const });
  }
}
