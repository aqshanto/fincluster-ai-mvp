import React from "react";
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
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500";

  return (
    <header className="glass-panel px-6 py-4 flex justify-between items-center z-20 pointer-events-auto">
      <div className="flex items-center gap-3">
        <Network className="w-8 h-8 text-blue-500 animate-pulse" />
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            FinCluster AI
          </h1>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            Phase 1 MVP | Team DIU_Gurte_Aisi
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase">
              <span className={`w-2 h-2 rounded-full ${connectionClass}`} />
              {connectionStatus}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-10 items-center">
        <Metric
          label="System Uptime"
          value={`${uptime}%`}
          className={Number(uptime) < 99 ? "text-red-500" : "text-emerald-400"}
        />
        <Divider />
        <Metric
          label="Avg Latency"
          value={`${latency} ms`}
          className={latency > 150 ? "text-red-500" : "text-amber-400"}
        />
        <Divider />
        <Metric label="Active Nodes" value={nodes} className="text-blue-400" />
        <Divider />
        <Metric label="Sim Time" value={time} className="text-white" />
      </div>
    </header>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-slate-700" />;
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
    <div className="text-center">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold metric-value ${className}`}>{value}</p>
    </div>
  );
}
