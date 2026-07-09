/** HS 기준표 마스터 응답 (camelCase). */
export class HsCodeResponse {
  hscId: string;
  system: string;
  version: string;
  chapter: string;
  heading: string | null;
  subheading: string | null;
  nationalSubcode: string | null;
  description: string | null;
}

/** HS 기준표 import 결과 응답. */
export class HsTableImportResponse {
  system: string;
  version: string;
  rowsTotal: number;
  imported: number;
  skipped: number;
}
