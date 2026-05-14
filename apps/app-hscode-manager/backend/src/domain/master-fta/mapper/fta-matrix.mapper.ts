import { FtaMatrixEntity } from '../entity/fta-matrix.entity';
import { FtaMatrixResponse } from '../dto/response/fta-matrix.response';

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  // MySQL DATE column는 시간이 없어 toISOString().slice(0, 10) 안전
  if (typeof d === 'string') return d as unknown as string;
  return d.toISOString().slice(0, 10);
}

export class FtaMatrixMapper {
  static toResponse(entity: FtaMatrixEntity): FtaMatrixResponse {
    return {
      id: entity.id,
      importCountryCode: entity.importCountryCode,
      exportCountryCode: entity.exportCountryCode,
      agreementCode: entity.agreementCode,
      hsCode: entity.hsCode,
      rate: entity.rate,
      effectiveFrom: isoDate(entity.effectiveFrom) ?? '',
      effectiveTo: isoDate(entity.effectiveTo),
      memo: entity.memo,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: FtaMatrixEntity[]): FtaMatrixResponse[] {
    return entities.map((e) => FtaMatrixMapper.toResponse(e));
  }
}
