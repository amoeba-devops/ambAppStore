'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { loadSnapshotAction } from '@/server/actions/ingest.actions';
import { listArchiveFilesForPeriodAction } from '@/server/actions/archive.actions';
import { WizardStepper, type WizardStep } from './WizardStepper';
import { Step1Period, effectiveStatus, type Granularity, type SelectedPeriod } from './Step1Period';

export interface ExistingArchiveFile {
  arfId: string;
  channel: 'SHOPEE' | 'TIKTOK';
  fileType: 'SALES' | 'ADS' | 'BRAND_ADS' | 'OFF_PLATFORM_ADS' | 'TRAFFIC' | 'AFFILIATE';
  filename: string;
  sizeBytes: number;
  rowCount: number | null;
  uploadedAt: string;
  uploadedBy: string;
  s3Key: string | null;
}
import { Step2Upload } from './Step2Upload';
import {
  Step3ManualInput,
  emptyManualInputs,
  ALL_MANUAL_FIELDS,
  type ManualInputs,
} from './Step3ManualInput';
import { Step4Review } from './Step4Review';
import { Step5Validate } from './Step5Validate';
import { Step6Ingest } from './Step6Ingest';

function buildSteps(t: (key: '1' | '2' | '3' | '4' | '5' | '6') => string): WizardStep[] {
  return [
    { id: 1, label: t('1') },
    { id: 2, label: t('2') },
    { id: 3, label: t('3') },
    { id: 4, label: t('4') },
    { id: 5, label: t('5') },
    { id: 6, label: t('6') },
  ];
}

interface UploadReportsClientProps {
  /** Real DB-backed period keys, used to filter stale status overrides in Step 1. */
  realPeriodKeys?: string[];
}

