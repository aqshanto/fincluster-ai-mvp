"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Flame,
  RefreshCw,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import axios from "axios";
import api from "@/services/api";
import { TelemetryData } from "@/types";
import Header from "@/components/Header";
import NodeCard from "@/components/NodeCard";
import CostChart from "@/components/CostChart";
import ControlPanel from "@/components/ControlPanel";
import SimulationCanvas from "@/components/SimulationCanvas";

export default function Home() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/telemetry";
    let websocket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let retryAttempt = 0;

    const connect = () => {
      if (stopped) return;
      setConnectionStatus("connecting");
      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        retryAttempt = 0;
        setConnectionStatus("connected");
      };

      websocket.onmessage = (event) => {
        try {
          setTelemetry(JSON.parse(event.data) as TelemetryData);
        } catch (caught) {
          console.error("Failed to parse telemetry data:", caught);
        }
      };

      websocket.onerror = () => websocket?.close();
      websocket.onclose = () => {
        if (stopped) return;
        setConnectionStatus("disconnected");
        const delay = Math.min(1000 * 2 ** retryAttempt, 10_000);
        retryAttempt += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      websocket?.close();
    };
  }, []);

  const emergencyAction = async (path: string, reset = false) => {
    try {
      if (reset) {
        window.dispatchEvent(new Event("force_reset_ui"));
      }
      await api.post(path);
      setRecoveryError("");
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        setRecoveryError(
          "Operator login is required. Use the login button in the control bar below.",
        );
      } else {
        setRecoveryError(
          "Recovery command failed. Check the backend connection.",
        );
      }
    }
  };

  return (
    <div className="relative h-screen w-screen flex flex-col justify-between overflow-hidden">
      <SimulationCanvas telemetry={telemetry} />
      <Header telemetry={telemetry} connectionStatus={connectionStatus} />

      {telemetry?.cluster_outage && (
        <div className="absolute inset-0 bg-red-950/70 backdrop-blur-md z-15 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900 border-2 border-red-500 p-7 rounded-2xl shadow-[0_0_60px_rgba(239,68,68,0.6)] text-center max-w-lg border-t-8 border-t-red-600 pointer-events-auto">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-red-500 tracking-wider uppercase mb-2">
              Critical Cluster Outage
            </h2>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Every node in the selected live-view cluster is unavailable.
              Crashed nodes continue cooling even if the anomaly switch remains
              enabled.
            </p>
            <div className="bg-red-950/90 border border-red-800 p-3 rounded-lg text-xs font-mono text-red-200 flex items-center justify-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
              <span>
                Self-healing cooldown is active until nodes fall below 50°C.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() =>
                  emergencyAction("/api/v1/control/trigger-anomaly")
                }
                className="bg-amber-700 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                Stop Anomaly
              </button>
              <button
                onClick={() => emergencyAction("/api/v1/control/reset", true)}
                className="bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Emergency Reset
              </button>
            </div>
            {recoveryError && (
              <p className="text-[11px] text-amber-300 mt-3">{recoveryError}</p>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 relative flex items-center w-full max-w-350 mx-auto px-8 z-10 pointer-events-none">
        <div className="w-87.5 flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-xl border-l-4 border-l-blue-500 pointer-events-auto shadow-lg">
            <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-400" />
              MFS Transaction Stream
            </h3>
            <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-slate-700">
              One seeded stream feeds both benchmark clusters
            </p>
            <div className="space-y-4">
              <TaskCount
                color="red"
                label="Heavy Tasks"
                detail="Deep fraud / enhanced verification"
                value={telemetry?.total_heavy ?? 0}
              />
              <TaskCount
                color="blue"
                label="Light Tasks"
                detail="Low-risk fast-path"
                value={telemetry?.total_light ?? 0}
              />
            </div>
          </div>

          <CostChart
            runId={telemetry?.run_id ?? 0}
            simTime={telemetry?.sim_time ?? "00:00:00"}
            legacyCost={telemetry?.legacy_cost ?? 0}
            optimizedCost={telemetry?.optimized_cost ?? 0}
            savedCost={telemetry?.saved_cost ?? 0}
            benchmark={telemetry?.benchmark}
          />
        </div>

        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
          {telemetry?.ai_decision && !telemetry.cluster_outage && (
            <div className="absolute bottom-[calc(100%+1.5rem)] w-[clamp(520px,46vw,760px)] rounded-xl border border-blue-500/50 bg-blue-950/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="relative mt-1.5 h-3 w-3 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-blue-400/50 animate-ping" />
                  <div className="absolute inset-0 rounded-full bg-blue-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                    Decision Log
                  </p>

                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word pr-1 font-mono text-[11px] leading-5 text-blue-100">
                    {telemetry.ai_decision}
                  </p>
                </div>
              </div>
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
              className={`w-10 h-10 ${
                telemetry?.ai_enabled
                  ? "text-blue-500 animate-pulse"
                  : "text-slate-500"
              }`}
            />
          </div>
          <div className="glass-panel mt-6 px-4 py-2 rounded-lg text-center border border-slate-700 shadow-xl">
            <p
              className={`text-sm font-bold tracking-widest ${
                telemetry?.ai_enabled ? "text-blue-400" : "text-slate-400"
              }`}
            >
              {telemetry?.ai_enabled ? "AI LIVE VIEW" : "LEGACY LIVE VIEW"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Both strategies process the same workload
            </p>
          </div>
        </div>

        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-6">
          {telemetry?.nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          )) ||
            [0, 1, 2].map((index) => (
              <div
                key={index}
                className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 w-75 h-27.5 animate-pulse"
              />
            ))}
        </div>
      </main>

      <ControlPanel
        aiEnabled={telemetry?.ai_enabled ?? true}
        surgeActive={telemetry?.surge_active ?? false}
        anomalyActive={telemetry?.anomaly_active ?? false}
        externalAIEnabled={telemetry?.ai_runtime.external_ai_enabled ?? false}
        externalAIAvailable={
          telemetry?.ai_runtime.external_ai_available ?? false
        }
        externalModel={telemetry?.ai_runtime.external_model ?? "Gemini"}
        datasetRows={telemetry?.dataset.rows ?? 0}
        pendingReviewCount={telemetry?.dataset.pending_reviews ?? 0}
      />
    </div>
  );
}

function TaskCount({
  color,
  label,
  detail,
  value,
}: {
  color: "red" | "blue";
  label: string;
  detail: string;
  value: number;
}) {
  const dotClass =
    color === "red"
      ? "bg-red-500 shadow-[0_0_8px_#ef4444]"
      : "bg-blue-500 shadow-[0_0_8px_#3b82f6]";
  const textClass = color === "red" ? "text-red-400" : "text-blue-400";

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center">
        <span className={`w-3 h-3 rounded-full mr-3 ${dotClass}`} />
        <div>
          <p className="text-sm text-slate-200 leading-tight">{label}</p>
          <p className="text-[10px] text-slate-500">{detail}</p>
        </div>
      </div>
      <span className={`${textClass} font-mono text-sm font-bold`}>
        {value}
      </span>
    </div>
  );
}
