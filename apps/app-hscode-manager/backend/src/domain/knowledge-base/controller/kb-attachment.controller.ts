import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { KbAttachmentService } from '../service/kb-attachment.service';
import { KbPostMapper } from '../mapper/kb-post.mapper';
import { KbAttachmentRef } from '../dto/response/kb-post.response';

/**
 * 지식창고 첨부 — 업로드/삭제 @SuperAdminOnly, 다운로드 @Auth. FR-KB-011/012
 */
@ApiTags('knowledge-base/attachments')
@ApiBearerAuth()
@Controller('knowledge-base/posts/:postId/attachments')
export class KbAttachmentController {
  constructor(private readonly service: KbAttachmentService) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '게시글 첨부 목록' })
  async list(@Param('postId') postId: string): Promise<BaseResponse<KbAttachmentRef[]>> {
    const atts = await this.service.list(postId);
    return successResponse(atts.map((a) => KbPostMapper.toAttachmentRef(a)));
  }

  @SuperAdminOnly()
  @Post()
  @ApiOperation({ summary: '첨부 업로드(PDF/Excel 등, ≤50MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('postId') postId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BaseResponse<KbAttachmentRef>> {
    const att = await this.service.upload(postId, file);
    return successResponse(KbPostMapper.toAttachmentRef(att));
  }

  @Auth()
  @Get(':attId')
  @ApiOperation({ summary: '첨부 다운로드(스트리밍)' })
  async download(
    @Param('attId') attId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, att } = await this.service.getForDownload(attId);
    res.set({
      'Content-Type': att.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @SuperAdminOnly()
  @Delete(':attId')
  @ApiOperation({ summary: '첨부 삭제' })
  async remove(@Param('attId') attId: string): Promise<BaseResponse<{ deleted: boolean }>> {
    await this.service.remove(attId);
    return successResponse({ deleted: true });
  }
}
