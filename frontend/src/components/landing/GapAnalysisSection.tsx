import {
  AlertTriangle,
  BrainCircuit,
  CircleDollarSign,
  Gauge,
  Route,
  ThermometerSun,
} from "lucide-react";

import FeatureCard from "@/components/landing/ui/FeatureCard";
import LandingVisual from "@/components/landing/ui/LandingVisual";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const gaps = [
  {
    icon: Route,
    title: "Blind routing",
    description:
      "Round-robin selects the next node without understanding which workload that node is best equipped to process.",
    tone: "rose" as const,
  },
  {
    icon: Gauge,
    title: "Unequal workloads",
    description:
      "A balance inquiry and a high-risk cash-out should not consume the same verification path or compute budget.",
    tone: "amber" as const,
  },
  {
    icon: CircleDollarSign,
    title: "Infrastructure waste",
    description:
      "Powerful nodes can be wasted on simple tasks while cheaper resources remain underused.",
    tone: "rose" as const,
  },
  {
    icon: ThermometerSun,
    title: "Weak anomaly response",
    description:
      "Static routing may keep assigning work to overloaded, overheated, or unavailable infrastructure.",
    tone: "amber" as const,
  },
  {
    icon: BrainCircuit,
    title: "Unsupervised automation risk",
    description:
      "A model can be uncertain or wrong, yet an unguarded system may still execute its prediction automatically.",
    tone: "violet" as const,
  },
  {
    icon: AlertTriangle,
    title: "No trusted learning loop",
    description:
      "Without verified labels, a team cannot measure real mistakes or retrain safely from reliable evidence.",
    tone: "rose" as const,
  },
];

export default function GapAnalysisSection() {
  return (
    <section
      id="problem"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The real-world gap"
          title="Traditional routing can balance traffic and still make the wrong processing decision."
          description={
            <p>
              Existing systems often separate transaction analysis from
              infrastructure routing. FinCluster connects the two: what the
              transaction needs, which node can provide it, and when a human
              should intervene.
            </p>
          }
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gaps.map((gap) => (
            <FeatureCard key={gap.title} {...gap} />
          ))}
        </div>

        <LandingVisual
          src="/landing/legacy-vs-ai-routing.png"
          alt="Side-by-side comparison of legacy round-robin routing and FinCluster AI workload-aware routing"
          label="Legacy Routing vs FinCluster AI"
          tone="blue"
          caption="Both strategies receive the same workload. Legacy routing rotates blindly; FinCluster considers workload type, node capability, health, and fallback availability."
          className="mt-16"
        />
      </div>
    </section>
  );
}
