import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { SettingCategory, SettingView } from '@/types/admin.types';

export interface SettingItemInput {
  key: string;
  value?: string;
  is_secret?: boolean;
}

export interface TestConnectionInput {
  api_key?: string;
  model_version?: string;
}

export interface TestConnectionResult {
  claude: boolean;
  message: string;
  model?: string;
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
  test(input: TestConnectionInput = {}): Promise<TestConnectionResult> {
    return unwrap(
      apiClient.post<ApiResponse<TestConnectionResult>>('/admin/settings/test', input),
    );
  },
};
