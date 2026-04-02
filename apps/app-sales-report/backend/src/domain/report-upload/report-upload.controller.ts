import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ReportUploadService } from './report-upload.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function fileFilter(_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) {
  const allowedXlsx = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const allowedCsv = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
  const ext = file.originalname.toLowerCase();

  if (ext.endsWith('.xlsx') || allowedXlsx.includes(file.mimetype)) {
    cb(null, true);
  } else if (ext.endsWith('.csv') || allowedCsv.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BusinessException('DRD-E4001', 'Only .xlsx and .csv files are allowed', HttpStatus.BAD_REQUEST), false);
  }
}

@Controller('reports')
export class ReportUploadController {
  constructor(private readonly reportUploadService: ReportUploadService) {}

  @Post('traffic/shopee')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadShopeeTraffic(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('period_start') periodStart?: string,
    @Body('period_end') periodEnd?: string,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadShopeeTraffic(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
      periodStart,
      periodEnd,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('traffic/tiktok')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadTikTokTraffic(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadTikTokTraffic(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('ads/shopee')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadShopeeAd(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadShopeeAd(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('ads/tiktok-product')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadTikTokAd(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('period_start') periodStart?: string,
    @Body('period_end') periodEnd?: string,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadTikTokAd(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
      periodStart,
      periodEnd,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('ads/tiktok-live')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadTikTokAdLive(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('period_start') periodStart?: string,
    @Body('period_end') periodEnd?: string,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadTikTokAdLive(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
      periodStart,
      periodEnd,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('affiliate/shopee')
  @Auth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter }))
  async uploadShopeeAffiliate(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('period_start') periodStart?: string,
    @Body('period_end') periodEnd?: string,
  ) {
    this.validateRequest(user, file);
    const result = await this.reportUploadService.uploadShopeeAffiliate(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
      periodStart,
      periodEnd,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  private validateRequest(user: DrdJwtPayload, file: Express.Multer.File): asserts user is DrdJwtPayload & { ent_id: string } {
    if (!file) {
      throw new BusinessException('DRD-E4002', 'File is required', HttpStatus.BAD_REQUEST);
    }
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
  }
}
