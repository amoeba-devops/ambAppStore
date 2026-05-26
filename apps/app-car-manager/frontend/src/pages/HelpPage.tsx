import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Kanban,
  FileText,
  Car,
  UserCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

export function HelpPage() {
  const { t } = useTranslation('car');

  return (
    <div>
      <PageHeader
        title={t('help.title')}
        breadcrumb={['app-car-manager', t('nav.help')]}
      />

      <div className="mx-auto max-w-4xl space-y-8 p-6">
        {/* Intro */}
        <section className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">{t('help.introTitle')}</h2>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {t('help.introBody')}
          </p>
        </section>

        {/* Table of contents */}
        <nav className="rounded-xl border border-[#e2e5eb] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t('help.toc')}
          </div>
          <ul className="space-y-1 text-sm text-orange-600">
            <li><a href="#nav" className="hover:underline">1. {t('help.navTitle')}</a></li>
            <li><a href="#dispatch" className="hover:underline">2. {t('help.dispatchTitle')}</a></li>
            <li><a href="#trip-log" className="hover:underline">3. {t('help.tripLogTitle')}</a></li>
            <li><a href="#vehicle-driver" className="hover:underline">4. {t('help.vehicleDriverTitle')}</a></li>
            <li><a href="#tips" className="hover:underline">5. {t('help.tipsTitle')}</a></li>
          </ul>
        </nav>

        {/* 1. Navigation */}
        <section id="nav" className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">1. {t('help.navTitle')}</h2>
          <p className="mb-4 text-sm text-gray-600">{t('help.navIntro')}</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <NavItem icon={<Kanban className="h-4 w-4 text-orange-500" />} label={t('nav.dispatchBoard')} desc={t('help.navDispatchDesc')} />
            <NavItem icon={<FileText className="h-4 w-4 text-orange-500" />} label={t('nav.tripLogs')} desc={t('help.navTripLogDesc')} />
            <NavItem icon={<Car className="h-4 w-4 text-orange-500" />} label={t('nav.vehicleList')} desc={t('help.navVehicleDesc')} />
            <NavItem icon={<UserCheck className="h-4 w-4 text-orange-500" />} label={t('nav.driverList')} desc={t('help.navDriverDesc')} />
          </ul>
        </section>

        {/* 2. Dispatch workflow */}
        <section id="dispatch" className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">2. {t('help.dispatchTitle')}</h2>
          <p className="mb-4 text-sm text-gray-600">{t('help.dispatchIntro')}</p>

          {/* Status flow diagram */}
          <div className="mb-5 overflow-x-auto rounded-lg border border-[#e2e5eb] bg-[#f9fafb] p-4">
            <div className="flex min-w-max items-center gap-1 font-mono text-[11px]">
              <StatusPill color="yellow" label="PENDING" />
              <Arrow />
              <StatusPill color="blue" label="APPROVED" />
              <Arrow />
              <StatusPill color="indigo" label="DRIVER_ACCEPTED" />
              <Arrow />
              <StatusPill color="blue" label="DEPARTED" />
              <Arrow />
              <StatusPill color="blue" label="ARRIVED" />
              <Arrow />
              <StatusPill color="green" label="COMPLETED" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
              <XCircle className="h-3 w-3 text-red-400" />
              <span>{t('help.dispatchTerminalNote')}</span>
            </div>
          </div>

          {/* Step-by-step */}
          <ol className="space-y-3 text-sm">
            <Step n={1} title={t('help.dispatchStep1Title')} body={t('help.dispatchStep1Body')} />
            <Step n={2} title={t('help.dispatchStep2Title')} body={t('help.dispatchStep2Body')} />
            <Step n={3} title={t('help.dispatchStep3Title')} body={t('help.dispatchStep3Body')} />
            <Step n={4} title={t('help.dispatchStep4Title')} body={t('help.dispatchStep4Body')} />
            <Step n={5} title={t('help.dispatchStep5Title')} body={t('help.dispatchStep5Body')} />
            <Step n={6} title={t('help.dispatchStep6Title')} body={t('help.dispatchStep6Body')} />
          </ol>

          <div className="mt-5 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800">
            <strong>{t('help.dispatchCancelTitle')}:</strong> {t('help.dispatchCancelBody')}
          </div>

          <div className="mt-3">
            <Link to="/dispatches" className="text-xs text-orange-600 hover:underline">
              → {t('help.openDispatchBoard')}
            </Link>
          </div>
        </section>

        {/* 3. Trip Log workflow */}
        <section id="trip-log" className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">3. {t('help.tripLogTitle')}</h2>
          <p className="mb-4 text-sm text-gray-600">{t('help.tripLogIntro')}</p>

          <div className="mb-5 rounded-lg border border-[#e2e5eb] bg-[#f9fafb] p-4">
            <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
              <StatusPill color="yellow" label="IN_PROGRESS" />
              <Arrow />
              <StatusPill color="blue" label="COMPLETED" />
              <Arrow />
              <StatusPill color="green" label="VERIFIED" />
              <span className="mx-2 text-gray-400">|</span>
              <StatusPill color="gray" label="VOIDED" />
            </div>
          </div>

          <ol className="space-y-3 text-sm">
            <Step n={1} title={t('help.tripLogStep1Title')} body={t('help.tripLogStep1Body')} />
            <Step n={2} title={t('help.tripLogStep2Title')} body={t('help.tripLogStep2Body')} />
            <Step n={3} title={t('help.tripLogStep3Title')} body={t('help.tripLogStep3Body')} />
            <Step n={4} title={t('help.tripLogStep4Title')} body={t('help.tripLogStep4Body')} />
          </ol>

          <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <strong>{t('help.tripLogTip')}:</strong> {t('help.tripLogTipBody')}
          </div>

          <div className="mt-3 flex gap-3">
            <Link to="/trip-logs" className="text-xs text-orange-600 hover:underline">
              → {t('help.openTripLogList')}
            </Link>
            <Link to="/trip-logs/new" className="text-xs text-orange-600 hover:underline">
              → {t('help.openTripLogNew')}
            </Link>
          </div>
        </section>

        {/* 4. Vehicle & Driver */}
        <section id="vehicle-driver" className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-900">4. {t('help.vehicleDriverTitle')}</h2>
          <p className="mb-4 text-sm text-gray-600">{t('help.vehicleDriverIntro')}</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <span>{t('help.vehicleStatusBody')}</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              <span>{t('help.driverStatusBody')}</span>
            </li>
          </ul>
        </section>

        {/* 5. Tips */}
        <section id="tips" className="rounded-xl border border-[#e2e5eb] bg-white p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">5. {t('help.tipsTitle')}</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <Circle className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500" />
              <span>{t('help.tip1')}</span>
            </li>
            <li className="flex gap-2">
              <Circle className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500" />
              <span>{t('help.tip2')}</span>
            </li>
            <li className="flex gap-2">
              <Circle className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500" />
              <span>{t('help.tip3')}</span>
            </li>
            <li className="flex gap-2">
              <Circle className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-500" />
              <span>{t('help.tip4')}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function NavItem({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </li>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
        {n}
      </div>
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-gray-600">{body}</div>
      </div>
    </li>
  );
}

const PILL_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  gray: 'bg-gray-100 text-gray-600 border-gray-300 line-through',
};

function StatusPill({ color, label }: { color: keyof typeof PILL_COLORS; label: string }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 ${PILL_COLORS[color]}`}>
      {label}
    </span>
  );
}

function Arrow() {
  return <ArrowRight className="h-3 w-3 text-gray-400" />;
}
