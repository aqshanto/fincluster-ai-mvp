type MetricTone = "blue" | "cyan" | "emerald" | "amber" | "violet";

interface MetricCardProps {
  value: string;
  label: string;
  note: string;
  tone?: MetricTone;
}

const tones: Record<MetricTone, string> = {
  blue: "text-blue-300 border-blue-500/20 bg-blue-500/5",
  cyan: "text-cyan-300 border-cyan-500/20 bg-cyan-500/5",
  emerald: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5",
  amber: "text-amber-300 border-amber-500/20 bg-amber-500/5",
  violet: "text-violet-300 border-violet-500/20 bg-violet-500/5",
};

export default function MetricCard({
  value,
  label,
  note,
  tone = "cyan",
}: MetricCardProps) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-xl shadow-black/10 ${tones[tone]}`}
    >
      <p className="font-mono text-3xl font-black sm:text-4xl">{value}</p>
      <p className="mt-2 text-sm font-bold text-white">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </article>
  );
}
