import {
  ForbiddenException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { EscalationService } from '../../expert-review/service/escalation.service';
import { HscodeErrorCode } from '../../../common/error-codes';

export type ResponseChannel = 'email' | 'kakao' | 'messenger' | 'plain';
export type ResponseLanguage = 'ko' | 'en' | 'vi';

export interface ResponseFormResult {
  classificationId: string;
  channel: ResponseChannel;
  language: ResponseLanguage;
  subject: string;
  body: string;
  variables: Record<string, string>;
}

const TEMPLATES: Record<
  ResponseChannel,
  Record<ResponseLanguage, { subject: string; body: string }>
> = {
  email: {
    ko: {
      subject:
        '[HS Code 분류 결과] {{exporterName}} — {{productName}} ({{hsCode}})',
      body: `안녕하세요, {{exporterName}} 담당자님.

요청하신 원부자재의 HS 코드 분류 결과를 안내드립니다.

▣ 품명: {{productName}}
▣ 카테고리: {{category}}
▣ 수출국 → 수입국: {{exportCountry}} → {{importCountry}}
▣ 분류 코드: {{hsCode}}
▣ 기본세율: {{basicTariff}}
▣ 협정세율: {{ftaTariff}}{{ftaAgreementBlock}}
▣ 분류 신뢰도: {{confidence}}

{{rationaleBlock}}{{citationsBlock}}

문의사항이 있으시면 회신 부탁드립니다.

감사합니다.
`,
    },
    en: {
      subject:
        '[HS Code Classification] {{exporterName}} — {{productName}} ({{hsCode}})',
      body: `Dear {{exporterName}} team,

Please find the HS code classification result for the requested raw material.

* Item: {{productName}}
* Category: {{category}}
* Export → Import: {{exportCountry}} → {{importCountry}}
* HS Code: {{hsCode}}
* Basic tariff: {{basicTariff}}
* FTA tariff: {{ftaTariff}}{{ftaAgreementBlock}}
* Confidence: {{confidence}}

{{rationaleBlock}}{{citationsBlock}}

Please reply if you have any questions.

Best regards,
`,
    },
    vi: {
      subject:
        '[Kết quả phân loại mã HS] {{exporterName}} — {{productName}} ({{hsCode}})',
      body: `Kính gửi quý {{exporterName}},

Chúng tôi xin gửi kết quả phân loại mã HS cho nguyên vật liệu đã yêu cầu.

▣ Tên hàng: {{productName}}
▣ Phân loại: {{category}}
▣ Xuất → Nhập: {{exportCountry}} → {{importCountry}}
▣ Mã HS: {{hsCode}}
▣ Thuế cơ bản: {{basicTariff}}
▣ Thuế FTA: {{ftaTariff}}{{ftaAgreementBlock}}
▣ Độ tin cậy: {{confidence}}

{{rationaleBlock}}{{citationsBlock}}

Xin liên hệ nếu có thắc mắc.

Trân trọng,
`,
    },
  },
  kakao: {
    ko: {
      subject: 'HS 코드 분류 결과',
      body: `[HS 코드 분류] {{productName}}
코드: {{hsCode}}
기본세율 {{basicTariff}} / FTA {{ftaTariff}}{{ftaAgreementShort}}
수출 {{exportCountry}} → 수입 {{importCountry}}`,
    },
    en: {
      subject: 'HS Code result',
      body: `[HS Code] {{productName}}
Code: {{hsCode}}
Basic {{basicTariff}} / FTA {{ftaTariff}}{{ftaAgreementShort}}
{{exportCountry}} → {{importCountry}}`,
    },
    vi: {
      subject: 'Kết quả mã HS',
      body: `[Mã HS] {{productName}}
Mã: {{hsCode}}
Cơ bản {{basicTariff}} / FTA {{ftaTariff}}{{ftaAgreementShort}}
{{exportCountry}} → {{importCountry}}`,
    },
  },
  messenger: {
    ko: {
      subject: 'HS 코드 분류 결과',
      body: `🏷 {{productName}}
📦 {{exportCountry}} → {{importCountry}}
🔢 {{hsCode}} (신뢰도 {{confidence}})
💵 기본 {{basicTariff}} · FTA {{ftaTariff}}{{ftaAgreementShort}}`,
    },
    en: {
      subject: 'HS Code result',
      body: `🏷 {{productName}}
📦 {{exportCountry}} → {{importCountry}}
🔢 {{hsCode}} (conf {{confidence}})
💵 Basic {{basicTariff}} · FTA {{ftaTariff}}{{ftaAgreementShort}}`,
    },
    vi: {
      subject: 'Kết quả mã HS',
      body: `🏷 {{productName}}
📦 {{exportCountry}} → {{importCountry}}
🔢 {{hsCode}} (tin cậy {{confidence}})
💵 Cơ bản {{basicTariff}} · FTA {{ftaTariff}}{{ftaAgreementShort}}`,
    },
  },
  plain: {
    ko: {
      subject: 'HS Code 분류 결과 — {{hsCode}}',
      body: `{{productName}} ({{category}})
{{exportCountry}} → {{importCountry}}
HS: {{hsCode}}
기본세율: {{basicTariff}}
협정세율: {{ftaTariff}}{{ftaAgreementShort}}
신뢰도: {{confidence}}
{{rationaleBlock}}{{citationsBlock}}`,
    },
    en: {
      subject: 'HS Code result — {{hsCode}}',
      body: `{{productName}} ({{category}})
{{exportCountry}} → {{importCountry}}
HS: {{hsCode}}
Basic: {{basicTariff}}
FTA: {{ftaTariff}}{{ftaAgreementShort}}
Confidence: {{confidence}}
{{rationaleBlock}}{{citationsBlock}}`,
    },
    vi: {
      subject: 'Kết quả mã HS — {{hsCode}}',
      body: `{{productName}} ({{category}})
{{exportCountry}} → {{importCountry}}
HS: {{hsCode}}
Cơ bản: {{basicTariff}}
FTA: {{ftaTariff}}{{ftaAgreementShort}}
Độ tin cậy: {{confidence}}
{{rationaleBlock}}{{citationsBlock}}`,
    },
  },
};

@Injectable()
export class ResponseFormService {
  constructor(
    private readonly classificationService: ClassificationService,
    @Inject(forwardRef(() => EscalationService))
    private readonly escalation: EscalationService,
  ) {}

  async render(
    entId: string,
    classificationId: string,
    channel: ResponseChannel,
    language: ResponseLanguage,
  ): Promise<ResponseFormResult> {
    // Phase 6 차단 가드 (FR-ES-03)
    const blocked = await this.escalation.isBlocked(entId, classificationId);
    if (blocked) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message:
            'Response form is blocked while ExpertReview is pending (FR-ES-03)',
        },
        timestamp: new Date().toISOString(),
      });
    }
    const detail = await this.classificationService.getDetail(
      entId,
      classificationId,
    );
    const { classification: c, inquiry, item, exporter } = detail;

    const vars: Record<string, string> = {
      productName: item?.nameRaw ?? '—',
      category: item?.category ?? '—',
      exporterName: exporter?.name ?? '—',
      exportCountry: inquiry?.exportCountryCode ?? '—',
      importCountry: inquiry?.importCountryCode ?? '—',
      hsCode: c.hsCode,
      basicTariff:
        c.basicTariffRate !== null ? `${c.basicTariffRate}%` : 'n/a',
      ftaTariff: c.ftaTariffRate !== null ? `${c.ftaTariffRate}%` : 'n/a',
      ftaAgreementBlock: c.ftaAgreementCode
        ? `\n▣ FTA 협정: ${c.ftaAgreementCode}`
        : '',
      ftaAgreementShort: c.ftaAgreementCode ? ` (${c.ftaAgreementCode})` : '',
      confidence: c.confidenceScore !== null ? Number(c.confidenceScore).toFixed(2) : '—',
      rationaleBlock: c.selectionRationale
        ? `\n[선택 사유]\n${c.selectionRationale}\n`
        : '',
      citationsBlock: Array.isArray(c.externalSources) && c.externalSources.length > 0
        ? `\n[출처]\n${this.formatCitations(c.externalSources)}`
        : '',
    };

    const tpl = TEMPLATES[channel][language];
    const subject = this.applyVars(tpl.subject, vars);
    const body = this.applyVars(tpl.body, vars);

    return {
      classificationId,
      channel,
      language,
      subject,
      body,
      variables: vars,
    };
  }

  private applyVars(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }

  private formatCitations(sources: unknown[]): string {
    const lines: string[] = [];
    for (const s of sources) {
      if (s && typeof s === 'object') {
        const obj = s as Record<string, unknown>;
        const hs = String(obj.hs_code ?? '');
        const cits = Array.isArray(obj.citations) ? (obj.citations as unknown[]).map(String) : [];
        if (cits.length > 0) {
          lines.push(`- ${hs}: ${cits.join(', ')}`);
        }
      }
    }
    return lines.join('\n');
  }
}
