import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AppCard {
  appId: string;
  slug: string;
  name: string;
  nameEn: string;
  shortDesc: string;
  iconUrl: string;
  status: string;
  sortOrder: number;
}

export interface AppDetail {
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

export function useApps() {
  return useQuery<AppCard[]>({
    queryKey: ['platform', 'apps'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/platform/apps');
      return res.data.data;
    },
  });
}

export function useAppDetail(slug: string) {
  return useQuery<AppDetail>({
    queryKey: ['platform', 'apps', slug],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/platform/apps/${slug}`);
      return res.data.data;
    },
    enabled: !!slug,
  });
}
