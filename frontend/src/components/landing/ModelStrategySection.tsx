import { ArrowDown, Award, BrainCircuit, CheckCircle2, GitCompareArrows, Route } from "lucide-react";

import SectionHeading from "@/components/landing/ui/SectionHeading";

const metrics = [
  ["Random Forest selection score", "0.7824"],
  ["XGBoost selection score", "0.7571"],
  ["Selected runtime model", "Random Forest"],
  ["Held-out baseline accuracy", "87.5%"],
];

export default function ModelStrategySection() {
  return (
    <section id="models" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="AI model strategy"
          title="We do not assume that one algorithm is always best."
          description={
            <p>
              Random Forest and XGBoost are trained against the same features
              and evaluated under the same validation process. The stronger
              candidate is promoted as the single live runtime model.
            </p>
          }
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5">
                <BrainCircuit className="h-6 w-6 text-blue-300" />
                <p className="mt-4 text-lg font-black text-white">Random Forest</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Strong on compact structured datasets, robust, explainable,
                  and currently the best candidate for the seeded baseline.
                </p>
              </div>
              <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
                <GitCompareArrows className="h-6 w-6 text-violet-300" />
                <p className="mt-4 text-lg font-black text-white">XGBoost</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Retained as a challenger because larger reviewed datasets may
                  reveal interactions that improve its ranking later.
                </p>
              </div>
            </div>

            <div className="my-4 flex justify-center">
              <ArrowDown className="h-5 w-5 text-slate-600" />
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-center">
              <Award className="mx-auto h-6 w-6 text-emerald-300" />
              <p className="mt-3 text-lg font-black text-white">
                Evaluation + quality gates
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Precision, recall, F1, balanced accuracy, ROC-AUC, PR-AUC, and a
                weighted selection score determine which model is promoted.
              </p>
            </div>

            <div className="my-4 flex justify-center">
              <ArrowDown className="h-5 w-5 text-slate-600" />
            </div>

            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-cyan-300" />
                <div>
                  <p className="font-black text-white">One validated winner</p>
                  <p className="mt-1 text-xs text-slate-500">
                    The runtime does not ask both models for every transaction.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Current seeded baseline
            </p>
            <div className="mt-5 space-y-3">
              {metrics.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                >
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-right font-mono text-sm font-black text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-sm font-bold text-amber-200">
                Important accuracy disclaimer
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                These values are generated from seeded synthetic simulator data.
                They demonstrate the architecture and evaluation process, not
                production banking performance.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <Route className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-bold text-white">
                Why this is stronger than a single hard-coded model
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                The system can change its preferred algorithm when better,
                trusted reviewed data changes the evidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
