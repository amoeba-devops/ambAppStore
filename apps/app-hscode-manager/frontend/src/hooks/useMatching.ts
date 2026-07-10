import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchingService } from '@/services/matching.service';
import type { ApprovalItem } from '@/types/agent.types';

export function useMatchUpload() {
  return useMutation({ mutationFn: (file: File) => matchingService.upload(file) });
}

export function useMatchRequests(page = 1, size = 20) {
  return useQuery({
    queryKey: ['match-requests', page, size],
    queryFn: () => matchingService.listRequests(page, size),
  });
}

export function useMatchRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['match-request', id],
    queryFn: () => matchingService.getRequest(id as string),
    enabled: !!id,
    // 비동기 처리 중(PROCESSING)에는 폴링, READY 되면 중지.
    refetchInterval: (query) =>
      query.state.data?.request?.status === 'PROCESSING' ? 1500 : false,
  });
}

export function useMatchConfirm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (approvals: ApprovalItem[]) => matchingService.confirm(id, approvals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['match-request', id] });
      qc.invalidateQueries({ queryKey: ['match-requests'] });
    },
  });
}
