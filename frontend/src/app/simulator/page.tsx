"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Cpu,
  Globe,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  Unlock,
  Wifi,
} from "lucide-react";
import api from "@/services/api";
import { ManualTransactionResult } from "@/types";

export default function TransactionSimulatorPage() {
  const [amount, setAmount] = useState("1500");
  const [txType, setTxType] = useState("0");
  const [accountAge, setAccountAge] = useState("120");
  const [mcc, setMcc] = useState("5411");
  const [isVpn, setIsVpn] = useState(false);
  const [ipAddress, setIpAddress] = useState("103.108.140.15");
  const [terminalId, setTerminalId] = useState(
    "POS-DHAKA-GULSHAN-01",
  );
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] =
    useState<ManualTransactionResult | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;

    api
      .get("/api/v1/auth/me")
      .then(() => setAuthenticated(true))
      .catch(() => localStorage.removeItem("access_token"));
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await api.post("/api/v1/auth/login", {
        username,
        password,
      });
      localStorage.setItem(
        "access_token",
        response.data.access_token,
      );
      setAuthenticated(true);
      setShowLogin(false);
      setPassword("");
      setMessage("");
    } catch (caught) {
      const detail = axios.isAxiosError<{ detail?: string }>(
        caught,
      )
        ? caught.response?.data?.detail
        : undefined;
      setMessage(detail || "Login failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setAuthenticated(false);
  };

  const applyPreset = (type: "normal" | "cashout" | "fraud") => {
    if (type === "normal") {
      setAmount("450");
      setTxType("2");
      setAccountAge("365");
      setMcc("5411");
      setIsVpn(false);
      setIpAddress("103.108.140.15");
      setTerminalId("POS-AGORA-DHANMONDI");
    } else if (type === "cashout") {
      setAmount("18500");
      setTxType("1");
      setAccountAge("45");
      setMcc("6011");
      setIsVpn(false);
      setIpAddress("118.179.220.10");
      setTerminalId("AGENT-MFS-CTG-09");
    } else {
      setAmount("48000");
      setTxType("0");
      setAccountAge("1");
      setMcc("7995");
      setIsVpn(true);
      setIpAddress("185.220.101.5");
      setTerminalId("WEB-GATEWAY-RISK-00");
    }

    setLastTx(null);
    setFeedbackMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!authenticated) {
      setShowLogin(true);
      return;
    }

    setLoading(true);
    setLastTx(null);
    setMessage("");

    const stan = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const rrn = `3019${Math.floor(
      10000000 + Math.random() * 90000000,
    )}`;

    try {
      const response = await api.post<ManualTransactionResult>(
        "/api/v1/transaction/inject",
        {
          amount: Number(amount),
          tx_type: Number(txType),
          account_age_days: Number(accountAge),
          metadata: {
            stan,
            rrn,
            mcc,
            terminal_id: terminalId,
            device_id: `IMEI-${Math.floor(
              100000000000000 + Math.random() * 900000000000000,
            )}`,
            ip_address: ipAddress,
            is_vpn: isVpn,
            location: isVpn ? "Unknown / Masked" : "Bangladesh",
          },
        },
      );
      setLastTx(response.data);
    } catch (caught) {
      if (
        axios.isAxiosError(caught) &&
        caught.response?.status === 401
      ) {
        logout();
        setShowLogin(true);
        setMessage("Operator session expired.");
      } else {
        setMessage(
          "Transmission failed. Check the backend connection and submitted values.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (reviewedLabel: "heavy" | "light") => {
    if (!lastTx) return;
    try {
      await api.post("/api/v1/ai/feedback", {
        event_uid: lastTx.event_uid,
        reviewed_label: reviewedLabel,
      });
      setFeedbackMessage(`Saved human label: ${reviewedLabel}`);
    } catch {
      setFeedbackMessage("Could not save feedback.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-y-auto">
      <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono font-bold text-slate-300 tracking-wider">
            FINCLUSTER CLIENT PORTAL
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={
              authenticated ? logout : () => setShowLogin(true)
            }
            className="bg-slate-900 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2"
          >
            {authenticated ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            {authenticated ? "Sign out" : "Operator login"}
          </button>
          <Link
            className="bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 px-4 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2"
            href="/"
          >
            Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(30,41,59,0.5)] my-16 relative">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-wide text-white">
                FinCluster Pay
              </h2>
              <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Public switch telemetry
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
              authenticated
                ? "text-emerald-300 border-emerald-700 bg-emerald-950"
                : "text-amber-300 border-amber-700 bg-amber-950"
            }`}
          >
            {authenticated ? "OPERATOR" : "READ ONLY"}
          </span>
        </div>

        <div className="mb-5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Instant Demo Scenarios
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Preset
              label="Normal Pay"
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => applyPreset("normal")}
            />
            <Preset
              label="Agent Cash"
              icon={<Cpu className="w-4 h-4" />}
              onClick={() => applyPreset("cashout")}
            />
            <Preset
              label="Tor Wire"
              icon={<ShieldAlert className="w-4 h-4" />}
              onClick={() => applyPreset("fraud")}
              danger
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 font-mono text-xs"
        >
          <Field label="Transfer Amount (BDT)">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="input-style"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Transaction Type">
              <select
                value={txType}
                onChange={(event) => setTxType(event.target.value)}
                className="input-style"
              >
                <option value="0">Send Money</option>
                <option value="1">Cash Out</option>
                <option value="2">Merchant Pay</option>
              </select>
            </Field>
            <Field label="Merchant MCC">
              <select
                value={mcc}
                onChange={(event) => setMcc(event.target.value)}
                className="input-style"
              >
                <option value="5411">5411 Grocery</option>
                <option value="6011">6011 Cash</option>
                <option value="4814">4814 Top-up</option>
                <option value="7995">7995 High-risk</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Age (Days)">
              <input
                type="number"
                min="0"
                value={accountAge}
                onChange={(event) =>
                  setAccountAge(event.target.value)
                }
                className="input-style"
              />
            </Field>
            <Field label="Terminal ID">
              <input
                value={terminalId}
                onChange={(event) =>
                  setTerminalId(event.target.value)
                }
                className="input-style"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="col-span-2">
              <Field label="Origin IP">
                <input
                  value={ipAddress}
                  onChange={(event) =>
                    setIpAddress(event.target.value)
                  }
                  className="input-style"
                />
              </Field>
            </div>
            <label className="flex items-center gap-1.5 mt-4 bg-slate-950 p-2 rounded-xl border border-slate-800 justify-center">
              <input
                type="checkbox"
                checked={isVpn}
                onChange={(event) => setIsVpn(event.target.checked)}
                className="w-4 h-4 accent-rose-500"
              />
              <Globe className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400 font-bold">VPN</span>
            </label>
          </div>

          {message && (
            <p className="p-2 rounded border border-amber-800 bg-amber-950/50 text-amber-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-sans font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scoring and routing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Transmit to FinCluster Switch
              </>
            )}
          </button>
        </form>

        {lastTx && (
          <div
            className={`mt-5 p-3.5 rounded-2xl border ${
              lastTx.is_heavy
                ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
                : "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1.5">
                {lastTx.is_heavy ? (
                  <AlertOctagon className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {lastTx.task_path}
              </span>
              <span className="text-[10px] opacity-80">
                RRN {lastTx.rrn}
              </span>
            </div>
            <p className="text-[10px] mt-2 text-cyan-300">
              Engine: {lastTx.model_name}
              {lastTx.fallback_reason ? " (local fallback)" : ""}
            </p>
            <p className="text-[11px] mt-2">
              Risk {lastTx.risk_score}:{" "}
              {lastTx.risk_factors.length
                ? lastTx.risk_factors
                    .map(
                      (factor) =>
                        `${factor.label} +${factor.points}`,
                    )
                    .join(", ")
                : "no elevated factors"}
            </p>
            <p className="text-[11px] mt-2 border-t border-white/10 pt-2 font-bold">
              Actual route: {lastTx.route.node_name || "FAILED"}
            </p>
            <p className="text-[10px] mt-1 opacity-90">
              {lastTx.route.reason}
            </p>
            {lastTx.fallback_reason && (
              <p className="text-[10px] mt-2 text-amber-300">
                External API fallback: {lastTx.fallback_reason}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 text-[10px]">
              <span className="opacity-75">Human label:</span>
              <button
                type="button"
                onClick={() => submitFeedback("heavy")}
                className="px-2 py-1 rounded bg-rose-950 border border-rose-700"
              >
                Heavy
              </button>
              <button
                type="button"
                onClick={() => submitFeedback("light")}
                className="px-2 py-1 rounded bg-emerald-950 border border-emerald-700"
              >
                Light
              </button>
              {feedbackMessage && <span>{feedbackMessage}</span>}
            </div>
          </div>
        )}
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={login}
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h3 className="font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              Operator Login
            </h3>
            <p className="text-xs text-slate-400">
              Viewing is public; transaction injection requires an
              operator token.
            </p>
            {message && (
              <p className="text-xs text-red-300">{message}</p>
            )}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="input-style"
              placeholder="Username"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="input-style"
              placeholder="Password"
            />
            <div className="flex gap-2">
              <button className="flex-1 bg-blue-600 rounded py-2 text-sm font-bold">
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="px-4 bg-slate-800 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Preset({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-1 border rounded-lg text-xs font-bold flex flex-col items-center gap-1 ${
        danger
          ? "bg-rose-950/40 border-rose-800 text-rose-400"
          : "bg-slate-900 border-slate-700 text-blue-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
