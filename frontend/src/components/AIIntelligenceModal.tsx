"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";

import api from "@/services/api";

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  balanced_accuracy: number;
  roc_auc: number;
  pr_auc: number;
  threshold: number;
  selection_score: number;
  training_rows: number;
  validation_rows: number;
  test_rows: number;
  evaluation_split: string;
}

interface LocalModelStatus {
  available: boolean;
  model_name: string;
  dataset_source: string;
  requested_algorithm: string;
  selected_algorithm: string | null;
  threshold: number;
  xgboost_available: boolean;
  review_policy: {
    enabled: boolean;
    confidence_threshold: number;
    fallbacks_require_review: boolean;
  };
  metrics: ModelMetrics | null;
  candidate_metrics: Record<string, ModelMetrics>;
  artifact_path: string | null;
  error: string | null;
}

interface AIStatusResponse {
  ai_runtime: {
    auto_engine: string;
    manual_engine: string;
    external_ai_available: boolean;
    external_ai_enabled: boolean;
    external_model: string;
    api_calls: number;
    cache_hits: number;
    fallbacks: number;
    last_error: string | null;
    local_model: LocalModelStatus;
  };
  dataset: {
    rows: number;
    reviewed_rows: number;
    pending_reviews: number;
    correct_predictions: number;
    incorrect_predictions: number;
    reviewed_accuracy: number | null;
    max_rows: number;
    auto_sample_every: number;
    storage: string;
    contains_sensitive_identifiers: boolean;
    last_error: string | null;
  };
  retraining: {
    enabled: boolean;
    training: boolean;
    algorithm: string;
    min_reviewed: number;
    batch_size: number;
    reviewed_rows: number;
    last_trained_reviewed_rows: number;
    next_retrain_at: number;
    artifact_path: string;
    quality_gates: {
      selection_score: number;
      recall: number;
      balanced_accuracy: number;
    };
    last_started_at: string | null;
    last_completed_at: string | null;
    last_error: string | null;
    last_result: Record<string, unknown> | null;
    promotions: number;
  };
}

interface AIIntelligenceModalProps {
  open: boolean;
  onClose: () => void;
}

const candidateLabels: Record<string, string> = {
  random_forest: "Random Forest",
  xgboost: "XGBoost",
};

