import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { SettingCategory, SettingView } from '@/types/admin.types';

export interface SettingItemInput {
  key: string;
  value?: string;
  is_secret?: boolean;
}

export const adminSettingsService = {
  get(category: SettingCategory): Promise<SettingView[]> {
    return unwrap(apiClient.get<ApiResponse<SettingView[]>>(`/admin/settings/${category}`));
  },
  put(category: SettingCategory, items: SettingItemInput[]): Promise<SettingView[]> {
    return unwrap(
      apiClient.put<ApiResponse<SettingView[]>>(`/admin/settings/${category}`, { items }),
    );
  },
  test(): Promise<{ claude: boolean; message: string }> {
    return unwrap(
      apiClient.post<ApiResponse<{ claude: boolean; message: string }>>('/admin/settings/test', {}),
    );
  },
};
