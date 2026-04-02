import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadHistoryEntity } from './entity/upload-history.entity';

@Injectable()
export class UploadHistoryService {
  constructor(
    @InjectRepository(UploadHistoryEntity)
    private readonly repo: Repository<UploadHistoryEntity>,
  ) {}

  async create(data: {
    entId: string;
    type: string;
    channel: string;
    fileName: string;
    fileSize: number;
    createdBy?: string;
  }): Promise<UploadHistoryEntity> {
    const entity = this.repo.create({
      entId: data.entId,
      uphType: data.type,
      uphChannel: data.channel,
      uphFileName: data.fileName,
      uphFileSize: data.fileSize,
      uphStatus: 'PROCESSING',
      uphCreatedBy: data.createdBy ?? null,
    });
    return this.repo.save(entity);
  }

  async complete(
    uphId: string,
    result: {
      rowCount?: number;
      successCount?: number;
      skipCount?: number;
      errorCount?: number;
      batchId?: string;
      errorDetail?: string;
    },
  ): Promise<void> {
    const status =
      (result.errorCount ?? 0) > 0
        ? (result.successCount ?? 0) > 0
          ? 'PARTIAL'
          : 'FAILED'
        : 'COMPLETED';

    await this.repo.update(uphId, {
      uphStatus: status,
      uphRowCount: result.rowCount ?? null,
      uphSuccessCount: result.successCount ?? null,
      uphSkipCount: result.skipCount ?? null,
      uphErrorCount: result.errorCount ?? null,
      uphBatchId: result.batchId ?? null,
      uphErrorDetail: result.errorDetail ?? null,
    });
  }

  async fail(uphId: string, errorMessage: string): Promise<void> {
    await this.repo.update(uphId, {
      uphStatus: 'FAILED',
      uphErrorDetail: errorMessage,
    });
  }

  async findAll(entId: string, page = 1, size = 20) {
    const [data, totalCount] = await this.repo.findAndCount({
      where: { entId },
      order: { uphCreatedAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });

    return {
      data,
      pagination: {
        page,
        size,
        totalCount,
        totalPages: Math.ceil(totalCount / size),
      },
    };
  }

  async findOne(entId: string, uphId: string): Promise<UploadHistoryEntity | null> {
    return this.repo.findOne({
      where: { uphId, entId },
    });
  }
}
