import { useMutation, useQuery } from '@tanstack/react-query';
import { attributeService } from '@/services/attribute.service';
import { excelService } from '@/services/excel.service';
import { referenceService } from '@/services/reference.service';

export function useAttributeClassify() {
  return useMutation({ mutationFn: attributeService.classify });
}

/** 확정 결과를 reference 코퍼스에 저장 (FR-005 자기개선 루프) */
export function useSaveReference() {
  return useMutation({ mutationFn: referenceService.saveEntry });
}

export function useExcelClassify() {
  return useMutation({ mutationFn: (file: File) => excelService.classify(file) });
}

/** 진행 중인 잡을 폴링 (완료/실패 시 폴링 중단) */
export function useExcelJob(jobId: string | null) {
  return useQuery({
    queryKey: ['excel-job', jobId],
    queryFn: () => excelService.job(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'completed' || s === 'failed' ? false : 1200;
    },
  });
}
