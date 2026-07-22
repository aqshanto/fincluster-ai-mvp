import { AlertTriangle, ArrowRight, Wrench } from "lucide-react";

import SectionHeading from "@/components/landing/ui/SectionHeading";

const limitations = [
  "Initial training labels are synthetic.",
  "The genuine human-reviewed dataset is still small.",
  "Current features are limited to simulator metadata.",
  "SQLite needs durable storage for reliable cloud persistence.",
  "Shared global simulation state is an MVP simplification.",
  "Current authentication is not production banking security.",
  "Real fraud labels require institutional data and expert review.",
  "Fairness, drift, calibration, and adversarial testing remain future work.",
  "Controlled near-perfect metrics do not represent real-world accuracy.",
];

const roadmap = [
  "Collect a larger expert-reviewed MFS dataset.",
  "Move persistent data to PostgreSQL or a managed durable store.",
  "Add model and dataset version registry with rollback history.",
  "Measure drift, probability calibration, and threshold stability.",
  "Expand ISO-style behavioral and transaction features.",
  "Add stronger audit trails, roles, and access controls.",
  "Support isolated simulation rooms for multiple users.",
  "Evaluate additional models only when data volume justifies them.",
];

export default function LimitationsSection() {
  return (
    <section id="limitations" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Honest scope"
          title="What the MVP proves—and what it does not claim."
          description={
            <p>
              Clear limitations make the project more credible. FinCluster is a
              technically working simulator and AI lifecycle demonstration, not
              a replacement for a production financial switch today.
            </p>
          }
          align="center"
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-300" />
              <h3 className="text-xl font-black text-white">Current limitations</h3>
            </div>
            <ul className="mt-5 space-y-3">
              {limitations.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-400">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6 text-emerald-300" />
              <h3 className="text-xl font-black text-white">Planned improvements</h3>
            </div>
            <ul className="mt-5 space-y-3">
              {roadmap.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-400">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
