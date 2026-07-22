import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Database,
  PauseCircle,
  UserCheck,
} from "lucide-react";

import LandingVisual from "@/components/landing/ui/LandingVisual";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const stages = [
  {
    icon: BrainCircuit,
    title: "Model prediction",
    note: "Heavy or Light + confidence",
  },
  {
    icon: PauseCircle,
    title: "Review gate",
    note: "Low confidence, fallback, or forced review",
  },
  {
    icon: UserCheck,
    title: "Operator decision",
    note: "Confirm or correct the workload",
  },
  {
    icon: BadgeCheck,
    title: "Final route",
    note: "The reviewed decision selects the node",
  },
  {
    icon: Database,
    title: "Trusted label",
    note: "Prediction correctness is measured and stored",
  },
];

export default function HumanReviewSection() {
  return (
    <section id="human-review" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Human-in-the-loop protection"
          title="AI assists the operator—it does not silently replace the operator."
          description={
            <p>
              A model with 87% accuracy cannot identify its own incorrect 13% at
              prediction time. FinCluster therefore marks uncertain cases as
              <strong className="font-bold text-amber-200">
                {" "}
                pending review
              </strong>{" "}
              instead of pretending they are known failures.
            </p>
          }
        />

        <div className="mt-12 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-center">
          {stages.map(({ icon: Icon, title, note }, index) => (
            <div key={title} className="contents">
              <article className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                <Icon className="h-5 w-5 text-amber-300" />

                <p className="mt-3 text-sm font-bold text-white">{title}</p>

                <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
              </article>

              {index < stages.length - 1 && (
                <ArrowRight className="mx-auto hidden h-5 w-5 text-slate-600 xl:block" />
              )}
            </div>
          ))}
        </div>

        <LandingVisual
          src="/landing/human-review-lifecycle.png"
          alt="FinCluster AI human-review lifecycle for low-confidence, fallback, or manually flagged transaction decisions"
          label="Human Review Safety Layer"
          tone="amber"
          caption="Uncertain transactions are held instead of being trusted automatically. An operator confirms or corrects the workload, safely routes the transaction, and stores a verified label."
          className="mt-16"
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-sm font-black text-emerald-200">
              What the system measures after review
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>• Reviewed transaction count</li>
              <li>• Correct and incorrect predictions</li>
              <li>• Reviewed accuracy</li>
              <li>• Pending-review count</li>
              <li>• Reviewer identity and final route</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
            <p className="text-sm font-black text-rose-200">
              What the system refuses to do
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>
                • It does not label uncertain predictions as known failures.
              </li>
              <li>• It does not retrain from its own unverified guesses.</li>
              <li>
                • It does not route a held transaction before operator review.
              </li>
              <li>
                • It does not promote a candidate that fails quality gates.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
