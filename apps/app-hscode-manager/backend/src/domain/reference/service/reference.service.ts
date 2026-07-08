import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportBatch } from '../entity/import-batch.entity';
import { ImportDispatcherService } from './import-dispatcher.service';
import { PaginatedData } from '../../../common/dto/pagination.dto';

@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepo: Repository<ImportBatch>,
    private readonly dispatcher: ImportDispatcherService,
  ) {}

  importFile(
    entId: string,
    fileName: string,
    buffer: Buffer,
    sourceCompany: string | null,
  ): Promise<ImportBatch> {
    return this.dispatcher.import(entId, fileName, buffer, sourceCompany);
  }

  async listBatches(entId: string, page: number, size: number): Promise<PaginatedData<ImportBatch>> {
    const [items, total] = await this.importBatchRepo.findAndCount({
      where: { entId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items, total, page, size };
  }
}
