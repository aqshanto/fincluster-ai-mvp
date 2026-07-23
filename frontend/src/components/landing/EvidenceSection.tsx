import { CheckCircle2 } from "lucide-react";

import MetricCard from "@/components/landing/ui/MetricCard";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const metrics = [
  {
    value: "87.5%",
    label: "Held-out baseline accuracy",
    note: "Selected local model on seeded synthetic test data.",
    tone: "blue" as const,
  },
  {
    value: "83.3%",
    label: "Reviewed accuracy",
    note: "5 of 6 early human reviews agreed with the prediction; not yet statistically meaningful.",
    tone: "amber" as const,
  },
  {
    value: "748",
    label: "Stored simulator rows",
    note: "Current local SQLite snapshot without sensitive identifiers.",
    tone: "cyan" as const,
  },
  {
    value: "2",
    label: "Candidate algorithms",
    note: "Random Forest and XGBoost are compared under one evaluation process.",
    tone: "violet" as const,
  },
  {
    value: "7/7",
    label: "Backend tests passing",
    note: "Review storage, inference, fallback routing, and isolation checks.",
    tone: "emerald" as const,
  },
  {
    value: "0",
    label: "External API calls",
    note: "Current local-first run uses no paid AI inference requests.",
    tone: "emerald" as const,
  },
];

const verified = [
  "Landing, dashboard, and simulator production routes build successfully",
  "Real-time WebSocket telemetry works locally",
  "Human-review hold, resolve, and routing flow verified",
  "Correct and incorrect predictions are measured",
  "Random Forest and XGBoost candidate comparison verified",
  "100-label threshold and 25-label batch protection verified",
  "Artifact promotion, hot-loading, and cleanup verified",
];

export default function EvidenceSection() {
  return (
    <section
      id="evidence"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What is working today"
          title="A verified end-to-end MVP—not only a concept slide."
          description={
            <p>
              The latest local verification covers the frontend, backend,
              WebSocket simulation, model selection, human review, dataset
              tracking, retraining controls, and safe artifact promotion.
            </p>
          }
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {verified.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span className="text-sm leading-6 text-slate-300">{item}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Snapshot values such as row count and reviewed accuracy will change as
          more local transactions and honest reviews are collected.
        </p>
      </div>
    </section>
  );
}
