import { AlertTriangle, ArrowRight, Wrench } from "lucide-react";

import SectionHeading from "@/components/landing/ui/SectionHeading";

const limitations = [
  "The bootstrap model is trained on seeded synthetic workload labels.",
  "Only six genuine operator reviews exist in the current local snapshot.",
  "The feature set represents simulator metadata, not full institutional MFS history.",
  "SQLite, shared simulation state, and simple operator authentication are MVP choices.",
  "Production deployment would require durable storage, stronger security, audit controls, and scale testing.",
  "Fairness, calibration, drift, adversarial behavior, and real fraud outcomes have not yet been validated.",
];

const roadmap = [
  "Collect a larger expert-reviewed and class-balanced MFS dataset.",
  "Move persistence to PostgreSQL or a managed durable data service.",
  "Add model and dataset versioning, rollback, and approval history.",
  "Measure drift, calibration, fairness, and threshold stability.",
  "Expand behavioral, device, velocity, and ISO-style transaction features.",
  "Add role-based access, stronger audit trails, isolated sessions, and load testing.",
];

export default function LimitationsSection() {
  return (
    <section
      id="limitations"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Honest scope"
          title="What this MVP proves—and what still separates it from a production financial switch."
          description={
            <p>
              FinCluster proves the architecture and interaction between local
              AI, routing, node health, human review, and controlled retraining.
              It does not claim bank-grade accuracy, security, scale, or
              regulatory readiness today.
            </p>
          }
          align="center"
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-300" />
              <h3 className="text-xl font-black text-white">
                Current limitations
              </h3>
            </div>
            <ul className="mt-5 space-y-3">
              {limitations.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-6 text-slate-400"
                >
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-rose-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6 text-emerald-300" />
              <h3 className="text-xl font-black text-white">
                Path to the next version
              </h3>
            </div>
            <ul className="mt-5 space-y-3">
              {roadmap.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm leading-6 text-slate-400"
                >
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
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
