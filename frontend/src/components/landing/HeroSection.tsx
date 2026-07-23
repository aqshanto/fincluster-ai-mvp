import {
  ArrowRight,
  BrainCircuit,
  CircleDollarSign,
  Cpu,
  Landmark,
  Network,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";

import LandingVisual from "@/components/landing/ui/LandingVisual";
import RouteButton from "@/components/landing/ui/RouteButton";

const badges = [
  "Local-first AI",
  "Human-controlled decisions",
  "Explainable routing",
  "Fair AI vs legacy benchmark",
  "Anomaly-aware fallback",
];

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative scroll-mt-24 overflow-hidden border-b border-slate-800/70"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.11),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.18)_1px,transparent_1px)] bg-size-[42px_42px] mask-[linear-gradient(to_bottom,black,transparent_90%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:min-h-160 lg:grid-cols-[1.04fr_0.96fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 sm:text-xs">
              <Zap className="h-3.5 w-3.5" />
              Working MFS routing and AI-governance simulator
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Smarter MFS routing.
              <span className="block bg-linear-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                Safer decisions.
              </span>
              <span className="block bg-linear-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent sm:hidden">
                Lower cost.
              </span>
              <span className="hidden bg-linear-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent sm:block">
                Lower infrastructure cost.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              FinCluster AI is a working Mobile Financial Services simulator. It
              classifies Heavy and Light processing workloads, checks node
              health, compares AI routing with legacy round-robin on the same
              traffic, and pauses uncertain decisions for human review.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <RouteButton
                href="/dashboard"
                icon={<Network className="h-4 w-4" />}
              >
                Open live dashboard
              </RouteButton>

              <RouteButton
                href="/simulator"
                variant="secondary"
                icon={<Smartphone className="h-4 w-4" />}
              >
                Try a transaction
              </RouteButton>

              <RouteButton
                href="#demo"
                variant="ghost"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Follow the judge demo
              </RouteButton>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-[11px] font-semibold text-slate-400"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950/90 p-5 shadow-2xl shadow-blue-950/40">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Live decision path
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    One transaction, two routing strategies
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                  ONLINE
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">MFS transaction</p>
                      <p className="text-xs text-slate-500">
                        Amount, type, MCC, account age, VPN
                      </p>
                    </div>
                  </div>
                </div>

                <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-slate-600 sm:rotate-0" />

                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Local AI analysis</p>
                      <p className="text-xs text-slate-500">
                        Workload probability + confidence
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Low confidence? Hold the transaction for review.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      The operator confirms or corrects the processing workload
                      before the transaction is routed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: Cpu,
                    title: "Heavy GPU",
                    note: "Enhanced verification",
                    tone: "text-rose-300 border-rose-500/25 bg-rose-500/5",
                  },
                  {
                    icon: ServerCog,
                    title: "Light CPU",
                    note: "Low-risk fast path",
                    tone: "text-blue-300 border-blue-500/25 bg-blue-500/5",
                  },
                  {
                    icon: CircleDollarSign,
                    title: "Scaler",
                    note: "Burst or fallback capacity",
                    tone: "text-emerald-300 border-emerald-500/25 bg-emerald-500/5",
                  },
                ].map(({ icon: Icon, title, note, tone }) => (
                  <div key={title} className={`rounded-xl border p-3 ${tone}`}>
                    <Icon className="h-4 w-4" />
                    <p className="mt-3 text-xs font-bold text-white">{title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    AI and legacy receive the same seeded workload
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  FAIR BENCHMARK
                </span>
              </div>
            </div>
          </div>
        </div>

        <LandingVisual
          src="/landing/hero-fincluster-overview.png"
          alt="FinCluster AI overview showing mobile financial transactions entering an AI engine and being routed to GPU, CPU, scaler, or human review"
          label="FinCluster System Overview"
          tone="cyan"
          caption="A single explainable lifecycle connects workload classification, health-aware routing, human review, and controlled model improvement."
          priority
          aspectClassName="aspect-[3/2]"
          className="mt-14"
        />
      </div>
    </section>
  );
}
