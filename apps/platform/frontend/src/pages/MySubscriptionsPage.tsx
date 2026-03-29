import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Store } from 'lucide-react';
import { useMySubscriptions, useCancelSubscription } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/auth.store';
import { SubscriptionCard } from '@/components/SubscriptionCard';

type FilterTab = 'ALL' | 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'OTHER';

const FILTER_STATUSES: Record<FilterTab, string[]> = {
  ALL: [],
  PENDING: ['PENDING'],
  ACTIVE: ['ACTIVE'],
  EXPIRED: ['EXPIRED'],
  OTHER: ['REJECTED', 'CANCELLED', 'SUSPENDED'],
};

export function MySubscriptionsPage() {
  const { t } = useTranslation('platform');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { data: subscriptions, isLoading } = useMySubscriptions(isAuthenticated);
  const cancelMutation = useCancelSubscription();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filteredSubs = useMemo(() => {
    if (!subscriptions) return [];
    const statuses = FILTER_STATUSES[activeTab];
    if (statuses.length === 0) return subscriptions;
    return subscriptions.filter((s) => statuses.includes(s.status));
  }, [subscriptions, activeTab]);

  const handleCancel = (subId: string) => {
    if (!confirm(t('mySubscriptions.cancelConfirmMessage'))) return;
    setCancellingId(subId);
    cancelMutation.mutate(subId, {
      onSettled: () => setCancellingId(null),
    });
  };

  if (!isAuthenticated) {
    navigate('/apps/login');
    return null;
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: t('mySubscriptions.filterAll') },
    { key: 'PENDING', label: t('mySubscriptions.filterPending') },
    { key: 'ACTIVE', label: t('mySubscriptions.filterActive') },
    { key: 'EXPIRED', label: t('mySubscriptions.filterExpired') },
    { key: 'OTHER', label: t('mySubscriptions.filterOther') },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('mySubscriptions.title')}</h1>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="py-20 text-center text-gray-400">{t('common.loading')}</p>
      ) : filteredSubs.length === 0 ? (
        <div className="py-20 text-center">
          <Store className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-2 text-lg font-medium text-gray-500">{t('mySubscriptions.empty')}</p>
          <p className="mb-6 text-sm text-gray-400">{t('mySubscriptions.emptyDesc')}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t('mySubscriptions.browseApps')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredSubs.map((sub) => (
            <SubscriptionCard
              key={sub.subId}
              subscription={sub}
              onCancel={handleCancel}
              isCancelling={cancellingId === sub.subId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
