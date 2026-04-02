import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Plus, Pencil, Trash2, Eye, EyeOff, Link2, Bot, Mail, HardDrive, ShoppingCart, Server, Globe, X, KeyRound } from 'lucide-react';
import {
  useAdminIntegrations,
  useServiceCatalog,
  useCreateAdminIntegration,
  useUpdateAdminIntegration,
  useDeleteAdminIntegration,
} from '@/hooks/admin/useAdminIntegrations';
import type { AdminIntegration, ServiceCatalogItem } from '@/hooks/admin/useAdminIntegrations';

const CATEGORY_ORDER = ['AI', 'MARKETPLACE', 'EMAIL', 'STORAGE', 'ERP', 'PLATFORM'];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  AI: <Bot className="h-4 w-4" />,
  EMAIL: <Mail className="h-4 w-4" />,
  STORAGE: <HardDrive className="h-4 w-4" />,
  MARKETPLACE: <ShoppingCart className="h-4 w-4" />,
  ERP: <Server className="h-4 w-4" />,
  PLATFORM: <Globe className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  AI: 'bg-purple-50 text-purple-700',
  EMAIL: 'bg-red-50 text-red-700',
  STORAGE: 'bg-blue-50 text-blue-700',
  MARKETPLACE: 'bg-green-50 text-green-700',
  ERP: 'bg-orange-50 text-orange-700',
  PLATFORM: 'bg-cyan-50 text-cyan-700',
};

interface FormState {
  category: string;
  service_code: string;
  service_name: string;
  endpoint: string;
  key_name: string;
  key_value: string;
  extra_config: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  category: 'AI',
  service_code: '',
  service_name: '',
  endpoint: '',
  key_name: '',
  key_value: '',
  extra_config: '',
  is_active: true,
};

