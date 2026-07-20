"use client";

import React, { useState } from "react";
import axios from "axios";
import {
  X,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Globe,
  Send,
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
  const [ipAddress, setIpAddress] = useState("103.108.140.15");
  const [terminalId, setTerminalId] = useState(
    "POS-DHAKA-GULSHAN-01",
  );
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] =
    useState<ManualTransactionResult | null>(null);
  const [error, setError] = useState("");

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
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setLastResult(null);
    setError("");

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

      setLastResult(response.data);
    } catch (caught) {
      if (
        axios.isAxiosError(caught) &&
        caught.response?.status === 401
      ) {
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-50 pointer-events-auto animate-fade-in">
      <div className="glass-panel p-6 rounded-2xl w-140 max-h-[92vh] overflow-y-auto border border-slate-700 shadow-2xl bg-slate-900/95 text-slate-100 relative">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 border border-blue-500 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                MFS Transaction Switch
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Explainable risk scoring + actual routing result
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Quick demo scenarios
          </label>
          <div className="grid grid-cols-3 gap-2">
            <PresetButton
              onClick={() => applyPreset("normal")}
              label="Normal Pay"
              detail="BDT 450"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            />
            <PresetButton
              onClick={() => applyPreset("cashout")}
              label="Agent Cash"
              detail="BDT 18.5k"
              icon={<Cpu className="w-3.5 h-3.5" />}
            />
            <PresetButton
              onClick={() => applyPreset("fraud")}
              label="Tor Wire"
              detail="BDT 48k"
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
              danger
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 font-mono text-xs"
        >
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
                <option value="7995">
                  7995 - High-risk / Gambling
                </option>
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
                onChange={(event) =>
                  setTerminalId(event.target.value)
                }
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

          <label className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800 w-fit">
            <input
              type="checkbox"
              checked={isVpn}
              onChange={(event) => setIsVpn(event.target.checked)}
              className="w-4 h-4 accent-rose-500"
            />
            <Globe className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-400 font-bold">
              VPN / Tor origin
            </span>
          </label>

          {error && (
            <p className="p-2 bg-red-950/60 border border-red-800 rounded text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-sans font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? "Scoring and routing..." : "Inject Transaction"}
          </button>
        </form>

        {lastResult && (
          <div className="mt-4 bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-xs">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="font-bold text-white">
                  {lastResult.task_path}
                </p>
                <p className="text-slate-400 mt-0.5">
                  Risk score:{" "}
                  <span className="text-amber-400 font-bold">
                    {lastResult.risk_score}
                  </span>{" "}
                  ({lastResult.risk_level})
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                RRN {lastResult.rrn}
              </span>
            </div>

            <div className="mt-3 space-y-1">
              {lastResult.risk_factors.length > 0 ? (
                lastResult.risk_factors.map((factor) => (
                  <div
                    key={factor.code}
                    className="flex justify-between gap-3 border-b border-slate-800 pb-1"
                  >
                    <span className="text-slate-300">
                      {factor.label}
                    </span>
                    <span className="text-rose-400 font-bold">
                      +{factor.points}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-emerald-400">
                  No elevated-risk factors
                </p>
              )}
            </div>

            <div className="mt-3 p-2 rounded bg-blue-950/50 border border-blue-800 text-blue-200">
              <p className="font-bold">
                Actual {lastResult.strategy.toUpperCase()} route:{" "}
                {lastResult.route.node_name || "FAILED"}
              </p>
              <p className="mt-1 text-[11px]">
                {lastResult.route.reason}
              </p>
              <p className="mt-1 text-[11px]">
                Estimated latency:{" "}
                {lastResult.route.estimated_latency_ms} ms
              </p>
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
      <span className="text-slate-400 block mb-1">{label}</span>
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
      className={`py-2 px-2 border rounded text-xs font-medium flex flex-col items-center gap-1 transition-all ${
        danger
          ? "bg-rose-950/60 hover:bg-rose-900/80 border-rose-700 text-rose-400"
          : "bg-slate-800 hover:bg-slate-700 border-slate-600 text-blue-300"
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
