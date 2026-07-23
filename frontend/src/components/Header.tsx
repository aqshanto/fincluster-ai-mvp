import { Network } from "lucide-react";

import { TelemetryData } from "@/types";

interface HeaderProps {
  telemetry: TelemetryData | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

export default function Header({ telemetry, connectionStatus }: HeaderProps) {
  const uptime = telemetry ? telemetry.uptime.toFixed(2) : "100.00";
  const latency = telemetry ? Math.floor(telemetry.latency) : 5;
  const nodes = telemetry ? telemetry.active_nodes : "3/3";
  const time = telemetry ? telemetry.sim_time : "00:00:00";

  const connectionClass =
    connectionStatus === "connected"
      ? "bg-emerald-500"
      : connectionStatus === "connecting"
        ? "animate-pulse bg-amber-400"
        : "bg-red-500";

  return (
    <header className="glass-panel relative z-20 border-b border-slate-800/80">
      <div className="mx-auto w-full max-w-350 px-4 py-3 lg:flex lg:items-center lg:justify-between lg:px-8 lg:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10">
            <Network className="h-6 w-6 animate-pulse text-blue-500 lg:h-7 lg:w-7" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-wide text-white sm:text-xl">
              FinCluster AI
            </h1>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 sm:text-xs">
              <span>Team DIU_Gurte_Aisi</span>
              <span className="inline-flex items-center gap-1 font-mono uppercase">
                <span className={`h-2 w-2 rounded-full ${connectionClass}`} />
                {connectionStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-0 lg:flex lg:items-center lg:gap-6 xl:gap-9">
          <Metric
            label="System uptime"
            value={`${uptime}%`}
            className={
              Number(uptime) < 99 ? "text-red-500" : "text-emerald-400"
            }
          />
          <Divider />
          <Metric
            label="Avg latency"
            value={`${latency} ms`}
            className={latency > 150 ? "text-red-500" : "text-amber-400"}
          />
          <Divider />
          <Metric
            label="Active nodes"
            value={nodes}
            className="text-blue-400"
          />
          <Divider />
          <Metric label="Sim time" value={time} className="text-white" />
        </div>
      </div>
    </header>
  );
}

function Divider() {
  return <div className="hidden h-8 w-px bg-slate-700 lg:block" />;
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-left lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:text-center">
      <p className="text-[9px] uppercase tracking-wider text-slate-500 sm:text-[10px] lg:text-xs lg:text-slate-400">
        {label}
      </p>
      <p
        className={`metric-value mt-0.5 text-lg font-bold lg:text-2xl ${className}`}
      >
        {value}
      </p>
    </div>
  );
}
