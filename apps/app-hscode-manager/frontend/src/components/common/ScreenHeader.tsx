interface Props {
  id: string;
  title: string;
  sub?: string;
}

export default function ScreenHeader({ id, title, sub }: Props) {
  return (
    <div className="mb-1 mt-6 flex flex-wrap items-baseline gap-2.5">
      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand-dark">
        {id}
      </span>
      <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
      {sub && <span className="text-[13px] text-muted">{sub}</span>}
    </div>
  );
}
