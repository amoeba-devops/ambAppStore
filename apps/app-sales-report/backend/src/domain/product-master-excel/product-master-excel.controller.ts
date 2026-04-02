import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ProductMasterExcelService } from './product-master-excel.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { successResponse } from '../../common/dto/base-response.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('product-master')
export class ProductMasterExcelController {
  constructor(private readonly service: ProductMasterExcelService) {}

  @Get('template')
  @Auth()
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.service.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=product-master-template.xlsx',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export')
  @Auth()
  async exportData(
    @CurrentUser() user: DrdJwtPayload,
    @Res() res: Response,
  ) {
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }
    const buffer = await this.service.exportData(user.ent_id);
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=product-master-${date}.xlsx`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('import')
  @Auth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.originalname.endsWith('.xlsx')
        ) {
          cb(null, true);
        } else {
          cb(
            new BusinessException('DRD-E2013', 'Only .xlsx files are allowed', HttpStatus.BAD_REQUEST),
            false,
          );
        }
      },
    }),
  )
  async importData(
    @CurrentUser() user: DrdJwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BusinessException('DRD-E2014', 'File is required', HttpStatus.BAD_REQUEST);
    }
    if (!user.ent_id) {
      throw new BusinessException('DRD-E1009', 'Entity information required', HttpStatus.FORBIDDEN);
    }

    const result = await this.service.importData(user.ent_id, file.buffer, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: user.sub,
    });

    return successResponse(result);
  }
}
