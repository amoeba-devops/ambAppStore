import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * AMA 진입 시 전달되는 Entity 정보.
 *
 * 두 경로로 채워진다: 구 iframe 쿼리 파라미터, 또는 `?ama_token=`의 JWT 클레임
 * (App.tsx의 EntityContextInitializer 참조).
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

/**
 * ## 왜 persist가 필요한가
 *
 * AMA는 entity 정보를 진입 URL에만 실어 보낸다. 라우터가 하이드레이션 중
 * 쿼리 파라미터를 제거하므로, 이 스토어가 메모리에만 있으면 **새로고침(F5)
 * 한 번에 컨텍스트가 통째로 사라진다**. 그러면 useEntitySubscriptions가
 * `enabled:false`로 죽고 → 구독 조회를 아예 하지 않고 → 이미 승인(ACTIVE)된
 * 사용자에게 "신청하기" 버튼이 뜬다 (FIX-260813과 동일한 증상의 재발 경로).
 *
 * ## 왜 sessionStorage인가 (localStorage 아님)
 *
 * 공용 PC에서 탭을 닫은 뒤에도 이전 사용자의 org 컨텍스트가 남는 것을 막는다.
 * 탭 세션 동안만 유효하면 F5 재발 경로를 막기에 충분하다.
 *
 * ## 저장 대상
 *
 * `entity` 식별자만 저장한다. **원본 JWT는 저장하지 않는다** — 토큰은 매
 * 진입마다 URL로 새로 오며, 만료 판정도 그때 이뤄져야 한다.
 */
export const useEntityContextStore = create<EntityContextState>()(
  persist(
    (set) => ({
      entity: null,
      setEntity: (entity) => set({ entity }),
      clearEntity: () => set({ entity: null }),
    }),
    {
      name: 'plt-entity-ctx',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ entity: state.entity }),
    },
  ),
);
