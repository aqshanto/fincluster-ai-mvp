import {
  ArrowRight,
  Cpu,
  Database,
  ScanSearch,
  Send,
  UserCheck,
} from "lucide-react";

import FlowStep from "@/components/landing/ui/FlowStep";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const steps = [
  {
    number: "01",
    title: "Receive the transaction",
    description:
      "The simulator accepts amount, type, account age, MCC, device, location, and VPN metadata.",
    accent: "blue" as const,
  },
  {
    number: "02",
    title: "Extract useful features",
    description:
      "The metadata becomes a compact feature vector for fast, local inference.",
    accent: "blue" as const,
  },
  {
    number: "03",
    title: "Estimate workload and confidence",
    description:
      "The active model predicts whether the transaction needs a Heavy verification path or a Light fast path.",
    accent: "blue" as const,
  },
  {
    number: "04",
    title: "Pause uncertain cases",
    description:
      "Low confidence, a fallback, or an operator request can hold the transaction for human review.",
    accent: "amber" as const,
  },
  {
    number: "05",
    title: "Route to the best healthy node",
    description:
      "The scheduler considers workload type, node capability, temperature, health, and current load.",
    accent: "emerald" as const,
  },
  {
    number: "06",
    title: "Measure and improve safely",
    description:
      "Reviewed decisions are stored as trusted labels for later candidate-model evaluation and controlled retraining.",
    accent: "rose" as const,
  },
];

export default function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="A six-step path from transaction metadata to a safer compute route."
          description={
            <p>
              Automatic simulation stays local, so high-volume demo traffic
              does not consume paid AI API calls. External AI remains optional
              for manual experiments instead of becoming a system dependency.
            </p>
          }
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                label: "Local AI analysis",
                note: "Workload probability + evidence",
                tone: "border-cyan-500/25 bg-cyan-500/5 text-cyan-300",
              },
              {
                icon: Cpu,
                label: "Health-aware route",
                note: "The most suitable available node",
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

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <UserCheck className="h-5 w-5 text-amber-300" />
              <p className="mt-3 text-sm font-bold text-white">
                Human safety gate
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Uncertain decisions pause before routing.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <Database className="h-5 w-5 text-violet-300" />
              <p className="mt-3 text-sm font-bold text-white">
                Trusted learning evidence
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Human-reviewed labels—not model guesses—support retraining.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
