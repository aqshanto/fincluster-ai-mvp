"use client";

import React, { useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Globe,
  Send,
  ShieldAlert,
  Terminal,
  X,
} from "lucide-react";
import api from "@/services/api";
import { ManualTransactionResult } from "@/types";

interface TransactionModalProps {
  onClose: () => void;
  onUnauthorized: () => void;
}

export default function TransactionModal({
  onClose,
  onUnauthorized,
}: TransactionModalProps) {
  const [amount, setAmount] = useState("1500");
  const [txType, setTxType] = useState("0");
  const [accountAge, setAccountAge] = useState("120");
  const [mcc, setMcc] = useState("5411");
  const [isVpn, setIsVpn] = useState(false);
  const [forceHumanReview, setForceHumanReview] = useState(false);
  const [ipAddress, setIpAddress] = useState("103.108.140.15");
  const [terminalId, setTerminalId] = useState("POS-DHAKA-GULSHAN-01");
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [lastResult, setLastResult] =
    useState<ManualTransactionResult | null>(null);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

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

    setLastResult(null);
    setError("");
    setFeedbackMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setLastResult(null);
    setError("");
    setFeedbackMessage("");

    const stan = Math.floor(100000 + Math.random() * 900000).toString();
    const rrn = `3019${Math.floor(10000000 + Math.random() * 90000000)}`;

    try {
      const response = await api.post<ManualTransactionResult>(
        "/api/v1/transaction/inject",
        {
          amount: Number(amount),
          tx_type: Number(txType),
          account_age_days: Number(accountAge),
          force_human_review: forceHumanReview,
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

      setLastResult(response.data);
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }

      const message = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setError(message || "Transaction injection failed.");
    } finally {
      setLoading(false);
    }
  };

  const submitHumanDecision = async (
    reviewedLabel: "heavy" | "light",
  ) => {
    if (!lastResult) return;
    setReviewing(true);
    setFeedbackMessage("");
    try {
      if (lastResult.status === "pending_review") {
        const response = await api.post<ManualTransactionResult>(
          "/api/v1/ai/reviews/resolve",
          {
            event_uid: lastResult.event_uid,
            reviewed_label: reviewedLabel,
          },
        );
        setLastResult(response.data);
        setFeedbackMessage(
          response.data.prediction_correct
            ? `Human review confirmed ${reviewedLabel}; the task is now routed.`
            : `Human review corrected the model to ${reviewedLabel}; the task is now routed.`,
        );
      } else {
        const response = await api.post<{
          prediction_correct: boolean;
        }>("/api/v1/ai/feedback", {
          event_uid: lastResult.event_uid,
          reviewed_label: reviewedLabel,
        });
        setFeedbackMessage(
          response.data.prediction_correct
            ? `Saved label: ${reviewedLabel} (model confirmed).`
            : `Saved correction: ${reviewedLabel} (model was wrong).`,
        );
      }
    } catch (caught) {
      if (axios.isAxiosError(caught) && caught.response?.status === 401) {
        onUnauthorized();
        return;
      }
      const message = axios.isAxiosError<{ detail?: string }>(caught)
        ? caught.response?.data?.detail
        : undefined;
      setFeedbackMessage(message || "Could not save the human decision.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto animate-fade-in">
      <div className="glass-panel relative max-h-[92vh] w-140 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-blue-500 bg-blue-600/20 p-2">
              <Terminal className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                MFS Transaction Switch
              </h3>
              <p className="font-mono text-[10px] text-slate-400">
                ML classification, optional human gate, and actual routing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 p-1 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick demo scenarios
          </label>
          <div className="grid grid-cols-3 gap-2">
            <PresetButton
              onClick={() => applyPreset("normal")}
              label="Normal Pay"
              detail="BDT 450"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <PresetButton
              onClick={() => applyPreset("cashout")}
              label="Agent Cash"
              detail="BDT 18.5k"
              icon={<Cpu className="h-3.5 w-3.5" />}
            />
            <PresetButton
              onClick={() => applyPreset("fraud")}
              label="Tor Wire"
              detail="BDT 48k"
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              danger
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (BDT)">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="input-style"
              />
            </Field>
            <Field label="Transaction Type">
              <select
                value={txType}
                onChange={(event) => setTxType(event.target.value)}
                className="input-style"
              >
                <option value="0">0 - Send Money</option>
                <option value="1">1 - Cash Out</option>
                <option value="2">2 - Merchant Payment</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Merchant Category (MCC)">
              <select
                value={mcc}
                onChange={(event) => setMcc(event.target.value)}
                className="input-style"
              >
                <option value="5411">5411 - Grocery</option>
                <option value="6011">6011 - ATM / Cash</option>
                <option value="4814">4814 - Mobile Top-up</option>
                <option value="7995">7995 - High-risk / Gambling</option>
              </select>
            </Field>
            <Field label="Account Age (Days)">
              <input
                type="number"
                min="0"
                value={accountAge}
                onChange={(event) => setAccountAge(event.target.value)}
                className="input-style"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Terminal ID">
              <input
                value={terminalId}
                onChange={(event) => setTerminalId(event.target.value)}
                className="input-style"
              />
            </Field>
            <Field label="Origin IP">
              <input
                value={ipAddress}
                onChange={(event) => setIpAddress(event.target.value)}
                className="input-style"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex w-fit items-center gap-2 rounded border border-slate-800 bg-slate-950 p-2">
              <input
                type="checkbox"
                checked={isVpn}
                onChange={(event) => setIsVpn(event.target.checked)}
                className="h-4 w-4 accent-rose-500"
              />
              <Globe className="h-3.5 w-3.5 text-rose-400" />
              <span className="font-bold text-rose-400">VPN / Tor origin</span>
            </label>

            <label className="flex w-fit items-center gap-2 rounded border border-amber-800 bg-amber-950/40 p-2">
              <input
                type="checkbox"
                checked={forceHumanReview}
                onChange={(event) => setForceHumanReview(event.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              <ClipboardCheck className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-bold text-amber-300">Force human review</span>
            </label>
          </div>

          {error && (
            <p className="rounded border border-red-800 bg-red-950/60 p-2 text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-sans font-bold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {loading ? "Scoring transaction..." : "Inject Transaction"}
          </button>
        </form>

        {lastResult && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-xs">
            {lastResult.status === "pending_review" && (
              <div className="mb-3 rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-amber-100">
                <p className="flex items-center gap-2 font-bold text-amber-300">
                  <ClipboardCheck className="h-4 w-4" />
                  Held for human review — no node has processed this task
                </p>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {lastResult.review_reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{lastResult.task_path}</p>
                <p className="mt-0.5 text-slate-400">
                  Engine: <span className="text-cyan-300">{lastResult.model_name}</span>
                  {lastResult.fallback_reason ? " (local fallback)" : ""}
                </p>
                <p className="mt-0.5 text-slate-400">
                  Prediction: <span className="font-bold uppercase text-blue-300">{lastResult.predicted_label}</span>
                  {" · "}confidence {(lastResult.confidence * 100).toFixed(1)}%
                </p>
                <p className="mt-0.5 text-slate-400">
                  Risk score: <span className="font-bold text-amber-400">{lastResult.risk_score}</span>{" "}
                  ({lastResult.risk_level})
                </p>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {lastResult.rrn ? `RRN ${lastResult.rrn}` : lastResult.event_uid}
              </span>
            </div>

            <div className="mt-3 space-y-1">
              {lastResult.risk_factors.length > 0 ? (
                lastResult.risk_factors.map((factor) => (
                  <div
                    key={`${factor.code}-${factor.detail}`}
                    className="flex justify-between gap-3 border-b border-slate-800 pb-1"
                  >
                    <span className="text-slate-300">{factor.label}</span>
                    <span className="font-bold text-rose-400">+{factor.points}</span>
                  </div>
                ))
              ) : (
                <p className="text-emerald-400">No elevated-risk factors</p>
              )}
            </div>

            {lastResult.fallback_reason && (
              <p className="mt-3 rounded border border-amber-800 bg-amber-950/50 p-2 text-amber-200">
                External API fallback: {lastResult.fallback_reason}
              </p>
            )}

            {lastResult.route && (
              <div className="mt-3 rounded border border-blue-800 bg-blue-950/50 p-2 text-blue-200">
                <p className="font-bold">
                  Actual {lastResult.strategy.toUpperCase()} route: {lastResult.route.node_name || "FAILED"}
                </p>
                <p className="mt-1 text-[11px]">{lastResult.route.reason}</p>
                <p className="mt-1 text-[11px]">
                  Estimated latency: {lastResult.route.estimated_latency_ms} ms
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-slate-500">
                {lastResult.status === "pending_review"
                  ? "Human routing decision:"
                  : "Human training label:"}
              </span>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void submitHumanDecision("heavy")}
                className="rounded border border-rose-800 bg-rose-950 px-2 py-1 text-rose-300 disabled:opacity-50"
              >
                Heavy
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void submitHumanDecision("light")}
                className="rounded border border-emerald-800 bg-emerald-950 px-2 py-1 text-emerald-300 disabled:opacity-50"
              >
                Light
              </button>
              {feedbackMessage && (
                <span className="text-cyan-300">{feedbackMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>
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
      <span className="mb-1 block text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function PresetButton({
  onClick,
  label,
  detail,
  icon,
  danger = false,
}: {
  onClick: () => void;
  label: string;
  detail: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded border px-2 py-2 text-xs font-medium transition-all ${
        danger
          ? "border-rose-700 bg-rose-950/60 text-rose-400 hover:bg-rose-900/80"
          : "border-slate-600 bg-slate-800 text-blue-300 hover:bg-slate-700"
      }`}
    >
      <span className="flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-[9px] text-slate-500">{detail}</span>
    </button>
  );
}
