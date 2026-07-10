/** 게시글 번역 응답 (camelCase). */
export class KbTranslationResponse {
  targetLang: string;
  translatedTitle: string | null;
  translatedContent: string | null;
  source: string; // AI/MANUAL
}
