import {
  BrainCircuit,
  HeartPulse,
  Route,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import FeatureCard from "@/components/landing/ui/FeatureCard";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const solutions = [
  {
    icon: BrainCircuit,
    title: "Workload-aware classification",
    description:
      "Manual transactions are classified as Heavy or Light using a local machine-learning model with explainable evidence.",
    tone: "blue" as const,
  },
  {
    icon: Route,
    title: "Intelligent node selection",
    description:
      "Heavy verification tasks go to capable nodes while low-risk tasks use lower-cost compute resources.",
    tone: "emerald" as const,
  },
  {
    icon: HeartPulse,
    title: "Health-aware fallback",
    description:
      "When a preferred node is hot, overloaded, or unavailable, the scheduler selects a safer fallback route.",
    tone: "rose" as const,
  },
  {
    icon: ShieldCheck,
    title: "Human-review protection",
    description:
      "Low-confidence, fallback, or manually flagged transactions are held until an operator confirms Heavy or Light.",
    tone: "amber" as const,
  },
  {
    icon: TrendingUp,
    title: "Controlled retraining",
    description:
      "Trusted reviewed labels support model improvement, but promotion happens only after validation and quality gates.",
    tone: "violet" as const,
  },
];

export default function SolutionSection() {
  return (
    <section id="solution" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What FinCluster fixes"
          title="One system connecting AI classification, resource-aware routing, human control, and continuous improvement."
          description={
            <p>
              The MVP does more than output a prediction. It shows how that
              prediction changes node selection, latency, cost, resilience, and
              operator oversight in real time.
            </p>
          }
          align="center"
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {solutions.map((solution) => (
            <FeatureCard key={solution.title} {...solution} />
          ))}
        </div>
      </div>
    </section>
  );
}
