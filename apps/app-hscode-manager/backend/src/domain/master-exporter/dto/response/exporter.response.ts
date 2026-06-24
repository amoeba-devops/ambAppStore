export class ExporterResponse {
  id: string;
  name: string;
  countryCode: string;
  aliases: string[];
  riskFlags: Record<string, unknown> | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}
