"use client";

import React, { useEffect, useState } from "react";
import {
  Brain,
  Zap,
  Flame,
  Lock,
  Unlock,
  RotateCcw,
  Send,
  Cloud,
  Database,
  ClipboardCheck,
} from "lucide-react";
import axios from "axios";
import api from "@/services/api";
import TransactionModal from "./TransactionModal";
import ReviewQueueModal from "./ReviewQueueModal";

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
      setActionMessage(detail || "Control action failed. Check the backend connection.");
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
      <footer className="glass-panel p-4 flex justify-center items-center gap-3.5 z-20 pointer-events-auto flex-wrap">
        <button
          onClick={() =>
            requireOperator(() => api.post("/api/v1/control/toggle-ai"))
          }
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all shadow-lg text-sm ${
            aiEnabled
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 shadow-none"
          }`}
        >
          <Brain
            className={`w-4 h-4 ${aiEnabled ? "animate-pulse" : ""}`}
          />
          <span>
            Live View: {aiEnabled ? "AI Scheduler" : "Legacy Round-Robin"}
          </span>
        </button>


        <button
          onClick={() =>
            requireOperator(() =>
              api.post("/api/v1/control/toggle-external-ai"),
            )
          }
          disabled={!externalAIAvailable}
          title={
            externalAIAvailable
              ? `Manual transactions only: ${externalModel}`
              : "Set GEMINI_API_KEY on the backend to enable manual API review"
          }
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border text-sm disabled:cursor-not-allowed disabled:opacity-45 ${
            externalAIEnabled
              ? "bg-violet-600 hover:bg-violet-500 text-white border-violet-400 shadow-lg shadow-violet-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Manual AI API: {externalAIEnabled ? "ON" : "OFF"}</span>
        </button>

        <button
          onClick={() =>
            requireOperator(() => api.post("/api/v1/control/toggle-surge"))
          }
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all border text-sm ${
            surgeActive
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-500"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>
            {surgeActive ? "Stop Traffic Surge" : "Trigger Eid Surge"}
          </span>
        </button>

        <button
          onClick={() =>
            requireOperator(() =>
              api.post("/api/v1/control/trigger-anomaly"),
            )
          }
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all border text-sm ${
            anomalyActive
              ? "bg-amber-600 hover:bg-amber-500 text-white animate-pulse border-amber-500"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>
            {anomalyActive ? "Stop Anomaly" : "Trigger Node 1 Anomaly"}
          </span>
        </button>

        <button
          onClick={() =>
            isLoggedIn ? setShowTxModal(true) : setShowLoginModal(true)
          }
          title="Inject realistic transactions with ISO-8583 metadata"
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all border bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600 shadow-lg active:scale-95 text-sm"
        >
          <Send className="w-4 h-4 text-emerald-400" />
          <span>Manual Tx</span>
        </button>

        <button
          onClick={() =>
            isLoggedIn ? setShowReviewModal(true) : setShowLoginModal(true)
          }
          title="Review uncertain manual transactions before routing"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border text-sm ${
            pendingReviewCount > 0
              ? "bg-amber-950 hover:bg-amber-900 text-amber-300 border-amber-600 shadow-lg shadow-amber-500/20"
              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Reviews {pendingReviewCount}</span>
        </button>

        <button
          onClick={handleReset}
          title="Reset both clusters, chart, time, tasks, and routing events"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-700 shadow-lg active:scale-95 text-sm"
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Reset Sim</span>
        </button>


        <button
          onClick={handleExportDataset}
          title="Export privacy-safe collected features and reviewed labels"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800 text-sm"
        >
          <Database className="w-4 h-4" />
          <span>{exporting ? "Exporting..." : `Dataset ${datasetRows}`}</span>
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <button
          onClick={
            isLoggedIn ? handleLogout : () => setShowLoginModal(true)
          }
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono hover:border-blue-500 text-slate-300"
        >
          {isLoggedIn ? (
            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>
            {isLoggedIn ? "Operator: Sign out" : "Operator Login"}
          </span>
        </button>
        {actionMessage && (
          <p className="basis-full text-center text-[11px] text-amber-300">
            {actionMessage}
          </p>
        )}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 pointer-events-auto">
          <div className="glass-panel p-6 rounded-xl w-87.5 border border-slate-600 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" />
              Operator Authentication
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Telemetry is public. A signed operator token is required to
              change simulation state or inject transactions.
            </p>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/50 p-2 rounded mb-3 border border-red-800">
                {error}
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-300 block mb-1">
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
                <span className="text-xs text-slate-300 block mb-1">
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
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-sm"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setError("");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-4 rounded text-sm"
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
