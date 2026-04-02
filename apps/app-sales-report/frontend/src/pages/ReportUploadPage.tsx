import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, BarChart3, Megaphone, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type ReportCategory = 'TRAFFIC' | 'ADS' | 'AFFILIATE';

interface ReportType {
  key: string;
  label: string;
  hint: string;
  endpoint: string;
  accept: string;
  category: ReportCategory;
}

interface UploadResult {
  rowsInserted: number;
  uploadHistoryId: string;
}

export function ReportUploadPage() {
  const { t } = useTranslation('sales');

  const reportTypes: ReportType[] = [
    {
      key: 'SHOPEE_TRAFFIC',
      label: t('reportUpload.shopeeTraffic'),
      hint: t('reportUpload.shopeeTrafficHint'),
      endpoint: '/v1/reports/traffic/shopee',
      accept: '.xlsx',
      category: 'TRAFFIC',
    },
    {
      key: 'TIKTOK_TRAFFIC',
      label: t('reportUpload.tiktokTraffic'),
      hint: t('reportUpload.tiktokTrafficHint'),
      endpoint: '/v1/reports/traffic/tiktok',
      accept: '.xlsx',
      category: 'TRAFFIC',
    },
    {
      key: 'SHOPEE_AD',
      label: t('reportUpload.shopeeAd'),
      hint: t('reportUpload.shopeeAdHint'),
      endpoint: '/v1/reports/ads/shopee',
      accept: '.csv',
      category: 'ADS',
    },
    {
      key: 'TIKTOK_AD_PRODUCT',
      label: t('reportUpload.tiktokAdProduct'),
      hint: t('reportUpload.tiktokAdProductHint'),
      endpoint: '/v1/reports/ads/tiktok-product',
      accept: '.xlsx',
      category: 'ADS',
    },
    {
      key: 'TIKTOK_AD_LIVE',
      label: t('reportUpload.tiktokAdLive'),
      hint: t('reportUpload.tiktokAdLiveHint'),
      endpoint: '/v1/reports/ads/tiktok-live',
      accept: '.xlsx',
      category: 'ADS',
    },
    {
      key: 'SHOPEE_AFFILIATE',
      label: t('reportUpload.shopeeAffiliate'),
      hint: t('reportUpload.shopeeAffiliateHint'),
      endpoint: '/v1/reports/affiliate/shopee',
      accept: '.csv',
      category: 'AFFILIATE',
    },
  ];

  const categories: { key: ReportCategory; label: string; icon: typeof BarChart3 }[] = [
    { key: 'TRAFFIC', label: t('reportUpload.categoryTraffic'), icon: BarChart3 },
    { key: 'ADS', label: t('reportUpload.categoryAds'), icon: Megaphone },
    { key: 'AFFILIATE', label: t('reportUpload.categoryAffiliate'), icon: Users },
  ];

  const [activeCategory, setActiveCategory] = useState<ReportCategory>('TRAFFIC');
  const [selectedType, setSelectedType] = useState<string>('SHOPEE_TRAFFIC');
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentReport = reportTypes.find((r) => r.key === selectedType)!;
  const filteredTypes = reportTypes.filter((r) => r.category === activeCategory);

  const handleCategoryChange = (cat: ReportCategory) => {
    setActiveCategory(cat);
    const first = reportTypes.find((r) => r.category === cat);
    if (first) setSelectedType(first.key);
    resetState();
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setPeriodStart('');
    setPeriodEnd('');
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile) return;
      const ext = droppedFile.name.toLowerCase();
      const allowed = currentReport.accept.split(',').map((a) => a.trim());
      if (allowed.some((a) => ext.endsWith(a))) {
        setFile(droppedFile);
        setResult(null);
        setError(null);
      } else {
        setError(t('reportUpload.invalidFileType', { types: currentReport.accept }));
      }
    },
    [currentReport, t],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (periodStart) formData.append('period_start', periodStart);
      if (periodEnd) formData.append('period_end', periodEnd);

      const res = await apiClient.post(currentReport.endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      setResult(res.data.data);
      setFile(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('reportUpload.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('reportUpload.description')}</p>
      </div>

      {/* Category Tabs */}
      <div className="mb-4 flex gap-2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeCategory === cat.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Report Type Selector */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t('reportUpload.selectType')}
        </label>
        <div className="flex flex-wrap gap-3">
          {filteredTypes.map((rt) => (
            <button
              key={rt.key}
              onClick={() => { setSelectedType(rt.key); resetState(); }}
              className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                selectedType === rt.key
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {rt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">{currentReport.hint}</p>
      </div>

      {/* Period Selector (optional) */}
      {selectedType !== 'TIKTOK_TRAFFIC' && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t('reportUpload.period')}
            <span className="ml-1 text-xs text-gray-400">({t('reportUpload.periodOptional')})</span>
          </label>
          <div className="flex gap-3">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t('reportUpload.periodStart')}
            />
            <span className="flex items-center text-gray-400">~</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t('reportUpload.periodEnd')}
            />
          </div>
        </div>
      )}

      {/* File Upload Area */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t('reportUpload.selectFile')}
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 transition-colors hover:border-blue-400 hover:bg-blue-50/30"
          onClick={() => document.getElementById('report-file-input')?.click()}
        >
          <Upload className="mb-3 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            {file ? (
              <span className="font-medium text-blue-600">{file.name}</span>
            ) : (
              t('upload.dropzone')
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {t('reportUpload.fileLimit', { types: currentReport.accept })}
          </p>
          <input
            id="report-file-input"
            type="file"
            accept={currentReport.accept}
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('upload.uploading')}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {t('upload.uploadButton')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">{t('upload.uploadFailed')}</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-semibold text-green-800">{t('upload.uploadSuccess')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{result.rowsInserted}</p>
              <p className="text-xs text-gray-500">{t('reportUpload.rowsInserted')}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="truncate text-sm font-mono text-blue-600">{result.uploadHistoryId?.slice(0, 8)}...</p>
              <p className="text-xs text-gray-500">{t('reportUpload.uploadId')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
