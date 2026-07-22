import { ArrowDown, Database, FileCheck2, FlaskConical, RefreshCw, ShieldCheck } from "lucide-react";

import SectionHeading from "@/components/landing/ui/SectionHeading";

const phases = [
  {
    icon: Database,
    title: "100 reviewed labels",
    note: "Minimum before first controlled retraining",
  },
  {
    icon: FlaskConical,
    title: "Train both candidates",
    note: "Random Forest and XGBoost use the same data",
  },
  {
    icon: FileCheck2,
    title: "Evaluate honestly",
    note: "Validation threshold tuning + held-out test metrics",
  },
  {
    icon: ShieldCheck,
    title: "Apply quality gates",
    note: "Recall, balanced accuracy, and selection score",
  },
  {
    icon: RefreshCw,
    title: "Promote and hot-load",
    note: "Only the approved artifact replaces the live model",
  },
];

export default function RetrainingSection() {
  return (
    <section className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Controlled retraining"
          title="The model learns from reviewed decisions—not from its own guesses."
          description={
            <p>
              The first retraining waits for enough trusted data. Every later
              cycle requires another full reviewed batch, and the existing model
              remains online if training fails or the challenger is weaker.
            </p>
          }
          align="center"
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {phases.map(({ icon: Icon, title, note }, index) => (
            <div key={title}>
              <article className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/5 text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{note}</p>
                </div>
              </article>
              {index < phases.length - 1 && (
                <ArrowDown className="mx-auto my-2 h-5 w-5 text-slate-600" />
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-blue-300">100</p>
            <p className="mt-2 text-sm font-bold text-white">First threshold</p>
            <p className="mt-1 text-xs text-slate-500">Reviewed transactions</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-emerald-300">25</p>
            <p className="mt-2 text-sm font-bold text-white">Next batch</p>
            <p className="mt-1 text-xs text-slate-500">New reviewed labels</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-amber-300">OFF</p>
            <p className="mt-2 text-sm font-bold text-white">Development mode</p>
            <p className="mt-1 text-xs text-slate-500">Auto promotion stays disabled</p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-sm font-black text-amber-200">
            Hackathon demonstration policy
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            A separate controlled reviewed dataset validates retraining,
            promotion, and hot-loading without contaminating the live review
            database. Near-perfect metrics on that easy test dataset prove the
            mechanism only—they are not a claim of real-world MFS accuracy.
          </p>
        </div>
      </div>
    </section>
  );
}
