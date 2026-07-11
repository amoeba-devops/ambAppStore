import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledgeBaseService } from '@/services/knowledge-base.service';
import type { CreateKbPostPayload, KbListParams } from '@/types/knowledge-base.types';

const KB = 'knowledge-base';

// ── 대시보드 ────────────────────────────────────────────────
export function useKbLanding() {
  return useQuery({ queryKey: [KB, 'landing'], queryFn: () => knowledgeBaseService.getLanding() });
}

export function useKbBlocks(type?: string) {
  return useQuery({
    queryKey: [KB, 'blocks', type ?? 'all'],
    queryFn: () => knowledgeBaseService.listBlocks(type),
  });
}

function invalidateDashboard(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [KB, 'landing'] });
  qc.invalidateQueries({ queryKey: [KB, 'blocks'] });
}

export function useCreateKbBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { dsb_block_type: string }) =>
      knowledgeBaseService.createBlock(payload as never),
    onSuccess: () => invalidateDashboard(qc),
  });
}

export function useUpdateKbBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      knowledgeBaseService.updateBlock(id, payload),
    onSuccess: () => invalidateDashboard(qc),
  });
}

export function useDeleteKbBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deleteBlock(id),
    onSuccess: () => invalidateDashboard(qc),
  });
}

export function useReorderKbBlocks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: { dsb_id: string; dsb_sort_order: number }[]) =>
      knowledgeBaseService.reorderBlocks(orders),
    onSuccess: () => invalidateDashboard(qc),
  });
}

// ── 카테고리 ────────────────────────────────────────────────
export function useKbCategories() {
  return useQuery({ queryKey: [KB, 'categories'], queryFn: () => knowledgeBaseService.listCategories() });
}

export function useCreateKbCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { cat_name: string; cat_sort_order?: number; cat_dot_color?: string }) =>
      knowledgeBaseService.createCategory(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'categories'] }),
  });
}

export function useUpdateKbCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      knowledgeBaseService.updateCategory(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'categories'] }),
  });
}

export function useDeleteKbCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'categories'] }),
  });
}

// ── 태그 ────────────────────────────────────────────────────
export function useKbTags(type?: string) {
  return useQuery({
    queryKey: [KB, 'tags', type ?? 'all'],
    queryFn: () => knowledgeBaseService.listTags(type),
  });
}

export function useCreateKbTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tag_name: string; tag_type: string }) =>
      knowledgeBaseService.createTag(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'tags'] }),
  });
}

export function useDeleteKbTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'tags'] }),
  });
}

// ── 게시글 ──────────────────────────────────────────────────
export function useKbPosts(params: KbListParams) {
  return useQuery({
    queryKey: [KB, 'posts', params],
    queryFn: () => knowledgeBaseService.listPosts(params),
  });
}

export function useKbPost(id: string | undefined) {
  return useQuery({
    queryKey: [KB, 'post', id],
    queryFn: () => knowledgeBaseService.getPost(id as string),
    enabled: !!id,
  });
}

export function useCreateKbPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateKbPostPayload) => knowledgeBaseService.createPost(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'posts'] }),
  });
}

export function useUpdateKbPost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateKbPostPayload>) => knowledgeBaseService.updatePost(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KB, 'posts'] });
      qc.invalidateQueries({ queryKey: [KB, 'post', id] });
    },
  });
}

export function useDeleteKbPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeBaseService.deletePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KB, 'posts'] }),
  });
}

// ── 첨부 ────────────────────────────────────────────────────
export function useKbAttachments(postId: string | undefined) {
  return useQuery({
    queryKey: [KB, 'attachments', postId],
    queryFn: () => knowledgeBaseService.listAttachments(postId as string),
    enabled: !!postId,
  });
}

export function useUploadAttachment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => knowledgeBaseService.uploadAttachment(postId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KB, 'attachments', postId] });
      qc.invalidateQueries({ queryKey: [KB, 'post', postId] });
    },
  });
}

export function useDeleteAttachment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attId: string) => knowledgeBaseService.deleteAttachment(postId, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KB, 'attachments', postId] });
      qc.invalidateQueries({ queryKey: [KB, 'post', postId] });
    },
  });
}

// ── 번역 ────────────────────────────────────────────────────
export function useKbTranslate(postId: string) {
  return useMutation({
    mutationFn: (targetLang: string) => knowledgeBaseService.translate(postId, targetLang),
  });
}

// ── RAG 승격 ────────────────────────────────────────────────
export function usePromoteToRag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => knowledgeBaseService.promoteToRag(postId),
    onSuccess: (_d, postId) => qc.invalidateQueries({ queryKey: [KB, 'post', postId] }),
  });
}
