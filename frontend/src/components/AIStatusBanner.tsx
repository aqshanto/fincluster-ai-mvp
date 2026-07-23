"use client";

import type { ReactNode } from "react";
import {
  BrainCircuit,
  Database,
  RefreshCcw,
  ShieldCheck,
  Trophy,
} from "lucide-react";

export interface AIStatusBannerData {
  ai_runtime?: {
    local_model?: {
      available?: boolean;
      model_name?: string;
      selected_algorithm?: string | null;
      metrics?: {
        accuracy?: number;
      } | null;
      review_policy?: {
        enabled?: boolean;
      };
    };
  };
  dataset?: {
    rows?: number;
    reviewed_rows?: number;
  };
  retraining?: {
    enabled?: boolean;
    training?: boolean;
    reviewed_rows?: number;
    min_reviewed?: number;
  };
}

interface AIStatusBannerProps {
  status: AIStatusBannerData | null;
  onOpenDetails: () => void;
}

function formatAlgorithm(value: string | null | undefined): string {
  if (!value) return "Loading";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAccuracy(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export default function AIStatusBanner({
  status,
  onOpenDetails,
}: AIStatusBannerProps) {
  const localModel = status?.ai_runtime?.local_model;
  const dataset = status?.dataset;
  const retraining = status?.retraining;

  const modelAvailable = localModel?.available === true;
  const algorithm = formatAlgorithm(localModel?.selected_algorithm);
  const accuracy = formatAccuracy(localModel?.metrics?.accuracy);
  const datasetRows = dataset?.rows ?? 0;
  const reviewedRows = retraining?.reviewed_rows ?? dataset?.reviewed_rows ?? 0;
  const minimumReviews = retraining?.min_reviewed ?? 100;
  const reviewEnabled = localModel?.review_policy?.enabled === true;
  const modelName = localModel?.model_name ?? "Waiting for local model status";

  return (
    <section
      className="relative z-20 mx-auto w-full max-w-350 px-3 pt-3 sm:px-4 lg:px-8 lg:pt-2"
      aria-label="FinCluster AI status"
    >
      <button
        type="button"
        onClick={onOpenDetails}
        className="glass-panel flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-slate-950/90 p-4 text-left shadow-lg shadow-blue-950/20 transition hover:border-blue-400 lg:hidden"
        aria-label="Open AI model intelligence"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15">
            <BrainCircuit className="h-5 w-5 text-blue-300" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold text-white">
                {algorithm}
              </p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  modelAvailable
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                {modelAvailable ? "AI online" : "Loading"}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {accuracy} held-out accuracy · {reviewedRows}/{minimumReviews}{" "}
              reviewed
            </p>
          </div>
        </div>

        <span className="shrink-0 text-xs font-bold text-blue-300">
          Details
        </span>
      </button>

      <div className="glass-panel hidden items-center gap-3 rounded-2xl border border-blue-500/30 bg-slate-950/88 px-4 py-3 shadow-lg shadow-blue-950/20 backdrop-blur-xl lg:flex">
        <div className="flex min-w-57.5 items-center gap-3 border-r border-slate-800 pr-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15">
            <BrainCircuit className="h-5 w-5 text-blue-300" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-white">
                AI Intelligence
              </h2>
              <span
                className={`h-2 w-2 rounded-full ${
                  modelAvailable
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                    : "animate-pulse bg-amber-400"
                }`}
              />
            </div>
            <p className="truncate font-mono text-[10px] text-slate-500">
              {modelName}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-5 gap-2">
          <Metric
            icon={<Trophy className="h-4 w-4" />}
            label="Champion"
            value={algorithm}
          />
          <Metric
            icon={<BrainCircuit className="h-4 w-4" />}
            label="Accuracy"
            value={accuracy}
          />
          <Metric
            icon={<Database className="h-4 w-4" />}
            label="Transactions"
            value={datasetRows.toLocaleString()}
          />
          <Metric
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Human review"
            value={reviewEnabled ? "Enabled" : "Disabled"}
          />
          <Metric
            icon={<RefreshCcw className="h-4 w-4" />}
            label="Retraining"
            value={
              retraining?.training
                ? "Training"
                : `${reviewedRows}/${minimumReviews}`
            }
          />
        </div>

        <button
          type="button"
          onClick={onOpenDetails}
          className="shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 hover:text-white"
        >
          View details
        </button>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-2">
      <div className="shrink-0 text-blue-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="truncate text-xs font-bold text-white" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}
