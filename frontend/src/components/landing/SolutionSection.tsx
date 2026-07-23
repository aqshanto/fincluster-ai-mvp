import {
  BrainCircuit,
  HeartPulse,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import FeatureCard from "@/components/landing/ui/FeatureCard";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const solutions = [
  {
    icon: BrainCircuit,
    title: "Workload-aware classification",
    description:
      "Incoming simulator transactions are classified as Heavy or Light with a local model, confidence score, and explainable evidence.",
    tone: "blue" as const,
  },
  {
    icon: Route,
    title: "Best-fit node selection",
    description:
      "Heavy verification uses capable compute; low-risk work follows the lower-cost fast path.",
    tone: "emerald" as const,
  },
  {
    icon: HeartPulse,
    title: "Health-aware fallback",
    description:
      "The scheduler avoids nodes that are hot, overloaded, crashed, or otherwise unsuitable.",
    tone: "rose" as const,
  },
  {
    icon: ShieldCheck,
    title: "Human-review protection",
    description:
      "Low-confidence, fallback, or manually flagged transactions pause until an operator decides Heavy or Light.",
    tone: "amber" as const,
  },
  {
    icon: TrendingUp,
    title: "Controlled improvement",
    description:
      "Verified labels can retrain multiple candidates, but a new model is promoted only after quality checks.",
    tone: "violet" as const,
  },
];

export default function SolutionSection() {
  return (
    <section
      id="solution"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What FinCluster changes"
          title="One lifecycle links AI decisions to infrastructure behavior and human accountability."
          description={
            <p>
              FinCluster does not stop at a Heavy or Light prediction. It shows
              how that result changes node choice, latency, cost, anomaly
              handling, human review, and future model evaluation.
            </p>
          }
          align="center"
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {solutions.map((solution) => (
            <FeatureCard key={solution.title} {...solution} />
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-4xl items-start gap-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <div>
            <p className="font-black text-white">
              The differentiator: prediction becomes an operational decision.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Many AI demos end after classification. FinCluster continues into
              routing, resilience, explainability, human override, measured
              feedback, and safe candidate-model promotion.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
