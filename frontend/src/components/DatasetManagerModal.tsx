"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Database,
  Download,
  History,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

import api from "@/services/api";

interface DemoBatch {
  batch_id: string;
  label: string;
  filename: string;
  rows: number;
  expected_start_reviewed: number;
  expected_end_reviewed: number;
  description: string;
}

interface ImportRecord {
  batch_id: string;
  filename: string;
  inserted_rows: number;
  imported_by: string;
  imported_at: string;
}

interface RetrainingRun {
  run_id: number;
  reviewed_rows: number;
  selected_algorithm: string | null;
  model_name: string | null;
  metrics: {
    accuracy?: number;
    recall?: number;
    selection_score?: number;
  };
  promoted: boolean;
  quality_passed: boolean;
  completed_at: string;
}

interface CatalogResponse {
  dataset_name: string;
  contains_real_customer_data: boolean;
  limitations: string[];
  batches: DemoBatch[];
  imports: ImportRecord[];
  dataset: {
    rows: number;
    reviewed_rows: number;
    storage: string;
    persistent?: boolean;
  };
  retraining: {
    training: boolean;
    min_reviewed: number;
    batch_size: number;
    next_retrain_at: number;
    promotions: number;
  };
}

interface HistoryResponse {
  items: RetrainingRun[];
}

interface DatasetManagerModalProps {
  onClose: () => void;
  onUnauthorized: () => void;
}

function percent(value: number | undefined): string {
  return value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}

