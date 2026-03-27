export class AppDetailResponse {
  appId: string;
  slug: string;
  name: string;
  nameEn: string;
  shortDesc: string;
  description: string;
  iconUrl: string;
  screenshots: string[];
  features: Array<{ icon: string; label: string }>;
  category: string;
  status: string;
}
