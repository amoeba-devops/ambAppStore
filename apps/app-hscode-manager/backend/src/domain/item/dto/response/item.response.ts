import { ItemCategory } from '../../entity/item.entity';

export class ItemResponse {
  id: string;
  inquiryId: string | null;
  nameRaw: string;
  nameNormalized: string | null;
  category: ItemCategory;
  usageDescription: string | null;
  compositionHash: string | null;
  specAttributes: Record<string, unknown> | null;
  gtin: string | null;
  normalizerVersion: string | null;
  completenessScore: number | null;
  createdAt: string;
  updatedAt: string;
}
