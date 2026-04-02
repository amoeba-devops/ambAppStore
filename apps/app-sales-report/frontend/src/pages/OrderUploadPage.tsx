import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface UploadResult {
  channel: string;
  ordersCreated: number;
  ordersSkipped: number;
  itemsCreated: number;
  matchStats: {
    matched: number;
    unmatched: number;
    combo: number;
  };
  batchId: string;
}

export function OrderUploadPage() {
  const { t } = useTranslation('sales');
  const [channel, setChannel] = useState<string>('SHOPEE');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.xlsx')) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    } else {
      setError(t('upload.invalidFileType'));
    }
  }, [t]);

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
      formData.append('channel', channel);

      const res = await apiClient.post('/v1/raw-orders/upload', formData, {
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
        <h1 className="text-xl font-semibold text-gray-900">{t('upload.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('upload.description')}</p>
      </div>

      {/* Channel Selector */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t('upload.selectChannel')}
        </label>
        <div className="flex gap-3">
          {['SHOPEE', 'TIKTOK'].map((ch) => (
            <button
              key={ch}
              onClick={() => { setChannel(ch); setFile(null); setResult(null); setError(null); }}
              className={`flex items-center gap-2 rounded-lg border-2 px-5 py-3 text-sm font-medium transition-all ${
                channel === ch
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {ch === 'SHOPEE' ? 'Shopee' : 'TikTok Shop'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {channel === 'SHOPEE' ? t('upload.shopeeHint') : t('upload.tiktokHint')}
        </p>
      </div>

      {/* File Upload Area */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t('upload.selectFile')}
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 transition-colors hover:border-blue-400 hover:bg-blue-50/30"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="mb-3 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            {file ? (
              <span className="font-medium text-blue-600">{file.name}</span>
            ) : (
              t('upload.dropzone')
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">{t('upload.fileLimit')}</p>
          <input
            id="file-input"
            type="file"
            accept=".xlsx"
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{result.ordersCreated}</p>
              <p className="text-xs text-gray-500">{t('upload.ordersCreated')}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{result.itemsCreated}</p>
              <p className="text-xs text-gray-500">{t('upload.itemsCreated')}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{result.ordersSkipped}</p>
              <p className="text-xs text-gray-500">{t('upload.ordersSkipped')}</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">
                {result.matchStats.matched + result.matchStats.unmatched + result.matchStats.combo > 0
                  ? Math.round(
                      (result.matchStats.matched * 100) /
                        (result.matchStats.matched + result.matchStats.unmatched + result.matchStats.combo),
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500">{t('upload.skuMatchRate')}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span>MATCHED: {result.matchStats.matched}</span>
            <span>UNMATCHED: {result.matchStats.unmatched}</span>
            <span>COMBO: {result.matchStats.combo}</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Batch: {result.batchId}</p>
        </div>
      )}
    </div>
  );
}
