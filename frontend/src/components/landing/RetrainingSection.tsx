import {
  ArrowDown,
  Database,
  FileCheck2,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import LandingVisual from "@/components/landing/ui/LandingVisual";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const phases = [
  {
    icon: Database,
    title: "Wait for enough trusted data",
    note: "At least 100 reviewed transactions, including both Heavy and Light examples",
  },
  {
    icon: FlaskConical,
    title: "Train both candidates",
    note: "Random Forest and XGBoost use the same reviewed dataset",
  },
  {
    icon: FileCheck2,
    title: "Tune and test honestly",
    note: "Threshold tuning uses validation data; final metrics use a held-out test split",
  },
  {
    icon: ShieldCheck,
    title: "Apply quality gates",
    note: "Recall, balanced accuracy, and the overall selection score must pass",
  },
  {
    icon: RefreshCw,
    title: "Promote and hot-load",
    note: "Only an approved artifact can replace the running local model",
  },
];

export default function RetrainingSection() {
  return (
    <section
      id="retraining"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Controlled retraining"
          title="Verified labels create the learning loop—not the model's own guesses."
          description={
            <p>
              The current live MVP keeps automatic retraining disabled. The
              pipeline has been tested separately with isolated reviewed data,
              including threshold checks, two retraining cycles, artifact
              promotion, and hot-loading.
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
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {note}
                  </p>
                </div>
              </article>

              {index < phases.length - 1 && (
                <ArrowDown className="mx-auto my-2 h-5 w-5 text-slate-600" />
              )}
            </div>
          ))}
        </div>

        <LandingVisual
          src="/landing/controlled-retraining.png"
          alt="Controlled FinCluster retraining pipeline using human-reviewed labels, Random Forest, XGBoost, validation metrics, quality gates, promotion, and hot loading"
          label="Controlled Model Improvement"
          tone="violet"
          caption="Human-reviewed labels train candidate models. A challenger replaces the live model only after it passes the configured quality gates."
          className="mt-16"
        />

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-blue-300">100</p>
            <p className="mt-2 text-sm font-bold text-white">
              First reviewed threshold
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Before initial retraining
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-emerald-300">25</p>
            <p className="mt-2 text-sm font-bold text-white">
              Later review batch
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Before another cycle
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-center">
            <p className="font-mono text-3xl font-black text-amber-300">OFF</p>
            <p className="mt-2 text-sm font-bold text-white">
              Live auto-retraining
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Disabled during development
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-sm font-black text-amber-200">
            Honest hackathon demonstration
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            The isolated retraining dataset deliberately contains clear classes,
            so near-perfect test metrics prove that the retraining mechanism
            works. They do not prove near-perfect accuracy on real MFS traffic.
          </p>
        </div>
      </div>
    </section>
  );
}
