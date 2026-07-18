"use client";
import React, { useEffect, useState } from "react";
import { Cpu, Smartphone, AlertTriangle, RefreshCw } from "lucide-react";
import { TelemetryData } from "@/types";
import Header from "@/components/Header";
import NodeCard from "@/components/NodeCard";
import CostChart from "@/components/CostChart";
import ControlPanel from "@/components/ControlPanel";
import SimulationCanvas from "@/components/SimulationCanvas";

export default function Home() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/telemetry";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data: TelemetryData = JSON.parse(event.data);
      setTelemetry(data);
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    return () => ws.close();
  }, []);

  return (
    <div className="relative h-screen w-screen flex flex-col justify-between overflow-hidden">
      <SimulationCanvas telemetry={telemetry} />
      <Header telemetry={telemetry} />

      {/* ⚠️ CRITICAL CLUSTER OUTAGE OVERLAY BANNER */}
      {telemetry?.cluster_outage && (
        <div className="absolute inset-0 bg-red-950/70 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in pointer-events-auto">
          <div className="bg-slate-900 border-2 border-red-500 p-8 rounded-2xl shadow-[0_0_60px_rgba(239,68,68,0.6)] text-center max-w-lg border-t-8 border-t-red-600 animate-pulse">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500 shadow-inner">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-red-500 tracking-wider uppercase mb-2">
              Critical Cluster Outage!
            </h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              All processing nodes have{" "}
              <span className="text-red-400 font-bold underline">CRASHED</span>{" "}
              due to extreme thermal overload (Over 95°C). Transaction routing
              is automatically suspended to prevent data corruption.
            </p>
            <div className="bg-red-950/90 border border-red-800 p-3.5 rounded-lg text-xs font-mono text-red-200 flex items-center justify-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
              <span>
                Automated Self-Healing: Waiting for nodes to cool below 50°C...
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 relative flex items-center w-full max-w-350 mx-auto px-8 z-10 pointer-events-none">
        <div className="w-87.5 flex flex-col gap-6">
          <div className="glass-panel p-5 rounded-xl border-l-4 border-l-blue-500 pointer-events-auto shadow-lg">
            <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>MFS App Users</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-700">
              Live transaction simulator
            </p>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] mr-3"></span>
                  <div>
                    <p className="text-sm text-slate-200 leading-tight">
                      Heavy Tasks
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Fraud Check / 50k Cashout
                    </p>
                  </div>
                </div>
                <span className="text-red-400 font-mono text-sm font-bold">
                  {telemetry?.total_heavy || 0}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] mr-3"></span>
                  <div>
                    <p className="text-sm text-slate-200 leading-tight">
                      Light Tasks
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Balance / Small Send
                    </p>
                  </div>
                </div>
                <span className="text-blue-400 font-mono text-sm font-bold">
                  {telemetry?.total_light || 0}
                </span>
              </div>
            </div>
          </div>

          <CostChart
            simTime={telemetry?.sim_time || "00:00:00"}
            savedCost={telemetry?.saved_cost || 0}
          />
        </div>

        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
          {/* Fixed line below: replaced 'not' with '!' */}
          {telemetry?.ai_decision && !telemetry?.cluster_outage && (
            <div className="absolute -top-16 w-137.5 bg-blue-950/90 border border-blue-500/50 p-2.5 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0"></div>
              <p className="text-[11px] text-blue-200 font-mono leading-relaxed truncate">
                <span className="font-bold text-white uppercase">AI Log: </span>
                {telemetry.ai_decision}
              </p>
            </div>
          )}

          <div
            className={`w-20 h-20 rounded-full bg-slate-900 border-2 flex items-center justify-center transition-all duration-300 shadow-2xl ${
              telemetry?.ai_enabled
                ? "border-blue-500 shadow-blue-500/50 scale-105"
                : "border-slate-600 shadow-slate-700/50 opacity-80"
            }`}
          >
            <Cpu
              className={`w-10 h-10 transition-colors duration-300 ${telemetry?.ai_enabled ? "text-blue-500 animate-pulse" : "text-slate-500"}`}
            />
          </div>
          <div className="glass-panel mt-6 px-4 py-2 rounded-lg text-center border border-slate-700 shadow-xl">
            <p
              className={`text-sm font-bold tracking-widest ${telemetry?.ai_enabled ? "text-blue-400" : "text-slate-400"}`}
            >
              {telemetry?.ai_enabled
                ? "AI SMART SCHEDULING"
                : "BLIND ROUND-ROBIN"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {telemetry?.ai_enabled
                ? "Routing by task complexity"
                : "Ignores complexity & node health"}
            </p>
          </div>
        </div>

        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-6">
          {telemetry?.nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          )) ||
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 w-75 h-27.5 animate-pulse"
              ></div>
            ))}
        </div>
      </main>

      <ControlPanel
        aiEnabled={telemetry?.ai_enabled || true}
        surgeActive={telemetry?.surge_active || false}
        anomalyActive={telemetry?.anomaly_active || false}
      />
    </div>
  );
}
