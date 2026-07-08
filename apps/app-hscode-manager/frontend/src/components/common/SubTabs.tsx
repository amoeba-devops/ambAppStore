import clsx from 'clsx';

interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function SubTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="mt-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            '-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition',
            active === tab.key
              ? 'border-brand text-brand-dark'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
