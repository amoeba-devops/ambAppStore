import { create } from 'zustand';

/**
 * AMA에서 iframe 호출 시 쿼리 파라미터로 전달하는 Entity 정보.
 * 페이지 이동 시에도 유지되어야 하므로 Zustand 스토어에 저장.
 */
export interface EntityContext {
  entId: string;
  entCode: string;
  entName: string;
  email: string;
}

interface EntityContextState {
  entity: EntityContext | null;
  setEntity: (entity: EntityContext) => void;
  clearEntity: () => void;
}

export const useEntityContextStore = create<EntityContextState>((set) => ({
  entity: null,
  setEntity: (entity) => set({ entity }),
  clearEntity: () => set({ entity: null }),
}));
