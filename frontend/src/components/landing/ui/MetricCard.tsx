interface MetricCardProps {
  value: string;
  label: string;
  note: string;
}

export default function MetricCard({ value, label, note }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/75 p-5 shadow-xl shadow-black/10">
      <p className="font-mono text-3xl font-black text-cyan-300 sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm font-bold text-white">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </article>
  );
}
