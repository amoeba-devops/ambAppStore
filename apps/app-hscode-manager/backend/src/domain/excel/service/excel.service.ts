import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EXCEL_QUEUE } from '../excel.constants';
import {
  ClassifyJobResult,
  ExcelValidationResult,
} from '../excel.types';
import { ExcelValidatorService } from './excel-validator.service';
import { ExcelTemplateService } from './excel-template.service';
import { ExcelExportService } from './excel-export.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

export interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  total: number | null;
  results: ClassifyJobResult['results'] | null;
}

@Injectable()
export class ExcelService {
  constructor(
    @InjectQueue(EXCEL_QUEUE) private readonly queue: Queue,
    private readonly validator: ExcelValidatorService,
    private readonly template: ExcelTemplateService,
    private readonly exporter: ExcelExportService,
  ) {}

  validate(buffer: Buffer): Promise<ExcelValidationResult> {
    return this.validator.validate(buffer);
  }

  /** 검증 후 유효행을 큐에 적재 (FR-031~033). */
  async classify(
    entId: string,
    buffer: Buffer,
  ): Promise<{ jobId: string; total: number; errors: ExcelValidationResult['errors'] }> {
    const { validRows, errors } = await this.validator.validate(buffer);
    const job = await this.queue.add('classify', { entId, rows: validRows });
    return { jobId: String(job.id), total: validRows.length, errors };
  }

  async getJob(jobId: string): Promise<JobStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new BusinessException(ERROR_CODES.NO_CANDIDATE, 'Job not found', HttpStatus.NOT_FOUND);
    }
    const state = await job.getState();
    const ret = job.returnvalue as ClassifyJobResult | undefined;
    return {
      jobId,
      status: state,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      total: ret?.total ?? null,
      results: ret?.results ?? null,
    };
  }

  async export(jobId: string): Promise<Buffer> {
    const job = await this.queue.getJob(jobId);
    const ret = job?.returnvalue as ClassifyJobResult | undefined;
    if (!ret) {
      throw new BusinessException(
        ERROR_CODES.NO_CANDIDATE,
        'Job result not available',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.exporter.buildResults(ret.results);
  }

  buildTemplate(): Promise<Buffer> {
    return this.template.buildTemplate();
  }
}
