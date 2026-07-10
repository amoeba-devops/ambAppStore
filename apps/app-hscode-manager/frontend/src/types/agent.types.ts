/** 통관 AI 에이전트 타입 (Phase 2~4) — 문서 업로드 매칭 · Q&A 챗봇 · 레퍼런스 구축. */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// ── 문서 업로드 매칭 ──────────────────────────────────────────
export interface Recommendation {
  recId: string;
  rank: number;
  hsVn: string;
  confidence: number;
  reasoning: string;
  supportingChunks: string[];
  isEscalationRequired: boolean;
  finalUserAction: string | null;
}

export interface MatchItem {
  itemId: string;
  rowIndex: number | null;
  name: string | null;
  material: string | null;
  usage: string | null;
  status: string;
  needsReview: boolean;
  recommendations: Recommendation[];
}

export interface MatchRequest {
  mrqId: string;
  fileName: string | null;
  sourceType: string;
  status: string;
  itemCount: number;
  matchedCount: number;
  reviewCount: number;
  confirmedCount: number;
  processedCount: number;
  parseNote: string | null;
  createdAt: string;
}

export interface RequestDetail {
  request: MatchRequest;
  items: MatchItem[];
}

export interface ApprovalItem {
  item_id: string;
  hs_code: string;
}

// ── Q&A 챗봇 ─────────────────────────────────────────────────
export interface ChatCandidate {
  hsCode: string;
  confidence: number;
  rationale: string;
}

export interface ChatCitation {
  type: 'REFERENCE' | 'KNOWLEDGE';
  ref: string;
  text: string;
}

export interface ChatMessage {
  msgId: string;
  role: string; // USER/ASSISTANT
  content: string;
  candidates: ChatCandidate[];
  citations: ChatCitation[];
  needQuestion: boolean;
  source: string | null;
  createdAt: string;
}

export interface ChatSession {
  chtId: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResult {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface ChatHistory {
  session: ChatSession;
  messages: ChatMessage[];
}

// ── 레퍼런스(RAG) 구축 ───────────────────────────────────────
export interface KnowledgeDocument {
  docId: string;
  scope: 'GLOBAL' | 'ENTITY';
  docType: string;
  title: string;
  sourceCountry: string | null;
  reliabilityGrade: string;
  chunkCount: number;
  embeddedCount: number;
  createdAt: string;
}

export interface HsTableImportResult {
  system: string;
  version: string;
  rowsTotal: number;
  imported: number;
  skipped: number;
}

export interface IngestResult {
  docId: string;
  chunks: number;
  embedded: number;
}
