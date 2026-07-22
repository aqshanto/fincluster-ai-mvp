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
      "Round-robin sends work to the next node without understanding transaction complexity or node capability.",
    tone: "rose" as const,
  },
  {
    icon: Gauge,
    title: "Unequal workloads",
    description:
      "A balance inquiry and a suspicious high-value cash-out should not consume the same processing path.",
    tone: "amber" as const,
  },
  {
    icon: CircleDollarSign,
    title: "Infrastructure waste",
    description:
      "Expensive compute can be wasted on low-risk tasks while lower-cost nodes remain underused.",
    tone: "rose" as const,
  },
  {
    icon: ThermometerSun,
    title: "Weak anomaly response",
    description:
      "Static routing may continue assigning work to overloaded, overheated, or unhealthy infrastructure.",
    tone: "amber" as const,
  },
  {
    icon: BrainCircuit,
    title: "Unsafe AI automation",
    description:
      "A model can be uncertain or wrong, yet a fully automatic system may still act without human verification.",
    tone: "violet" as const,
  },
  {
    icon: AlertTriangle,
    title: "Limited learning",
    description:
      "Without reviewed labels, a system cannot measure real mistakes or improve in a controlled way.",
    tone: "rose" as const,
  },
];

export default function GapAnalysisSection() {
  return (
    <section id="problem" className="border-b border-slate-800/70 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Real-life gap analysis"
          title="The problem is not only fraud detection. It is deciding how every transaction should be processed."
          description={
            <p>
              Traditional routing can distribute traffic evenly while still
              making poor decisions. FinCluster focuses on the missing link
              between transaction intelligence and infrastructure behavior.
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
          caption="Both strategies receive the same workload. Legacy routing rotates blindly, while FinCluster evaluates workload complexity, node capability, health, and fallback availability."
          className="mt-16"
        />
      </div>
    </section>
  );
}
