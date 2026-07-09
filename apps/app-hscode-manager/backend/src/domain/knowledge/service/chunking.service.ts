import { Injectable } from '@nestjs/common';

export interface ChunkInput {
  chunkType: string; // RULE/CASE/TABLE/NOTE/TECHNICAL
  embeddingText: string;
  citationText: string;
  ruleType?: string | null;
  isAppliesToMix?: boolean;
  isAppliesToRatio?: boolean;
}

/**
 * 지식 문서 본문 → 청크 분할 (Phase 1 골격, 문서유형 인지형).
 * 스켈레톤 전략: 문단(빈 줄) 경계로 나누고 목표 길이(~800자)로 병합, 문서 유형별 chk_type 매핑.
 * 후속: 법령=조문, 사례=1사례1청크, HS해설=chapter-heading-subheading 등 정교화(rag_data_metadata_design_guide).
 */
@Injectable()
export class ChunkingService {
  private readonly TARGET = 800;
  private readonly MAX = 1600;

  /** doc_type → 기본 chk_type 매핑. */
  private chunkTypeFor(docType: string): string {
    switch (docType) {
      case 'LAW':
      case 'GUIDE':
        return 'RULE';
      case 'CASE_STUDY':
      case 'ADVANCE_RULING':
      case 'LEARNED':
        return 'CASE';
      case 'HS_TABLE':
        return 'TABLE';
      case 'TECHNICAL':
      case 'SPEC_SHEET':
        return 'TECHNICAL';
      default:
        return 'NOTE';
    }
  }

  /** 규칙성 힌트(혼합/비율 적용 여부)를 텍스트에서 추정 — 검색 필터용 메타. */
  private ruleHints(text: string): { mix: boolean; ratio: boolean } {
    const t = text.toLowerCase();
    const mix = /(mixture|mixed|혼합|composite|적층|coating|코팅|blend)/.test(t);
    const ratio = /(\d+\s*%|비율|함량|percentage|ratio|주성분|predominant)/.test(t);
    return { mix, ratio };
  }

  /**
   * 본문 → 청크 목록. 빈 문단 제거, 목표 길이 병합, 과대 문단은 문장 경계로 분할.
   */
  chunk(docType: string, body: string): ChunkInput[] {
    const chunkType = this.chunkTypeFor(docType);
    const paragraphs = body
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const merged: string[] = [];
    let buf = '';
    for (const p of paragraphs) {
      if (p.length >= this.MAX) {
        if (buf) {
          merged.push(buf);
          buf = '';
        }
        merged.push(...this.splitLong(p));
        continue;
      }
      if ((buf + '\n\n' + p).length > this.TARGET && buf) {
        merged.push(buf);
        buf = p;
      } else {
        buf = buf ? `${buf}\n\n${p}` : p;
      }
    }
    if (buf) merged.push(buf);

    return merged.map((text) => {
      const { mix, ratio } = this.ruleHints(text);
      return {
        chunkType,
        embeddingText: text,
        citationText: text,
        ruleType: chunkType === 'RULE' ? 'GENERAL' : null,
        isAppliesToMix: mix,
        isAppliesToRatio: ratio,
      };
    });
  }

  /** 과대 문단을 문장 경계(., 。, 개행)로 목표 길이만큼 분할. */
  private splitLong(p: string): string[] {
    const sentences = p.split(/(?<=[.。!?\n])\s+/);
    const out: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if ((buf + ' ' + s).length > this.TARGET && buf) {
        out.push(buf.trim());
        buf = s;
      } else {
        buf = buf ? `${buf} ${s}` : s;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }
}
