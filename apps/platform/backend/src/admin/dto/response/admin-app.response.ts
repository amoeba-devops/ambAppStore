export class AdminAppResponse {
  appId: string;
  slug: string;
  name: string;
  nameEn: string | null;
  shortDesc: string | null;
  description: string | null;
  iconUrl: string | null;
  screenshots: string[];
  features: Array<{ icon: string; label: string }>;
  category: string | null;
  status: string;
  sortOrder: number;
  portFe: number | null;
  portBe: number | null;
  createdAt: string;
  updatedAt: string;
}
