import React from "react";
import { Network } from "lucide-react";
import { TelemetryData } from "@/types";

interface HeaderProps {
  telemetry: TelemetryData | null;
}

export default function Header({ telemetry }: HeaderProps) {
  const uptime = telemetry ? telemetry.uptime.toFixed(2) : "100.00";
  const latency = telemetry ? Math.floor(telemetry.latency) : 5;
  const nodes = telemetry ? telemetry.active_nodes : "3/3";
  const time = telemetry ? telemetry.sim_time : "00:00:00";

  return (
    <header className="glass-panel px-6 py-4 flex justify-between items-center z-20 pointer-events-auto">
      <div className="flex items-center gap-3">
        <Network className="w-8 h-8 text-blue-500 animate-pulse" />
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            FinCluster AI
          </h1>
          <p className="text-xs text-slate-400">
            Phase 1 MVP | Team DIU_Gurte_Aisi
          </p>
        </div>
      </div>

      <div className="flex gap-10 items-center">
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            System Uptime
          </p>
          <p
            className={`text-2xl font-bold metric-value ${Number(uptime) < 99 ? "text-red-500" : "text-emerald-400"}`}
          >
            {uptime}%
          </p>
        </div>
        <div className="w-px h-8 bg-slate-700"></div>
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            Avg Latency
          </p>
          <p
            className={`text-2xl font-bold metric-value ${latency > 150 ? "text-red-500" : "text-amber-400"}`}
          >
            {latency} ms
          </p>
        </div>
        <div className="w-px h-8 bg-slate-700"></div>
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            Active Nodes
          </p>
          <p className="text-2xl font-bold text-blue-400 metric-value">
            {nodes}
          </p>
        </div>
        <div className="w-px h-8 bg-slate-700"></div>
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            Sim Time
          </p>
          <p className="text-2xl font-bold text-white metric-value">{time}</p>
        </div>
      </div>
    </header>
  );
}
