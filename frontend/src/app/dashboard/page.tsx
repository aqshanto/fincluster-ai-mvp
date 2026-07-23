"use client";

import { type ReactNode, useEffect, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  ArrowDown,
  BrainCircuit,
  Cpu,
  Flame,
  RefreshCw,
  RotateCcw,
  Server,
  Smartphone,
} from "lucide-react";

import AIIntelligenceModal from "@/components/AIIntelligenceModal";
import AIStatusBanner, {
  type AIStatusBannerData,
} from "@/components/AIStatusBanner";
import ControlPanel from "@/components/ControlPanel";
import CostChart from "@/components/CostChart";
import Header from "@/components/Header";
import NodeCard from "@/components/NodeCard";
import SimulationCanvas from "@/components/SimulationCanvas";
import api from "@/services/api";
import type { TelemetryData } from "@/types";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export default function DashboardPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatusBannerData | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [showAIIntelligence, setShowAIIntelligence] = useState(false);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/telemetry";

    let websocket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let retryAttempt = 0;

    const connect = () => {
      if (stopped) {
        return;
      }

      setConnectionStatus("connecting");

      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        retryAttempt = 0;
        setConnectionStatus("connected");
      };

      websocket.onmessage = (event) => {
        try {
          const nextTelemetry = JSON.parse(event.data) as TelemetryData;

          setTelemetry(nextTelemetry);
        } catch (caught) {
          console.error("Failed to parse telemetry data:", caught);
        }
      };

      websocket.onerror = () => {
        websocket?.close();
      };

      websocket.onclose = () => {
        if (stopped) {
          return;
        }

        setConnectionStatus("disconnected");

        const retryDelay = Math.min(1000 * 2 ** retryAttempt, 10_000);

        retryAttempt += 1;
        retryTimer = setTimeout(connect, retryDelay);
      };
    };

    connect();

    return () => {
      stopped = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      websocket?.close();
    };
  }, []);

  useEffect(() => {
    let stopped = false;

    const loadAIStatus = async () => {
      try {
        const response = await api.get<AIStatusBannerData>("/api/v1/ai/status");

        if (!stopped) {
          setAIStatus(response.data);
        }
      } catch (caught) {
        if (!stopped) {
          console.error("Failed to load AI intelligence status:", caught);
        }
      }
    };

    void loadAIStatus();

    const interval = window.setInterval(() => {
      void loadAIStatus();
    }, 10_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
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

        return;
      }

      setRecoveryError(
        "Recovery command failed. Check the backend connection.",
      );
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050b18] lg:h-screen lg:overflow-hidden">
      <Header telemetry={telemetry} connectionStatus={connectionStatus} />

      <AIStatusBanner
        status={aiStatus}
        onOpenDetails={() => setShowAIIntelligence(true)}
      />

      <DesktopDecisionLog telemetry={telemetry} />

      <AIIntelligenceModal
        open={showAIIntelligence}
        onClose={() => setShowAIIntelligence(false)}
      />

      {telemetry?.cluster_outage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-red-950/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border-2 border-red-500 border-t-8 border-t-red-600 bg-slate-900 p-5 text-center shadow-[0_0_60px_rgba(239,68,68,0.6)] sm:p-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500 bg-red-600/20">
              <AlertTriangle className="h-8 w-8 animate-bounce text-red-500" />
            </div>

            <h2 className="mb-2 text-xl font-black uppercase tracking-wider text-red-500 sm:text-2xl">
              Critical Cluster Outage
            </h2>

            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              Every node in the selected live-view cluster is unavailable.
              Crashed nodes continue cooling even if the anomaly switch remains
              enabled.
            </p>

            <div className="flex items-center justify-center gap-3 rounded-lg border border-red-800 bg-red-950/90 p-3 font-mono text-xs text-red-200">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-red-400" />

              <span>
                Self-healing cooldown is active until nodes fall below 50°C.
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  void emergencyAction("/api/v1/control/trigger-anomaly")
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-700 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
              >
                <Flame className="h-4 w-4" />
                Stop Anomaly
              </button>

              <button
                type="button"
                onClick={() =>
                  void emergencyAction("/api/v1/control/reset", true)
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-red-700 py-2 text-xs font-bold text-white transition hover:bg-red-600"
              >
                <RotateCcw className="h-4 w-4" />
                Emergency Reset
              </button>
            </div>

            {recoveryError && (
              <p className="mt-3 text-[11px] text-amber-300">{recoveryError}</p>
            )}
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-350 flex-1 px-3 py-4 sm:px-4 lg:min-h-0 lg:px-8 lg:py-3">
        <MobileDashboard
          telemetry={telemetry}
          onOpenModel={() => setShowAIIntelligence(true)}
        />

        <DesktopRoutingStage
          telemetry={telemetry}
          onOpenModel={() => setShowAIIntelligence(true)}
        />
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

function DesktopDecisionLog({
  telemetry,
}: {
  telemetry: TelemetryData | null;
}) {
  if (!telemetry?.ai_decision || telemetry.cluster_outage) {
    return null;
  }

  return (
    <section className="relative z-20 mx-auto hidden w-full max-w-350 px-8 pt-2 lg:block">
      <div className="rounded-xl border border-blue-500/45 bg-blue-950/90 px-4 py-2.5 shadow-lg shadow-blue-950/30 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="relative mt-1.5 h-3 w-3 shrink-0">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/50" />
            <div className="absolute inset-0 rounded-full bg-blue-400" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
              Decision Log
            </p>

            <p className="mt-1 max-h-16 overflow-y-auto whitespace-pre-wrap wrap-break-word pr-1 font-mono text-[11px] leading-5 text-blue-100">
              {telemetry.ai_decision}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileDashboard({
  telemetry,
  onOpenModel,
}: {
  telemetry: TelemetryData | null;
  onOpenModel: () => void;
}) {
  return (
    <div className="space-y-4 lg:hidden">
      <TransactionStreamCard telemetry={telemetry} onOpenModel={onOpenModel} />

      <MobileRoutingSimulation telemetry={telemetry} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
              Live infrastructure
            </p>

            <h2 className="mt-1 text-lg font-bold text-white">Cluster nodes</h2>
          </div>

          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] font-bold text-slate-400">
            {telemetry?.active_nodes ?? "0/3"} active
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {telemetry?.nodes
            ? telemetry.nodes.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))
            : [0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900/50"
                />
              ))}
        </div>
      </section>

      <CostChart
        runId={telemetry?.run_id ?? 0}
        simTime={telemetry?.sim_time ?? "00:00:00"}
        legacyCost={telemetry?.legacy_cost ?? 0}
        optimizedCost={telemetry?.optimized_cost ?? 0}
        savedCost={telemetry?.saved_cost ?? 0}
        benchmark={telemetry?.benchmark}
      />
    </div>
  );
}

function DesktopRoutingStage({
  telemetry,
  onOpenModel,
}: {
  telemetry: TelemetryData | null;
  onOpenModel: () => void;
}) {
  return (
    <div className="relative hidden h-full min-h-0 overflow-hidden lg:block">
      <SimulationCanvas telemetry={telemetry} />

      <div className="relative z-10 grid h-full min-h-0 grid-cols-[minmax(280px,350px)_minmax(260px,1fr)_minmax(260px,300px)] gap-5">
        <div className="flex min-h-0 flex-col justify-center gap-4 overflow-y-auto py-2">
          <div data-routing-source>
            <TransactionStreamCard
              telemetry={telemetry}
              onOpenModel={onOpenModel}
            />
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

        <DesktopRoutingSimulation telemetry={telemetry} />

        <div className="flex min-h-0 flex-col justify-center gap-4 overflow-y-auto py-2">
          {telemetry?.nodes
            ? telemetry.nodes.map((node, index) => (
                <div
                  key={node.id}
                  data-routing-node={index}
                  className="shrink-0"
                >
                  <NodeCard node={node} />
                </div>
              ))
            : [0, 1, 2].map((index) => (
                <div key={index} data-routing-node={index} className="shrink-0">
                  <div className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/50" />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

function TransactionStreamCard({
  telemetry,
  onOpenModel,
}: {
  telemetry: TelemetryData | null;
  onOpenModel: () => void;
}) {
  return (
    <section className="glass-panel pointer-events-auto rounded-xl border-l-4 border-l-blue-500 p-4 shadow-lg sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base lg:text-sm">
          <Smartphone className="h-4 w-4 text-slate-400" />
          MFS Transaction Stream
        </h2>

        <button
          type="button"
          onClick={onOpenModel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 hover:text-white"
          aria-label="Open AI model intelligence"
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          AI Model
        </button>
      </div>

      <p className="mb-4 border-b border-slate-700 pb-3 text-xs text-slate-400">
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
    </section>
  );
}

function MobileRoutingSimulation({
  telemetry,
}: {
  telemetry: TelemetryData | null;
}) {
  const aiEnabled = telemetry?.ai_enabled ?? true;

  return (
    <section className="glass-panel overflow-hidden rounded-2xl border border-blue-500/25 bg-slate-950/80 p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Live routing simulation
          </p>

          <h2 className="mt-1 text-lg font-bold text-white">
            {aiEnabled ? "AI Scheduler" : "Legacy Round-Robin"}
          </h2>
        </div>

        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <FlowNode
          icon={<Smartphone className="h-5 w-5" />}
          title="Transaction"
          note="MFS workload"
        />

        <div className="flex flex-col items-center gap-1 text-blue-400">
          <span className="h-2 w-2 animate-ping rounded-full bg-blue-400" />
          <ArrowDown className="h-4 w-4 -rotate-90" />
        </div>

        <FlowNode
          icon={<BrainCircuit className="h-5 w-5" />}
          title={aiEnabled ? "AI decision" : "Round-robin"}
          note={aiEnabled ? "Classify + route" : "Rotate blindly"}
          active
        />
      </div>

      <div className="mx-auto my-2 flex w-1/2 justify-center text-blue-400">
        <ArrowDown className="h-5 w-5 animate-bounce" />
      </div>

      <FlowNode
        icon={<Server className="h-5 w-5" />}
        title="Best available node"
        note="Health, workload and cost considered"
        full
      />

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
          Latest decision
        </p>

        <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-5 text-slate-300">
          {telemetry?.ai_decision ||
            "Waiting for the next transaction decision..."}
        </p>
      </div>
    </section>
  );
}

function DesktopRoutingSimulation({
  telemetry,
}: {
  telemetry: TelemetryData | null;
}) {
  const aiEnabled = telemetry?.ai_enabled ?? true;

  return (
    <div className="pointer-events-auto relative z-10 flex h-full min-h-90 min-w-0 flex-col items-center justify-center">
      <div
        data-routing-center
        className={`flex h-20 w-20 items-center justify-center rounded-full border-2 bg-slate-900 shadow-2xl transition-all duration-300 ${
          aiEnabled
            ? "scale-105 border-blue-500 shadow-blue-500/50"
            : "border-slate-600 opacity-80 shadow-slate-700/50"
        }`}
      >
        <Cpu
          className={`h-10 w-10 ${
            aiEnabled ? "animate-pulse text-blue-500" : "text-slate-500"
          }`}
        />
      </div>

      <div className="glass-panel mt-5 rounded-lg border border-slate-700 px-5 py-2.5 text-center shadow-xl">
        <p
          className={`text-sm font-bold tracking-widest ${
            aiEnabled ? "text-blue-400" : "text-slate-400"
          }`}
        >
          {aiEnabled ? "AI LIVE VIEW" : "LEGACY LIVE VIEW"}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          Both strategies process the same workload
        </p>
      </div>
    </div>
  );
}

function FlowNode({
  icon,
  title,
  note,
  active = false,
  full = false,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  active?: boolean;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${full ? "w-full" : "min-w-0"} ${
        active
          ? "border-blue-500/40 bg-blue-500/10"
          : "border-slate-800 bg-slate-900/70"
      }`}
    >
      <div className="flex items-center gap-2 text-blue-300">
        {icon}

        <p className="truncate text-xs font-bold text-white">{title}</p>
      </div>

      <p className="mt-1 text-[10px] leading-4 text-slate-500">{note}</p>
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
    <div className="flex items-center justify-between">
      <div className="flex min-w-0 items-center">
        <span className={`mr-3 h-3 w-3 shrink-0 rounded-full ${dotClass}`} />

        <div className="min-w-0">
          <p className="text-sm leading-tight text-slate-200">{label}</p>

          <p className="truncate text-[10px] text-slate-500">{detail}</p>
        </div>
      </div>

      <span className={`${textClass} ml-3 font-mono text-sm font-bold`}>
        {value}
      </span>
    </div>
  );
}
