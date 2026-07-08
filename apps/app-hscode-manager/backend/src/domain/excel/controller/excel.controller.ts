import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { ExcelService, JobStatus } from '../service/excel.service';
import { ExcelValidationResult } from '../excel.types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** SCR-003 엑셀 일괄 분류 (FR-031~036). */
@ApiTags('excel')
@ApiBearerAuth()
@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  private requireFile(file?: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BusinessException(ERROR_CODES.VALIDATION, 'file is required', HttpStatus.BAD_REQUEST);
    }
    return file;
  }

  @Auth()
  @Post('validate')
  @ApiOperation({ summary: '엑셀 양식 검증 (FR-032)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BaseResponse<ExcelValidationResult>> {
    return successResponse(await this.excelService.validate(this.requireFile(file).buffer));
  }

  @Auth()
  @Post('classify')
  @ApiOperation({ summary: '엑셀 일괄 분류 큐 적재 (FR-031~033)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async classify(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<{ jobId: string; total: number; errors: ExcelValidationResult['errors'] }>> {
    return successResponse(await this.excelService.classify(entId, this.requireFile(file).buffer));
  }

  @Auth()
  @Get('jobs/:id')
  @ApiOperation({ summary: '배치 진행률/결과 조회' })
  async job(@Param('id') id: string): Promise<BaseResponse<JobStatus>> {
    return successResponse(await this.excelService.getJob(id));
  }

  @Auth()
  @Get('jobs/:id/export')
  @ApiOperation({ summary: '결과 엑셀 다운로드 (FR-034)' })
  async export(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const buffer = await this.excelService.export(id);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="hscode-result-${id}.xlsx"`);
    res.send(buffer);
  }

  @Auth()
  @Get('template')
  @ApiOperation({ summary: '빈 템플릿 다운로드 (FR-035)' })
  async template(@Res() res: Response): Promise<void> {
    const buffer = await this.excelService.buildTemplate();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="hscode-template.xlsx"');
    res.send(buffer);
  }
}
