import { ImportBatch } from '../entity/import-batch.entity';
import { ImportBatchResponse } from '../dto/response/import-batch.response';

export class ImportBatchMapper {
  static toResponse(e: ImportBatch): ImportBatchResponse {
    return {
      id: e.imbId,
      fileName: e.fileName,
      formatType: e.formatType,
      rowsTotal: e.rowsTotal,
      rowsImported: e.rowsImported,
      rowsFailed: e.rowsFailed,
      createdAt: e.createdAt?.toISOString(),
    };
  }

  static toListResponse(list: ImportBatch[]): ImportBatchResponse[] {
    return list.map((e) => this.toResponse(e));
  }
}
