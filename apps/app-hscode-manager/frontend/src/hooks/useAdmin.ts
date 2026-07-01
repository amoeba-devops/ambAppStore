import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '@/services/reference.service';
import { adminSettingsService, SettingItemInput } from '@/services/admin-settings.service';
import type { SettingCategory } from '@/types/admin.types';

export function useImports() {
  return useQuery({ queryKey: ['imports'], queryFn: referenceService.listImports });
}

export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, company }: { file: File; company?: string }) =>
      referenceService.uploadImport(file, company),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }),
  });
}

export function useReviewQueue() {
  return useQuery({ queryKey: ['review-queue'], queryFn: referenceService.listReview });
}

export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hsCode, hs6 }: { id: string; hsCode: string; hs6: string }) =>
      referenceService.approveReview(id, hsCode, hs6),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  });
}

export function useSettings(category: SettingCategory) {
  return useQuery({
    queryKey: ['settings', category],
    queryFn: () => adminSettingsService.get(category),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ category, items }: { category: SettingCategory; items: SettingItemInput[] }) =>
      adminSettingsService.put(category, items),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['settings', v.category] }),
  });
}