function algorithmName(value: string | null): string {
  if (!value) return "No candidate";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function DatasetManagerModal({
  onClose,
  onUnauthorized,
}: DatasetManagerModalProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [history, setHistory] = useState<RetrainingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalogResponse, historyResponse] = await Promise.all([
        api.get<CatalogResponse>("/api/v1/ai/demo-batches"),
        api.get<HistoryResponse>("/api/v1/ai/retraining/history"),
      ]);
      setCatalog(catalogResponse.data);
      setHistory(historyResponse.data.items);
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }
      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(detail || "Could not load the dataset manager.");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(loadTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [load]);

  const importBatch = async (batch: DemoBatch) => {
    setBusyBatch(batch.batch_id);
    setMessage("");
    setError("");
    try {
      const response = await api.post(
        `/api/v1/ai/demo-batches/${batch.batch_id}/import`,
      );
      const retraining = response.data.retraining;
      const result = retraining?.last_result;
      const modelText = result
        ? ` Retraining ${result.promoted ? "promoted" : "evaluated"} ${result.model_name ?? "the challenger"} at ${percent(result.metrics?.accuracy)} accuracy.`
        : "";
      setMessage(
        `${response.data.inserted_rows} reviewed rows imported. Total reviewed: ${response.data.dataset.reviewed_rows}.${modelText}`,
      );
      await load();
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }
      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(detail || "Dataset import failed.");
    } finally {
      setBusyBatch(null);
    }
  };

  const importCustom = async () => {
    if (!customFile) return;
    setBusyBatch("custom");
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", customFile);
      form.append("batch_id", `custom-${Date.now()}`);
      const response = await api.post("/api/v1/ai/datasets/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(
        `${response.data.inserted_rows} custom reviewed rows imported. Total reviewed: ${response.data.dataset.reviewed_rows}.`,
      );
      setCustomFile(null);
      await load();
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }
      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(detail || "Custom CSV import failed.");
    } finally {
      setBusyBatch(null);
    }
  };

  const resetLearningDemo = async () => {
    const confirmed = window.confirm(
      "Reset all persistent reviewed rows, batch history, retraining history, and promoted models? This is only for rehearsing the hackathon demo again.",
    );
    if (!confirmed) return;

    setBusyBatch("reset");
    setMessage("");
    setError("");
    try {
      const response = await api.post("/api/v1/ai/demo/reset");
      setMessage(response.data.message || "Learning demo reset successfully.");
      await load();
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }
      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(detail || "Could not reset the learning demo.");
    } finally {
      setBusyBatch(null);
    }
  };

  const exportDataset = async () => {
    setBusyBatch("export");
    try {
      const response = await api.get("/api/v1/ai/dataset.csv", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fincluster-training-data.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusyBatch(null);
    }
  };

  const importedIds = new Set(catalog?.imports.map((item) => item.batch_id));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-950 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                Persistent reviewed evidence
              </p>
              <h2 className="mt-1 text-xl font-black text-white">
                Demo dataset manager
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Import prepared human-reviewed batches, trigger each 100-label retraining cycle, and inspect model history.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          {loading && !catalog ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Loading datasets…
            </div>
          ) : catalog ? (
            <>
              <section className="grid gap-3 sm:grid-cols-4">
                <Metric label="Storage" value={catalog.dataset.storage.toUpperCase()} />
                <Metric label="Reviewed" value={String(catalog.dataset.reviewed_rows)} />
                <Metric label="Next retrain" value={String(catalog.retraining.next_retrain_at)} />
                <Metric label="Promotions" value={String(catalog.retraining.promotions)} />
              </section>

              <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm font-bold text-emerald-200">
                  Prepared dataset policy
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  These are synthetic FinCluster simulator scenarios reviewed by the project team. They contain no real customer data.
                </p>
              </section>

              <section>
                <h3 className="text-sm font-black text-white">Prepared hackathon batches</h3>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {catalog.batches.map((batch) => {
                    const imported = importedIds.has(batch.batch_id);
                    const busy = busyBatch === batch.batch_id;
                    const ready =
                      catalog.dataset.reviewed_rows === batch.expected_start_reviewed &&
                      !catalog.retraining.training;
                    return (
                      <article
                        key={batch.batch_id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-white">{batch.label}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {batch.rows} human-reviewed rows
                            </p>
                          </div>
                          {imported && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                        </div>
                        <p className="mt-3 min-h-15 text-xs leading-5 text-slate-400">
                          {batch.description}
                        </p>
                        <button
                          type="button"
                          disabled={imported || !ready || busyBatch !== null}
                          onClick={() => void importBatch(batch)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {imported
                            ? "Already imported"
                            : catalog.retraining.training
                              ? "Training in progress"
                              : ready
                                ? "Import batch"
                                : `Requires ${batch.expected_start_reviewed} reviewed`}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white">
                    <Upload className="h-4 w-4 text-blue-300" /> Custom reviewed CSV
                  </h3>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setCustomFile(event.target.files?.[0] ?? null)}
                    className="mt-4 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-bold file:text-white"
                  />
                  <button
                    type="button"
                    disabled={!customFile || busyBatch !== null}
                    onClick={() => void importCustom()}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"
                  >
                    {busyBatch === "custom" ? "Importing and evaluating…" : "Import custom CSV"}
                  </button>
                </article>

                <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black text-white">
                    <Download className="h-4 w-4 text-emerald-300" /> Evidence export
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Download the privacy-safe transaction and reviewed-label audit trail for the judges.
                  </p>
                  <button
                    type="button"
                    disabled={busyBatch !== null}
                    onClick={() => void exportDataset()}
                    className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    Export current dataset
                  </button>
                </article>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                <h3 className="flex items-center gap-2 text-sm font-black text-white">
                  <History className="h-4 w-4 text-violet-300" /> Retraining history
                </h3>
                <div className="mt-3 space-y-2">
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-500">No retraining attempt has been recorded yet.</p>
                  ) : (
                    history.map((run) => (
                      <div
                        key={run.run_id}
                        className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                      >
                        <div>
                          <p className="font-bold text-white">
                            Training #{run.run_id} · {run.reviewed_rows} reviewed rows
                          </p>
                          <p className="mt-1 text-slate-500">
                            {algorithmName(run.selected_algorithm)} · {run.model_name ?? "No model"}
                          </p>
                        </div>
                        <span className="text-slate-300">Accuracy {percent(run.metrics.accuracy)}</span>
                        <span className="text-slate-300">Recall {percent(run.metrics.recall)}</span>
                        <span className={run.promoted ? "font-bold text-emerald-300" : "font-bold text-amber-300"}>
                          {run.promoted ? "Promoted" : run.quality_passed ? "Evaluated" : "Rejected"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-rose-200">Rehearsal reset</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Clears persistent reviewed evidence, imports, training history, and promoted models so the 0 → 99 → 100 flow can be demonstrated again.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyBatch !== null || catalog.retraining.training}
                  onClick={() => void resetLearningDemo()}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
                >
                  {busyBatch === "reset" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reset learning demo
                </button>
              </section>
            </>
          ) : null}

          {message && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}
