"use client";

import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import api from "@/services/api";
import { ManualTransactionResult, PendingReview } from "@/types";

interface ReviewQueueModalProps {
  onClose: () => void;
  onUnauthorized: () => void;
}

interface ReviewQueueResponse {
  items: PendingReview[];
}

export default function ReviewQueueModal({
  onClose,
  onUnauthorized,
}: ReviewQueueModalProps) {
  const [items, setItems] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * Initial queue loading.
   *
   * This effect intentionally performs state updates only after the
   * asynchronous API request completes. It avoids calling a function that
   * synchronously invokes setState from inside the effect.
   */
  useEffect(() => {
    let cancelled = false;

    const loadInitialQueue = async () => {
      try {
        const response = await api.get<ReviewQueueResponse>(
          "/api/v1/ai/reviews",
          {
            params: {
              limit: 50,
            },
          },
        );

        if (cancelled) {
          return;
        }

        setItems(response.data.items ?? []);
        setError("");
      } catch (caught) {
        if (cancelled) {
          return;
        }

        if (axios.isAxiosError(caught) && caught.response?.status === 401) {
          onUnauthorized();
          return;
        }

        const detail = axios.isAxiosError<{ detail?: string }>(caught)
          ? caught.response?.data?.detail
          : undefined;

        setError(detail || "Could not load the human-review queue.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialQueue();

    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  /*
   * Manual refresh is triggered by a user action, so setting loading state
   * immediately here is safe and does not violate the effect lint rule.
   */
  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.get<ReviewQueueResponse>(
        "/api/v1/ai/reviews",
        {
          params: {
            limit: 50,
          },
        },
      );

      setItems(response.data.items ?? []);
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }

      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;

      setError(detail || "Could not refresh the human-review queue.");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  const resolveReview = async (
    item: PendingReview,
    reviewedLabel: "heavy" | "light",
  ) => {
    setResolving(item.event_uid);
    setMessage("");
    setError("");

    try {
      const response = await api.post<ManualTransactionResult>(
        "/api/v1/ai/reviews/resolve",
        {
          event_uid: item.event_uid,
          reviewed_label: reviewedLabel,
        },
      );

      setItems((current) =>
        current.filter((entry) => entry.event_uid !== item.event_uid),
      );

      const correctness = response.data.prediction_correct
        ? "confirmed"
        : "corrected";

      const nodeName = response.data.route?.node_name || "no available node";

      setMessage(
        `${item.event_uid}: human review ${correctness} the model prediction and routed the task to ${nodeName}.`,
      );
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }

      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;

      setError(detail || "Could not resolve this review.");
    } finally {
      setResolving(null);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-queue-title"
    >
      <div className="glass-panel max-h-[90vh] w-[min(920px,94vw)] overflow-y-auto rounded-2xl border border-amber-700/60 bg-slate-950/95 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h3
              id="review-queue-title"
              className="flex items-center gap-2 text-lg font-bold text-white"
            >
              <ClipboardCheck className="h-5 w-5 text-amber-400" />
              Human Review Queue
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              These transactions were held because the model was uncertain, a
              fallback was used, or an operator explicitly requested review.
              They are routed only after the operator confirms Heavy or Light.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refreshQueue()}
              disabled={loading}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh queue"
              aria-label="Refresh review queue"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"
              title="Close review queue"
              aria-label="Close review queue"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {message && (
          <p className="mb-3 rounded-lg border border-cyan-800 bg-cyan-950/50 p-2 text-xs text-cyan-200">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-8 text-center">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-400" />

            <p className="mt-3 text-sm font-bold text-slate-200">
              Loading review queue
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Retrieving transactions waiting for an operator decision.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />

            <p className="mt-2 font-bold text-emerald-300">Queue is clear</p>

            <p className="mt-1 text-xs text-slate-400">
              No manual transaction is currently waiting for a human decision.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isResolving = resolving === item.event_uid;

              return (
                <article
                  key={item.event_uid}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        Event {item.event_uid}
                      </p>

                      <p className="mt-1 text-sm font-bold text-white">
                        BDT {item.amount.toLocaleString()} · MCC {item.mcc} · Tx
                        type {item.tx_type}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Account age {item.account_age_days} days · VPN{" "}
                        {item.is_vpn ? "Yes" : "No"}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <p className="text-slate-400">Model prediction</p>

                      <p
                        className={`font-bold uppercase ${
                          item.predicted_label === "heavy"
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {item.predicted_label} · risk {item.risk_score}
                      </p>

                      <p className="text-slate-500">
                        Confidence {(item.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/30 p-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Why review is required
                    </p>

                    {item.review_reasons.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-xs text-amber-100/90">
                        {item.review_reasons.map((reason, index) => (
                          <li key={`${item.event_uid}-${index}-${reason}`}>
                            • {reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-amber-100/80">
                        • The transaction was manually submitted for operator
                        review.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-slate-500">
                      Confirm the processing workload:
                    </span>

                    <button
                      type="button"
                      disabled={isResolving || resolving !== null}
                      onClick={() => void resolveReview(item, "light")}
                      className="rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isResolving ? "Routing…" : "Route as Light"}
                    </button>

                    <button
                      type="button"
                      disabled={isResolving || resolving !== null}
                      onClick={() => void resolveReview(item, "heavy")}
                      className="rounded-lg border border-rose-700 bg-rose-950 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isResolving ? "Routing…" : "Route as Heavy"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
