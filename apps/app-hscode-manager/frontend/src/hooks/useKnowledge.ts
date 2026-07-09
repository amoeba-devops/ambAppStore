import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledgeService } from '@/services/knowledge.service';
import { referenceService } from '@/services/reference.service';

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: () => knowledgeService.listDocuments(),
  });
}

export function useImportHsCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; system: string; version?: string }) =>
      knowledgeService.importHsCodes(vars.file, vars.system, vars.version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-documents'] }),
  });
}

export function useCreateKnowledgeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: knowledgeService.createDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-documents'] }),
  });
}

/** 면장 업로드 — 기존 reference/imports 재사용(R1). */
export function useUploadDeclaration() {
  return useMutation({
    mutationFn: (vars: { file: File; sourceCompany?: string }) =>
      referenceService.uploadImport(vars.file, vars.sourceCompany),
  });
}
