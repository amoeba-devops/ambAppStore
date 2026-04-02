import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { RawOrderService } from '../service/raw-order.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('raw-orders')
export class RawOrderController {
  constructor(private readonly rawOrderService: RawOrderService) {}

  @Post('upload')
  @Auth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx')) {
          cb(null, true);
        } else {
          cb(new BusinessException('DRD-E3003', 'Only .xlsx files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
    }),
  )
  async uploadOrders(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('channel') channel: string,
  ) {
    if (!file) {
      throw new BusinessException('DRD-E3004', 'File is required', HttpStatus.BAD_REQUEST);
    }

    const validChannels = ['SHOPEE', 'TIKTOK'];
    const ch = (channel || '').toUpperCase();
    if (!validChannels.includes(ch)) {
      throw new BusinessException('DRD-E3005', `Invalid channel: ${channel}. Must be one of: ${validChannels.join(', ')}`, HttpStatus.BAD_REQUEST);
    }

    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }

    const result = await this.rawOrderService.uploadExcel(user.ent_id, ch, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('upload-history')
  @Auth()
  async getUploadHistory(@CurrentUser() user: DrdJwtPayload) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const history = await this.rawOrderService.getUploadHistory(user.ent_id);
    return {
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dashboard-summary')
  @Auth()
  async getDashboardSummary(@CurrentUser() user: DrdJwtPayload) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const data = await this.rawOrderService.getDashboardSummary(user.ent_id);
    return successResponse(data);
  }

  @Get('daily-summary')
  @Auth()
  async getDailySummary(
    @CurrentUser() user: DrdJwtPayload,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('channel') channel?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const data = await this.rawOrderService.getDailySummary(
      user.ent_id,
      startDate,
      endDate,
      channel,
    );
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('list')
  @Auth()
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const result = await this.rawOrderService.findAll(user.ent_id, {
      startDate,
      endDate,
      channel,
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      size: size ? parseInt(size, 10) : 20,
    });
    return successListResponse(result.data, result.pagination);
  }

  @Get(':ord_id')
  @Auth()
  async findOne(
    @CurrentUser() user: DrdJwtPayload,
    @Param('ord_id') ordId: string,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const result = await this.rawOrderService.findOne(user.ent_id, ordId);
    return successResponse(result);
  }
}
