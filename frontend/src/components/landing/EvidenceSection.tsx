import { CheckCircle2 } from "lucide-react";

import MetricCard from "@/components/landing/ui/MetricCard";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const metrics = [
  {
    value: "87.5%",
    label: "Held-out synthetic baseline accuracy",
    note: "Measured on the seeded simulator test split—not production banking data.",
  },
  {
    value: "2",
    label: "Local candidate algorithms",
    note: "Random Forest and XGBoost compete during training and retraining.",
  },
  {
    value: "7/7",
    label: "Backend architecture tests passing",
    note: "Review storage, local inference, fallback routing, and isolation checks.",
  },
  {
    value: "100",
    label: "Reviewed labels before first retraining",
    note: "The system waits for enough trusted feedback before training a challenger.",
  },
  {
    value: "25",
    label: "New labels per later retraining cycle",
    note: "Prevents unnecessary training after every single operator decision.",
  },
];

const verified = [
  "Frontend lint passed",
  "Production frontend build passed",
  "Human-review lifecycle verified",
  "Correct and incorrect predictions measured",
  "Two-cycle retraining trigger verified",
  "Artifact promotion and hot-loading verified",
];

export default function EvidenceSection() {
  return (
    <section id="evidence" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Evidence and current results"
          title="A working lifecycle, not only a presentation mock-up."
          description={
            <p>
              The current MVP has been validated locally across the frontend,
              backend, review queue, model selection, retraining triggers,
              artifact promotion, and runtime hot-loading.
            </p>
          }
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {verified.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
