import { ArrowRight, Cpu, Database, ScanSearch, Send, UserCheck, Workflow } from "lucide-react";

import FlowStep from "@/components/landing/ui/FlowStep";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const steps = [
  {
    number: "01",
    title: "Transaction received",
    description:
      "The simulator receives amount, transaction type, account age, MCC, device, location, and VPN information.",
    accent: "blue" as const,
  },
  {
    number: "02",
    title: "Features extracted",
    description:
      "Raw metadata is converted into a compact numerical feature vector suitable for local inference.",
    accent: "blue" as const,
  },
  {
    number: "03",
    title: "AI calculates workload probability",
    description:
      "The active model estimates whether the transaction needs a Heavy verification path or a Light fast path.",
    accent: "blue" as const,
  },
  {
    number: "04",
    title: "Best validated model is used",
    description:
      "Random Forest and XGBoost compete during training. One selected winner serves live predictions.",
    accent: "emerald" as const,
  },
  {
    number: "05",
    title: "Scheduler selects a healthy node",
    description:
      "The route considers workload type, node capability, health, thermal state, and current load.",
    accent: "emerald" as const,
  },
  {
    number: "06",
    title: "Uncertain cases wait for review",
    description:
      "Low confidence, fallback decisions, or operator requests can hold the transaction before execution.",
    accent: "amber" as const,
  },
  {
    number: "07",
    title: "Reviewed labels support retraining",
    description:
      "Trusted human decisions are stored and later used to evaluate and promote an improved model.",
    accent: "rose" as const,
  },
];

export default function WorkflowSection() {
  return (
    <section id="workflow" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From transaction to decision in seven understandable steps."
          description={
            <p>
              Automatic simulator traffic stays local, so it does not consume
              paid AI API requests. External AI can remain an optional manual
              review tool rather than a dependency for every simulated event.
            </p>
          }
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <FlowStep key={step.number} {...step} />
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
            {[
              {
                icon: Send,
                label: "Transaction",
                note: "MFS metadata enters the switch",
                tone: "border-blue-500/25 bg-blue-500/5 text-blue-300",
              },
              {
                icon: ScanSearch,
                label: "AI analysis",
                note: "Workload probability + evidence",
                tone: "border-cyan-500/25 bg-cyan-500/5 text-cyan-300",
              },
              {
                icon: Cpu,
                label: "Smart routing",
                note: "Healthy node selected",
                tone:
                  "border-emerald-500/25 bg-emerald-500/5 text-emerald-300",
              },
            ].map(({ icon: Icon, label, note, tone }, index) => (
              <div key={label} className="contents">
                <div className={`rounded-2xl border p-5 ${tone}`}>
                  <Icon className="h-5 w-5" />
                  <p className="mt-4 font-bold text-white">{label}</p>
                  <p className="mt-1 text-xs text-slate-500">{note}</p>
                </div>
                {index < 2 && (
                  <ArrowRight className="mx-auto hidden h-5 w-5 text-slate-600 lg:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <UserCheck className="h-5 w-5 text-amber-300" />
              <p className="mt-3 text-sm font-bold text-white">Human review</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Uncertain cases pause before routing.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <Database className="h-5 w-5 text-violet-300" />
              <p className="mt-3 text-sm font-bold text-white">Trusted labels</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Reviewed decisions become training evidence.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <Workflow className="h-5 w-5 text-blue-300" />
              <p className="mt-3 text-sm font-bold text-white">Controlled cycle</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Retraining and promotion happen only after checks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
