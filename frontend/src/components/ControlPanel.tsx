"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  Brain,
  ClipboardCheck,
  Cloud,
  Database,
  Flame,
  Lock,
  RotateCcw,
  Send,
  Unlock,
  Zap,
} from "lucide-react";

import api from "@/services/api";
import ReviewQueueModal from "./ReviewQueueModal";
import TransactionModal from "./TransactionModal";

interface ControlPanelProps {
  aiEnabled: boolean;
  surgeActive: boolean;
  anomalyActive: boolean;
  externalAIEnabled: boolean;
  externalAIAvailable: boolean;
  externalModel: string;
  datasetRows: number;
  pendingReviewCount: number;
}

const baseButton =
  "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all sm:min-h-0 sm:text-sm";

export default function ControlPanel({
  aiEnabled,
  surgeActive,
  anomalyActive,
  externalAIEnabled,
  externalAIAvailable,
  externalModel,
  datasetRows,
  pendingReviewCount,
}: ControlPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    api
      .get("/api/v1/auth/me")
      .then(() => setIsLoggedIn(true))
      .catch(() => {
        localStorage.removeItem("access_token");
        setIsLoggedIn(false);
      });
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await api.post("/api/v1/auth/login", {
        username,
        password,
      });
      localStorage.setItem("access_token", response.data.access_token);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setPassword("");
      setError("");
    } catch (caught) {
      const message = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(message || "Invalid username or password.");
    }
  };

  const requireOperator = async (action: () => Promise<unknown>) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    try {
      await action();
      setActionMessage("");
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        localStorage.removeItem("access_token");
        setIsLoggedIn(false);
        setError("Your operator session expired. Please sign in again.");
        setShowLoginModal(true);
        return;
      }

      const detail = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setActionMessage(
        detail || "Control action failed. Check the backend connection.",
      );
    }
  };

  const handleReset = () =>
    requireOperator(async () => {
      window.dispatchEvent(new Event("force_reset_ui"));
      await api.post("/api/v1/control/reset");
    });

  const handleExportDataset = () =>
    requireOperator(async () => {
      setExporting(true);
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
        setExporting(false);
      }
    });

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setIsLoggedIn(false);
    setShowTxModal(false);
    setShowReviewModal(false);
  };

  return (
    <>
      <footer className="glass-panel relative z-20 border-t border-slate-800/80 p-3 pointer-events-auto sm:p-4">
        <div className="mx-auto grid w-full max-w-350 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={() =>
              void requireOperator(() => api.post("/api/v1/control/toggle-ai"))
            }
            className={`${baseButton} col-span-2 shadow-lg sm:col-span-1 sm:px-5 ${
              aiEnabled
                ? "border-blue-500 bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-500"
                : "border-slate-600 bg-slate-800 text-slate-400 shadow-none hover:bg-slate-700"
            }`}
          >
            <Brain className={`h-4 w-4 ${aiEnabled ? "animate-pulse" : ""}`} />
            <span>
              Live View: {aiEnabled ? "AI Scheduler" : "Legacy Round-Robin"}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              void requireOperator(() =>
                api.post("/api/v1/control/toggle-external-ai"),
              )
            }
            disabled={!externalAIAvailable}
            title={
              externalAIAvailable
                ? `Manual transactions only: ${externalModel}`
                : "Set GEMINI_API_KEY on the backend to enable manual API review"
            }
            className={`${baseButton} disabled:cursor-not-allowed disabled:opacity-45 ${
              externalAIEnabled
                ? "border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-500/30 hover:bg-violet-500"
                : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Cloud className="h-4 w-4" />
            <span>Manual AI: {externalAIEnabled ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              void requireOperator(() =>
                api.post("/api/v1/control/toggle-surge"),
              )
            }
            className={`${baseButton} ${
              surgeActive
                ? "border-red-500 bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-500"
                : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>{surgeActive ? "Stop Surge" : "Eid Surge"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              void requireOperator(() =>
                api.post("/api/v1/control/trigger-anomaly"),
              )
            }
            className={`${baseButton} ${
              anomalyActive
                ? "animate-pulse border-amber-500 bg-amber-600 text-white hover:bg-amber-500"
                : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Flame className="h-4 w-4 text-amber-400" />
            <span>{anomalyActive ? "Stop Anomaly" : "Node Anomaly"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              isLoggedIn ? setShowTxModal(true) : setShowLoginModal(true)
            }
            title="Inject realistic transactions with ISO-8583 metadata"
            className={`${baseButton} border-emerald-600 bg-emerald-950/80 text-emerald-300 shadow-lg hover:bg-emerald-900 active:scale-95`}
          >
            <Send className="h-4 w-4 text-emerald-400" />
            <span>Manual Tx</span>
          </button>

          <button
            type="button"
            onClick={() =>
              isLoggedIn ? setShowReviewModal(true) : setShowLoginModal(true)
            }
            title="Review uncertain manual transactions before routing"
            className={`${baseButton} ${
              pendingReviewCount > 0
                ? "border-amber-600 bg-amber-950 text-amber-300 shadow-lg shadow-amber-500/20 hover:bg-amber-900"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Reviews {pendingReviewCount}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleReset()}
            title="Reset both clusters, chart, time, tasks, and routing events"
            className={`${baseButton} border-rose-700 bg-rose-950/80 text-rose-300 shadow-lg hover:bg-rose-900 active:scale-95`}
          >
            <RotateCcw className="h-4 w-4 text-rose-400" />
            <span>Reset Sim</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExportDataset()}
            title="Export privacy-safe collected features and reviewed labels"
            className={`${baseButton} border-cyan-800 bg-slate-900 text-cyan-300 hover:bg-slate-800`}
          >
            <Database className="h-4 w-4" />
            <span>{exporting ? "Exporting..." : `Dataset ${datasetRows}`}</span>
          </button>

          <div className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />

          <button
            type="button"
            onClick={isLoggedIn ? handleLogout : () => setShowLoginModal(true)}
            className={`${baseButton} col-span-2 border-slate-700 bg-slate-900 font-mono text-slate-300 hover:border-blue-500 sm:col-span-1`}
          >
            {isLoggedIn ? (
              <Unlock className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{isLoggedIn ? "Operator: Sign out" : "Operator Login"}</span>
          </button>

          {actionMessage && (
            <p className="col-span-2 text-center text-[11px] text-amber-300 sm:basis-full">
              {actionMessage}
            </p>
          )}
        </div>
      </footer>

      {showTxModal && (
        <TransactionModal
          onClose={() => setShowTxModal(false)}
          onUnauthorized={() => {
            localStorage.removeItem("access_token");
            setIsLoggedIn(false);
            setShowTxModal(false);
            setShowLoginModal(true);
          }}
        />
      )}

      {showReviewModal && (
        <ReviewQueueModal
          onClose={() => setShowReviewModal(false)}
          onUnauthorized={() => {
            localStorage.removeItem("access_token");
            setIsLoggedIn(false);
            setShowReviewModal(false);
            setShowLoginModal(true);
          }}
        />
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm pointer-events-auto">
          <div className="glass-panel w-full max-w-sm rounded-xl border border-slate-600 p-5 shadow-2xl sm:p-6">
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
              <Lock className="h-5 w-5 text-blue-400" />
              Operator Authentication
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Telemetry is public. A signed operator token is required to change
              simulation state or inject transactions.
            </p>

            {error && (
              <p className="mb-3 rounded border border-red-800 bg-red-950/50 p-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">
                  Username
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="input-style text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="input-style text-sm"
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setError("");
                  }}
                  className="rounded bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
