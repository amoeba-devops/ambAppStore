import { HsCode } from '../entity/hs-code.entity';
import { HsCodeResponse } from '../dto/response/hs-code.response';

/** HsCode Entity → Response 변환. */
export class HsCodeMapper {
  static toResponse(c: HsCode): HsCodeResponse {
    return {
      hscId: c.hscId,
      system: c.system,
      version: c.version,
      chapter: c.chapter,
      heading: c.heading,
      subheading: c.subheading,
      nationalSubcode: c.nationalSubcode,
      description: c.description,
    };
  }

  static toListResponse(codes: HsCode[]): HsCodeResponse[] {
    return codes.map((c) => this.toResponse(c));
  }
}
