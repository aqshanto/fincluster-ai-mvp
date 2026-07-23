interface FlowStepProps {
  number: string;
  title: string;
  description: string;
  accent?: "blue" | "emerald" | "amber" | "rose";
}

const accents = {
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export default function FlowStep({
  number,
  title,
  description,
  accent = "blue",
}: FlowStepProps) {
  return (
    <article className="relative rounded-2xl border border-slate-800 bg-slate-950/75 p-5">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-xs font-black ${accents[accent]}`}
      >
        {number}
      </div>
      <h3 className="mt-4 font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </article>
  );
}