export function AdminSettingsPage() {
  const { t } = useTranslation('admin');
  const { data: integrations = [], isLoading } = useAdminIntegrations();
  const { data: catalog = [] } = useServiceCatalog();
  const createMut = useCreateAdminIntegration();
  const updateMut = useUpdateAdminIntegration();
  const deleteMut = useDeleteAdminIntegration();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showKey, setShowKey] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.reduce<Record<string, AdminIntegration[]>>((acc, cat) => {
    const items = integrations.filter((i) => i.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const filteredCatalog = catalog.filter((c: ServiceCatalogItem) => c.category === form.category);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowKey(false);
    setModalOpen(true);
  };

  const openEdit = (item: AdminIntegration) => {
    setEditingId(item.peiId);
    setForm({
      category: item.category,
      service_code: item.serviceCode,
      service_name: item.serviceName,
      endpoint: item.endpoint || '',
      key_name: item.keyName || '',
      key_value: '',
      extra_config: item.extraConfig ? JSON.stringify(item.extraConfig, null, 2) : '',
      is_active: item.isActive,
    });
    setShowKey(false);
    setModalOpen(true);
  };

  const handleServiceSelect = (code: string) => {
    const item = catalog.find((c: ServiceCatalogItem) => c.serviceCode === code);
    if (item) {
      setForm((f) => ({
        ...f,
        service_code: item.serviceCode,
        service_name: item.serviceName,
        endpoint: item.defaultEndpoint || '',
        key_name: item.defaultKeyName || '',
      }));
    }
  };

  const handleSave = async () => {
    const extraConfig = form.extra_config.trim()
      ? (() => { try { return JSON.parse(form.extra_config); } catch { return undefined; } })()
      : undefined;

    if (editingId) {
      const data: Record<string, unknown> = {
        category: form.category,
        service_code: form.service_code,
        service_name: form.service_name,
        endpoint: form.endpoint || undefined,
        key_name: form.key_name || undefined,
        is_active: form.is_active,
        extra_config: extraConfig,
      };
      if (form.key_value) data.key_value = form.key_value;
      await updateMut.mutateAsync({ peiId: editingId, data });
    } else {
      await createMut.mutateAsync({
        category: form.category,
        service_code: form.service_code,
        service_name: form.service_name,
        endpoint: form.endpoint || undefined,
        key_name: form.key_name || undefined,
        key_value: form.key_value || undefined,
        is_active: form.is_active,
        extra_config: extraConfig,
      });
    }
    setModalOpen(false);
  };

  const handleDelete = async (peiId: string) => {
    await deleteMut.mutateAsync(peiId);
    setDeleteConfirmId(null);
  };

  const handleToggleActive = async (item: AdminIntegration) => {
    await updateMut.mutateAsync({
      peiId: item.peiId,
      data: { is_active: !item.isActive },
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5 text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">{t('settings.title')}</h1>
      </div>

      {/* External Integrations Card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800">{t('settings.integrations')}</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">{t('settings.integrationsDesc')}</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('settings.addIntegration')}
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="py-10 text-center">
              <KeyRound className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">{t('settings.noIntegrations')}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat] || 'bg-gray-50 text-gray-600'}`}>
                      {CATEGORY_ICONS[cat]}
                      {t(`settings.category${cat.charAt(0) + cat.slice(1).toLowerCase()}`)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.peiId}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-800">{item.serviceName}</span>
                          {item.endpoint && (
                            <span className="max-w-[200px] truncate text-xs text-gray-400">{item.endpoint}</span>
                          )}
                          {item.hasKeyValue && (
                            <span className="text-xs text-gray-400">🔑 ••••••</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                              item.isActive ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              item.isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                            } mt-0.5`} />
                          </button>
                          <button onClick={() => openEdit(item)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {deleteConfirmId === item.peiId ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(item.peiId)} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700">
                                {t('settings.confirm')}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100">
                                {t('settings.cancel')}
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(item.peiId)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingId ? t('settings.editIntegration') : t('settings.addIntegration')}
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-600">{t('settings.category')} *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, service_code: '', service_name: '', endpoint: '', key_name: '' }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>{t(`settings.category${c.charAt(0) + c.slice(1).toLowerCase()}`)}</option>
                  ))}
                </select>
              </div>
              {/* Service (from catalog) */}
              <div>
                <label className="block text-xs font-medium text-gray-600">{t('settings.serviceCode')} *</label>
                <select
                  value={form.service_code}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">— {t('settings.selectService')} —</option>
                  {filteredCatalog.map((c: ServiceCatalogItem) => (
                    <option key={c.serviceCode} value={c.serviceCode}>{c.serviceName}</option>
                  ))}
                  {!editingId && <option value="__custom">+ Custom</option>}
                </select>
                {(form.service_code === '__custom' || (form.service_code && !filteredCatalog.find((c: ServiceCatalogItem) => c.serviceCode === form.service_code))) && (
                  <input
                    value={form.service_code === '__custom' ? '' : form.service_code}
                    onChange={(e) => setForm((f) => ({ ...f, service_code: e.target.value }))}
                    placeholder="service_code"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                )}
              </div>
              {/* Service Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600">{t('settings.serviceName')} *</label>
                <input
                  value={form.service_name}
                  onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              {/* Endpoint */}
              <div>
                <label className="block text-xs font-medium text-gray-600">{t('settings.endpoint')}</label>
                <input
                  value={form.endpoint}
                  onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              {/* Key Name + Key Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">{t('settings.keyName')}</label>
                  <input
                    value={form.key_name}
                    onChange={(e) => setForm((f) => ({ ...f, key_name: e.target.value }))}
                    placeholder="API Key"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">{t('settings.keyValue')}</label>
                  <div className="relative mt-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={form.key_value}
                      onChange={(e) => setForm((f) => ({ ...f, key_value: e.target.value }))}
                      placeholder={editingId ? t('settings.keyValuePlaceholder') : 'sk-...'}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {/* Extra Config */}
              <div>
                <label className="block text-xs font-medium text-gray-600">{t('settings.extraConfig')}</label>
                <textarea
                  value={form.extra_config}
                  onChange={(e) => setForm((f) => ({ ...f, extra_config: e.target.value }))}
                  placeholder='{"model": "gpt-4o", "region": "us"}'
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                />
              </div>
              {/* Active */}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t('settings.isActive')}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                {t('settings.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.service_code || !form.service_name || createMut.isPending || updateMut.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('settings.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
