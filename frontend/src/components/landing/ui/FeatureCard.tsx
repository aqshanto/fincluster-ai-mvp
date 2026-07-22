import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "blue" | "emerald" | "amber" | "rose" | "violet";
}

const toneStyles = {
  blue: "border-blue-500/25 bg-blue-500/5 text-blue-300",
  emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/5 text-amber-300",
  rose: "border-rose-500/25 bg-rose-500/5 text-rose-300",
  violet: "border-violet-500/25 bg-violet-500/5 text-violet-300",
};

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = "blue",
}: FeatureCardProps) {
  return (
    <article className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-slate-700">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneStyles[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </article>
  );
}
