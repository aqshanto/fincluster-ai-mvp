import { Activity, ArrowRight, Smartphone } from "lucide-react";

import RouteButton from "@/components/landing/ui/RouteButton";

export default function FinalCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-blue-500/25 bg-slate-950 p-8 text-center shadow-2xl shadow-blue-950/30 sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_35%)]" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Experience the lifecycle
            </p>
            <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              See the complete decision journey—not just another AI prediction.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Explore how a transaction is classified, routed, reviewed,
              measured, and prepared for future model improvement.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <RouteButton
                href="/dashboard"
                icon={<Activity className="h-4 w-4" />}
              >
                Open live dashboard
              </RouteButton>
              <RouteButton
                href="/simulator"
                variant="secondary"
                icon={<Smartphone className="h-4 w-4" />}
              >
                Try transaction simulator
              </RouteButton>
              <RouteButton
                href="#problem"
                variant="ghost"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Review the problem
              </RouteButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
