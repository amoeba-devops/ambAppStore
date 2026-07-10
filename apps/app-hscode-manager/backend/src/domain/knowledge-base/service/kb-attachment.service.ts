import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { KbAttachment } from '../entity/kb-attachment.entity';
import { KbPost } from '../entity/kb-post.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB (NFR-KB-004)
const ALLOWED_EXT = ['.pdf', '.xlsx', '.xls', '.docx', '.csv'];

/**
 * 첨부 서비스 — 로컬 볼륨 저장(경로만 DB), 50MB + 확장자 화이트리스트. FR-KB-011/012
 * 저장 위치: ATTACHMENT_DIR env(기본 ./uploads/kb). Docker 볼륨 마운트 필요.
 */
@Injectable()
export class KbAttachmentService {
  private readonly baseDir: string;

  constructor(
    @InjectRepository(KbAttachment) private readonly repo: Repository<KbAttachment>,
    @InjectRepository(KbPost) private readonly postRepo: Repository<KbPost>,
    config: ConfigService,
  ) {
    this.baseDir = config.get<string>('ATTACHMENT_DIR', './uploads/kb');
  }

  async list(postId: string): Promise<KbAttachment[]> {
    return this.repo.find({ where: { postId }, order: { createdAt: 'ASC' } });
  }

  async upload(
    postId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype?: string } | undefined,
  ): Promise<KbAttachment> {
    if (!file) {
      throw new BusinessException(ERROR_CODES.VALIDATION, 'file is required', HttpStatus.BAD_REQUEST);
    }
    await this.assertPostExists(postId);

    if (file.size > MAX_SIZE) {
      throw new BusinessException(
        ERROR_CODES.KB_ATTACHMENT_TOO_LARGE,
        `attachment exceeds 50MB: ${file.size} bytes`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      throw new BusinessException(
        ERROR_CODES.KB_ATTACHMENT_FORMAT,
        `unsupported format: ${ext}. allowed: ${ALLOWED_EXT.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const dir = join(this.baseDir, postId);
    await mkdir(dir, { recursive: true });
    const storedName = `${randomUUID()}${ext}`;
    const filePath = join(dir, storedName);
    await writeFile(filePath, file.buffer);

    return this.repo.save(
      this.repo.create({
        postId,
        filePath,
        fileName: file.originalname,
        fileSize: String(file.size),
        mimeType: file.mimetype ?? null,
        fileExt: ext.replace('.', ''),
      }),
    );
  }

  /** 다운로드용 — 파일 스트림 + 메타. */
  async getForDownload(
    attId: string,
  ): Promise<{ stream: ReturnType<typeof createReadStream>; att: KbAttachment }> {
    const att = await this.repo.findOne({ where: { attId } });
    if (!att || !existsSync(att.filePath)) {
      throw new BusinessException(
        ERROR_CODES.KB_ATTACHMENT_NOT_FOUND,
        `attachment not found: ${attId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return { stream: createReadStream(att.filePath), att };
  }

  async remove(attId: string): Promise<void> {
    const att = await this.repo.findOne({ where: { attId } });
    if (!att) {
      throw new BusinessException(
        ERROR_CODES.KB_ATTACHMENT_NOT_FOUND,
        `attachment not found: ${attId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    await this.repo.remove(att);
  }

  private async assertPostExists(postId: string): Promise<void> {
    const post = await this.postRepo.findOne({ where: { pstId: postId } });
    if (!post) {
      throw new BusinessException(
        ERROR_CODES.KB_POST_NOT_FOUND,
        `post not found: ${postId}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
