'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { cn } from '@v2/ui';
import { WizardStepper, type WizardStep } from './WizardStepper';
import { Step1Period, type Granularity, type SelectedPeriod } from './Step1Period';
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

const STEPS: WizardStep[] = [
  { id: 1, label: 'Period' },
  { id: 2, label: 'Upload files' },
  { id: 3, label: 'Manual Input' },
  { id: 4, label: 'Review' },
  { id: 5, label: 'Validate' },
  { id: 6, label: 'Ingest' },
];

export function UploadReportsClient() {
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
    if (step === 1) return selectedPeriod !== null;
    return true;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Upload reports</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Add raw exports from Shopee Seller Center and TikTok Shop Seller. Files stay archived for audit.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <History className="h-4 w-4" />
          Past uploads
        </button>
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
          Back
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
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
