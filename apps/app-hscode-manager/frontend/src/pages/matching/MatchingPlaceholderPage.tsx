import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { intakeService } from '@/services/intake.service';

/**
 * Phase 2에서는 매칭 단계가 아직 구현되지 않았다.
 * Inquiry 등록 결과 Item 목록을 보여주고 Phase 3 진입까지의 대기 메시지를 표시한다.
 */
export function MatchingPlaceholderPage() {
  const { t } = useTranslation('intake');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();

  const { data: items = [] } = useQuery({
    queryKey: ['items', inquiryId],
    queryFn: () => intakeService.listItemsByInquiry(inquiryId!),
    enabled: !!inquiryId,
  });

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate('/')}
      >
        <ChevronLeft className="h-4 w-4" />
        Dashboard
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">
        등록 완료 — Phase 3 매칭 대기
      </h1>

      <div className="card max-w-4xl space-y-3">
        <p className="text-sm text-gray-600">
          {items.length}건의 Item이 Inquiry에 적재되었습니다. 매칭 엔진(Phase 3)이
          완성되면 여기서 추천 결과가 표시됩니다.
        </p>
        <ul className="divide-y divide-gray-100 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-gray-800">{it.nameRaw}</div>
                <div className="text-xs text-gray-500">
                  {it.category} · hash: <code>{it.compositionHash}</code>
                </div>
              </div>
              <div className="text-xs font-mono text-gray-600">
                {it.completenessScore?.toFixed(2) ?? '—'}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* t 사용으로 unused-var 경고 회피 */}
      <span className="hidden">{t('channel.title')}</span>
    </div>
  );
}