function percentage(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function algorithmName(value: string | null | undefined): string {
  if (!value) return "Not selected";

  return (
    candidateLabels[value] ||
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export default function AIIntelligenceModal({
  open,
  onClose,
}: AIIntelligenceModalProps) {
  const [statusData, setStatusData] = useState<AIStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<AIStatusResponse>("/api/v1/ai/status");
      setStatusData(response.data);
    } catch (caught) {
      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;

      setError(detail || "Could not load the AI intelligence status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadStatus, onClose, open]);

  const candidates = useMemo(() => {
    const candidateMetrics =
      statusData?.ai_runtime.local_model.candidate_metrics ?? {};

    return Object.entries(candidateMetrics).sort(([first], [second]) => {
      const selected =
        statusData?.ai_runtime.local_model.selected_algorithm ?? "";

      if (first === selected) return -1;
      if (second === selected) return 1;
      return first.localeCompare(second);
    });
  }, [statusData]);

  if (!open) {
    return null;
  }

  const localModel = statusData?.ai_runtime.local_model;
  const dataset = statusData?.dataset;
  const retraining = statusData?.retraining;

  const reviewProgress =
    retraining && retraining.min_reviewed > 0
      ? Math.min(
          100,
          (retraining.reviewed_rows / retraining.min_reviewed) * 100,
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-intelligence-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-blue-500/30 bg-slate-950/98 shadow-[0_0_80px_rgba(37,99,235,0.25)]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur-xl sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
              <BrainCircuit className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                AI Decision Engine
              </p>

              <h2
                id="ai-intelligence-title"
                className="mt-1 text-xl font-black text-white sm:text-2xl"
              >
                Model intelligence and safety status
              </h2>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400 sm:text-sm">
                See which candidate won, why it was selected, how much reviewed
                evidence exists, and when controlled retraining can begin.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-300 transition hover:border-blue-500 hover:text-white disabled:opacity-50"
              title="Refresh AI status"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-slate-300 transition hover:border-rose-500 hover:text-white"
              aria-label="Close AI intelligence panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          {error && (
            <div className="rounded-xl border border-rose-700/70 bg-rose-950/50 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {loading && !statusData && (
            <div className="flex min-h-72 items-center justify-center">
              <div className="text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-400" />
                <p className="mt-3 text-sm text-slate-400">
                  Loading model intelligence…
                </p>
              </div>
            </div>
          )}

          {statusData && localModel && dataset && retraining && (
            <>
              <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <article className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-blue-300">
                        <Trophy className="h-4 w-4 text-amber-300" />
                        Active champion model
                      </p>

                      <h3 className="mt-3 wrap-break-word text-xl font-black text-white">
                        {algorithmName(localModel.selected_algorithm)}
                      </h3>

                      <p className="mt-1 wrap-break-word font-mono text-[11px] text-slate-500">
                        {localModel.model_name}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        localModel.available
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {localModel.available ? "Serving live" : "Unavailable"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric
                      label="Held-out accuracy"
                      value={percentage(localModel.metrics?.accuracy)}
                    />

                    <Metric
                      label="Recall"
                      value={percentage(localModel.metrics?.recall)}
                    />

                    <Metric
                      label="F1 score"
                      value={percentage(localModel.metrics?.f1)}
                    />

                    <Metric
                      label="Decision threshold"
                      value={localModel.threshold.toFixed(2)}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-slate-400">
                    <strong className="text-amber-200">
                      Evaluation qualifier:
                    </strong>{" "}
                    These metrics come from seeded synthetic simulator data.
                    They demonstrate the local ML pipeline, not production
                    banking accuracy.
                  </div>
                </article>

                <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-cyan-300">
                    <Sparkles className="h-4 w-4" />
                    Runtime mode
                  </p>

                  <div className="mt-5 space-y-3">
                    <StatusRow
                      label="Automatic traffic"
                      value={statusData.ai_runtime.auto_engine}
                    />

                    <StatusRow
                      label="Manual traffic"
                      value={statusData.ai_runtime.manual_engine}
                    />

                    <StatusRow
                      label="External AI calls"
                      value={String(statusData.ai_runtime.api_calls)}
                    />

                    <StatusRow
                      label="Human review"
                      value={
                        localModel.review_policy.enabled
                          ? "Enabled"
                          : "Disabled"
                      }
                    />
                  </div>
                </article>
              </section>

              <section>
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-violet-300">
                    Candidate comparison
                  </p>

                  <h3 className="mt-1 text-lg font-black text-white">
                    Both algorithms were evaluated; one winner serves traffic
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {candidates.map(([candidateName, metrics]) => {
                    const isWinner =
                      candidateName === localModel.selected_algorithm;

                    return (
                      <article
                        key={candidateName}
                        className={`relative overflow-hidden rounded-2xl border p-5 ${
                          isWinner
                            ? "border-amber-500/45 bg-amber-500/5"
                            : "border-slate-800 bg-slate-900/60"
                        }`}
                      >
                        {isWinner && (
                          <div className="absolute right-0 top-0 rounded-bl-xl border-b border-l border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                            Champion
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                              isWinner
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-violet-500/30 bg-violet-500/10 text-violet-300"
                            }`}
                          >
                            {isWinner ? (
                              <Trophy className="h-5 w-5" />
                            ) : (
                              <BrainCircuit className="h-5 w-5" />
                            )}
                          </div>

                          <div>
                            <h4 className="font-black text-white">
                              {algorithmName(candidateName)}
                            </h4>

                            <p className="text-xs text-slate-500">
                              Validation candidate
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <Metric
                            label="Accuracy"
                            value={percentage(metrics.accuracy)}
                            compact
                          />

                          <Metric
                            label="Recall"
                            value={percentage(metrics.recall)}
                            compact
                          />

                          <Metric
                            label="F1 score"
                            value={percentage(metrics.f1)}
                            compact
                          />

                          <Metric
                            label="Selection score"
                            value={percentage(metrics.selection_score)}
                            compact
                          />
                        </div>

                        <p className="mt-4 text-xs leading-5 text-slate-500">
                          {isWinner
                            ? "Selected using the safety-weighted comparison score."
                            : "Retained as a challenger for future reviewed-data retraining."}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-emerald-300">
                    <UserCheck className="h-4 w-4" />
                    Human-reviewed evidence
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric
                      label="Reviewed"
                      value={String(dataset.reviewed_rows)}
                      compact
                    />

                    <Metric
                      label="Correct"
                      value={String(dataset.correct_predictions)}
                      compact
                    />

                    <Metric
                      label="Corrected"
                      value={String(dataset.incorrect_predictions)}
                      compact
                    />

                    <Metric
                      label="Reviewed accuracy"
                      value={percentage(dataset.reviewed_accuracy)}
                      compact
                    />
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Six reviews are enough to prove the feedback workflow, but
                    not enough to estimate real operating accuracy.
                  </p>
                </article>

                <article className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-violet-300">
                        <Database className="h-4 w-4" />
                        Retraining readiness
                      </p>

                      <p className="mt-3 text-lg font-black text-white">
                        {retraining.reviewed_rows} / {retraining.min_reviewed}{" "}
                        reviewed labels
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${
                        retraining.enabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      Auto retraining {retraining.enabled ? "ON" : "OFF"}
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-violet-500 via-blue-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${reviewProgress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-400">
                      First threshold: {retraining.min_reviewed}
                    </span>

                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-400">
                      Next batch: +{retraining.batch_size}
                    </span>

                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-400">
                      Promotions: {retraining.promotions}
                    </span>
                  </div>
                </article>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />

                  <div>
                    <p className="font-black text-white">
                      Why this design is safer
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      FinCluster does not retrain from its own guesses.
                      Human-reviewed labels train both candidates, and a new
                      model can replace the live champion only after passing
                      minimum recall, balanced accuracy, and selection-score
                      requirements.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-950/70 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 font-mono font-black text-white ${
          compact ? "text-lg" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-slate-500">{label}</span>

      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        {value}
      </span>
    </div>
  );
}
