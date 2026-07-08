import { useMutation, useQuery } from '@tanstack/react-query';
import { qaService } from '@/services/qa.service';
import { resultService } from '@/services/result.service';

export function useQaSearch() {
  return useMutation({ mutationFn: qaService.search });
}

export function useQaConfirm() {
  return useMutation({ mutationFn: qaService.confirm });
}

export function useResultDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['result', id],
    queryFn: () => resultService.getDetail(id as string),
    enabled: !!id,
  });
}
