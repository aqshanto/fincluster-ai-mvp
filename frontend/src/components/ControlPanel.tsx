"use client";
import React, { useState } from "react";
import {
  Brain,
  Zap,
  Flame,
  Lock,
  Unlock,
  RotateCcw,
  SendHorizonal,
} from "lucide-react";
import api from "@/services/api";
import TransactionModal from "./TransactionModal"; // ⚠️ নতুন মডাল ইমপোর্ট

interface ControlPanelProps {
  aiEnabled: boolean;
  surgeActive: boolean;
  anomalyActive: boolean;
}

export default function ControlPanel({
  aiEnabled,
  surgeActive,
  anomalyActive,
}: ControlPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false); // ⚠️ ট্রানজিকশন মডালের স্টেট
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("hackathon2026");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v1/auth/login", { username, password });
      localStorage.setItem("access_token", res.data.access_token);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setError("");
    } catch (err) {
      setError("Invalid credentials! Try admin / hackathon2026");
    }
  };

  const toggleAI = () =>
    api.post("/api/v1/control/toggle-ai").catch(() => setShowLoginModal(true));
  const toggleSurge = () =>
    api
      .post("/api/v1/control/toggle-surge")
      .catch(() => setShowLoginModal(true));
  const triggerAnomaly = () =>
    api
      .post("/api/v1/control/trigger-anomaly")
      .catch(() => setShowLoginModal(true));

  const handleReset = () => {
    window.dispatchEvent(new Event("force_reset_ui"));
    api.post("/api/v1/control/reset").catch(() => setShowLoginModal(true));
  };

  return (
    <>
      <footer className="glass-panel p-4 flex justify-center items-center gap-3.5 z-20 pointer-events-auto flex-wrap">
        <button
          onClick={toggleAI}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all shadow-lg text-sm ${
            aiEnabled
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 shadow-none"
          }`}
        >
          <Brain
            className={`w-4 h-4 ${aiEnabled ? "text-white animate-pulse" : "text-slate-400"}`}
          />
          <span>FinCluster AI: {aiEnabled ? "ON" : "OFF (LEGACY)"}</span>
        </button>

        <button
          onClick={toggleSurge}
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
          onClick={triggerAnomaly}
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

        {/* ⚠️ নতুন MANUAL TRANSACTION SIMULATOR বাটন ⚠️ */}
        <button
          onClick={() => setShowTxModal(true)}
          title="Inject realistic transactions with ISO-8583 metadata"
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all border bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600 shadow-lg hover:shadow-emerald-900/50 active:scale-95 text-sm"
        >
          <SendHorizonal className="w-4 h-4 text-emerald-400 animate-bounce" />
          <span>⚡ Manual Tx</span>
        </button>

        <button
          onClick={handleReset}
          title="Reset time, graph and nodes instantly"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-700 shadow-lg hover:shadow-rose-900/50 active:scale-95 text-sm"
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>Reset Sim</span>
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1"></div>

        <button
          onClick={() =>
            isLoggedIn ? setIsLoggedIn(false) : setShowLoginModal(true)
          }
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono hover:border-blue-500 text-slate-300"
        >
          {isLoggedIn ? (
            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isLoggedIn ? "Admin Authenticated" : "Admin Login"}</span>
        </button>
      </footer>

      {/* ⚠️ ট্রানজিকশন মডাল রেন্ডার */}
      {showTxModal && (
        <TransactionModal onClose={() => setShowTxModal(false)} />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 pointer-events-auto">
          <div className="glass-panel p-6 rounded-xl w-87.5 border border-slate-600 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-400" /> Admin Authentication
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter JWT credentials to unlock cluster controls.
            </p>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/50 p-2 rounded mb-3 border border-red-800">
                {error}
              </p>
            )}

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-sm transition-all"
                >
                  Login & Generate JWT
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
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
