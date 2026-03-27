import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AdminApp {
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

export function useAdminApps() {
  return useQuery<AdminApp[]>({
    queryKey: ['admin', 'apps'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/admin/apps');
      return res.data.data;
    },
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiClient.post('/v1/admin/apps', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'apps'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'apps'] });
    },
  });
}

export function useUpdateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, data }: { appId: string; data: Record<string, unknown> }) => {
      const res = await apiClient.patch(`/v1/admin/apps/${appId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'apps'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'apps'] });
    },
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const res = await apiClient.delete(`/v1/admin/apps/${appId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'apps'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'apps'] });
    },
  });
}