export function UploadReportsClient({ realPeriodKeys = [] }: UploadReportsClientProps = {}) {
  const tHeader = useTranslations('uploadWizard.header');
  const tStepper = useTranslations('uploadWizard.stepperLabels');
  const tNav = useTranslations('uploadWizard.nav');
  const STEPS = buildSteps(tStepper);
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);

  // Step 1 state
  const [granularity, setGranularity] = useState<Granularity | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod | null>(null);

  // Step 2 state
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [step2Attempted, setStep2Attempted] = useState(false);

  // Step 3 state
  const [manualInputs, setManualInputs] = useState<ManualInputs>(emptyManualInputs);
  const [step3Attempted, setStep3Attempted] = useState(false);

  const totalSlots = 9; // 6 Shopee + 3 TikTok

  const isManualFilled = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());
  const manualMissing = ALL_MANUAL_FIELDS.filter((k) => !isManualFilled(manualInputs[k]));

  // Compute effective status for selected period. Drives Continue gating
  // (Finalized → blocked) and Active pre-fill behavior.
  const periodStatus = selectedPeriod
    ? effectiveStatus(selectedPeriod.label, realPeriodKeys)
    : null;

  // Existing archive files for the selected period (Active only) — shown in
  // Step 2 as a "Previously uploaded" panel so operator knows what's there
  // and can choose to skip Step 2 (keep existing) or upload replacements.
  const [existingFiles, setExistingFiles] = useState<ExistingArchiveFile[]>([]);

  // When Active period is selected, pre-load Manual Input + existing files
  // from the DB so operator doesn't re-enter / re-upload everything.
  useEffect(() => {
    if (!selectedPeriod || periodStatus !== 'Active') {
      setExistingFiles([]);
      return;
    }
    let cancelled = false;
    const granularity = selectedPeriod.granularity === 'WEEK' ? 'WEEKLY' : 'MONTHLY';
    const weekNum =
      selectedPeriod.granularity === 'WEEK' ? selectedPeriod.periodId : undefined;
    const monthIdx =
      selectedPeriod.granularity === 'MONTH' ? selectedPeriod.periodId : undefined;
    Promise.all([
      loadSnapshotAction({ granularity, weekNum, monthIdx, year: selectedPeriod.year }),
      listArchiveFilesForPeriodAction({ granularity, weekNum, monthIdx, year: selectedPeriod.year }),
    ]).then(([snapRes, filesRes]) => {
      if (cancelled) return;
      if (snapRes.success && snapRes.data.metrics) {
        const mi = snapRes.data.metrics.manualInputs;
        setManualInputs({
          affiliateBookingFees: String(mi.affiliateBookingFees ?? ''),
          shopeeLivestreamFees: String(mi.shopeeLivestreamFees ?? ''),
          tiktokLivestreamFees: String(mi.tiktokLivestreamFees ?? ''),
          tiktokAdsSpending: String(mi.tiktokAdsSpending ?? ''),
        });
      }
      if (filesRes.success) {
        setExistingFiles(
          filesRes.data.files.map((f) => ({
            arfId: f.arfId,
            channel: f.channel,
            fileType: f.fileType,
            filename: f.filename,
            sizeBytes: f.sizeBytes,
            rowCount: f.rowCount,
            uploadedAt:
              f.uploadedAt instanceof Date ? f.uploadedAt.toISOString() : String(f.uploadedAt),
            uploadedBy: f.uploadedBy,
            s3Key: f.s3Key,
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, periodStatus]);

  const onChangeGranularity = (g: Granularity) => {
    setGranularity(g);
    // Reset period selection if granularity changed
    if (selectedPeriod && selectedPeriod.granularity !== g) {
      setSelectedPeriod(null);
    }
  };

  const goNext = () => {
    if (step >= STEPS.length) return;
    // TEMP: validation bypass on Step 2 + Step 3 for faster testing.
    // Re-enable before production by reverting this block.
    setCompleted((prev) => Array.from(new Set([...prev, step])));
    setStep(step + 1);
  };

  const goBack = () => {
    if (step <= 1) return;
    setStep(step - 1);
  };

  const isLast = step === STEPS.length;
  const isFirst = step === 1;

  // Continue button enabled only when step is complete
  // For Step 2, keep button visually enabled so user can click → triggers error message
  const canContinue = (() => {
    if (step === 1) {
      if (!selectedPeriod) return false;
      // Finalized periods are read-only — admin must unfinalize first.
      if (periodStatus === 'Finalized' || periodStatus === 'Locked') return false;
      return true;
    }
    return true;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{tHeader('title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{tHeader('subtitle')}</p>
      </div>

      <div className="rounded-md border border-neutral-200 bg-white px-6 py-4">
        <WizardStepper
          steps={STEPS}
          current={step}
          completed={completed}
          onStepClick={(id) => {
            if (id < step) setStep(id);
          }}
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white px-6 py-6 min-h-[400px]">
        {step === 1 && (
          <Step1Period
            granularity={granularity}
            selected={selectedPeriod}
            onChangeGranularity={onChangeGranularity}
            onChangePeriod={setSelectedPeriod}
            realPeriodKeys={realPeriodKeys}
          />
        )}
        {step === 2 && (
          <Step2Upload
            selectedPeriod={selectedPeriod}
            files={files}
            onFilesChange={(next) => {
              setFiles(next);
              if (next.size === totalSlots) setStep2Attempted(false);
            }}
            attempted={step2Attempted}
            existingFiles={existingFiles}
          />
        )}
        {step === 3 && (
          <Step3ManualInput
            values={manualInputs}
            onChange={(next) => {
              setManualInputs(next);
              const stillMissing = ALL_MANUAL_FIELDS.some(
                (k) => !/^-?\d+(\.\d+)?$/.test(next[k].trim()),
              );
              if (!stillMissing) setStep3Attempted(false);
            }}
            attempted={step3Attempted}
            selectedPeriod={selectedPeriod}
          />
        )}
        {step === 4 && <Step4Review selectedPeriod={selectedPeriod} />}
        {step === 5 && <Step5Validate selectedPeriod={selectedPeriod} />}
        {step === 6 && (
          <Step6Ingest
            selectedPeriod={selectedPeriod}
            files={files}
            manualInputs={manualInputs}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirst}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
            isFirst
              ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300'
              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          {tNav('back')}
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              !canContinue
                ? 'cursor-not-allowed bg-neutral-300 text-white'
                : 'bg-neutral-900 text-white hover:bg-neutral-800',
            )}
          >
            {tNav('continue')}
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
