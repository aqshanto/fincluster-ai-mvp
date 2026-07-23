import {
  Activity,
  BarChart3,
  Send,
  UserCheck,
} from "lucide-react";

import RouteButton from "@/components/landing/ui/RouteButton";
import SectionHeading from "@/components/landing/ui/SectionHeading";

const steps = [
  {
    number: "1",
    icon: Activity,
    title: "Show the live benchmark",
    description:
      "Open the dashboard and explain that AI and legacy routing receive the same seeded workload.",
    action: "Trigger a surge or Node 1 anomaly to demonstrate health-aware fallback.",
  },
  {
    number: "2",
    icon: Send,
    title: "Inject a manual transaction",
    description:
      "Use the simulator to submit realistic MFS metadata and show the workload, confidence, evidence, and route.",
    action: "Try one clear transaction and one forced-review transaction.",
  },
  {
    number: "3",
    icon: UserCheck,
    title: "Resolve the human review",
    description:
      "Open the review queue, confirm or correct Heavy/Light, and show that routing occurs only after the decision.",
    action: "Point out that the verified label is stored for later evaluation.",
  },
  {
    number: "4",
    icon: BarChart3,
    title: "Close with evidence and limits",
    description:
      "Show the reviewed counters, candidate-model metrics, controlled retraining result, and honest limitations.",
    action: "Emphasize that synthetic test metrics are not production claims.",
  },
];

export default function JudgeDemoSection() {
  return (
    <section
      id="demo"
      className="scroll-mt-24 border-b border-slate-800/70 py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Recommended judge walkthrough"
          title="Explain the entire project in one focused 3-minute demo."
          description={
            <p>
              The sequence below moves from the operational problem to a live
              AI decision, human safety control, measured feedback, and the
              roadmap toward a production-grade system.
            </p>
          }
          align="center"
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {steps.map(({ number, icon: Icon, title, description, action }) => (
            <article
              key={number}
              className="rounded-2xl border border-slate-800 bg-slate-950/75 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 font-mono text-sm font-black text-blue-300">
                  {number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <h3 className="font-black text-white">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {description}
                  </p>
                  <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs leading-5 text-slate-500">
                    <span className="font-bold text-slate-300">Demo action:</span>{" "}
                    {action}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <RouteButton href="/dashboard" icon={<Activity className="h-4 w-4" />}>
            Start with the dashboard
          </RouteButton>
          <RouteButton
            href="/simulator"
            variant="secondary"
            icon={<Send className="h-4 w-4" />}
          >
            Open the simulator
          </RouteButton>
        </div>
      </div>
    </section>
  );
}
