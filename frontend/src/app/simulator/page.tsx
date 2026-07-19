"use client";
import React, { useState } from "react";
import {
  Smartphone,
  Send,
  ShieldAlert,
  CheckCircle2,
  Globe,
  Terminal,
  Cpu,
  Wifi,
  ArrowRight,
  DollarSign,
  CreditCard,
  RefreshCw,
  CheckCircle,
  AlertOctagon,
} from "lucide-react";
import api from "@/services/api";
import Link from "next/link";

export default function TransactionSimulatorPage() {
  const [amount, setAmount] = useState("1500");
  const [txType, setTxType] = useState("0");
  const [accountAge, setAccountAge] = useState("120");
  const [mcc, setMcc] = useState("5411");
  const [isVpn, setIsVpn] = useState(false);
  const [ipAddress, setIpAddress] = useState("103.108.140.15 (Dhaka, BD)");
  const [terminalId, setTerminalId] = useState("POS-DHAKA-GULSHAN-01");
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<{
    status: string;
    decision: string;
    rrn: string;
    isHeavy: boolean;
  } | null>(null);

  // ১-ক্লিক ম্যাজিক প্রিসেট
  const applyPreset = (type: "normal" | "cashout" | "fraud") => {
    if (type === "normal") {
      setAmount("450");
      setTxType("2"); // Merchant Pay
      setAccountAge("365");
      setMcc("5411"); // Grocery
      setIsVpn(false);
      setIpAddress("103.108.140.15 (Dhaka, BD)");
      setTerminalId("POS-AGORA-DANMONDI");
    } else if (type === "cashout") {
      setAmount("18500");
      setTxType("1"); // Cashout
      setAccountAge("45");
      setMcc("6011"); // ATM / Agent
      setIsVpn(false);
      setIpAddress("118.179.220.10 (Chittagong, BD)");
      setTerminalId("AGENT-BKASH-CTG-09");
    } else if (type === "fraud") {
      setAmount("48000");
      setTxType("0"); // Send Money
      setAccountAge("1"); // ১ দিনের নতুন অ্যাকাউন্ট
      setMcc("7995"); // Gambling / Crypto
      setIsVpn(true); // VPN Active
      setIpAddress("185.220.101.5 (Tor Exit Node / Russia)");
      setTerminalId("WEB-GATEWAY-DARK-00");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLastTx(null);

    const stan = Math.floor(100000 + Math.random() * 900000).toString();
    const rrn =
      "3019" + Math.floor(10000000 + Math.random() * 90000000).toString();

    const payload = {
      amount: parseFloat(amount) || 1000,
      tx_type: parseInt(txType),
      account_age_days: parseInt(accountAge) || 30,
      metadata: {
        stan: stan,
        rrn: rrn,
        mcc: mcc,
        terminal_id: terminalId,
        device_id:
          "IMEI-86753090" + Math.floor(1000000 + Math.random() * 900000),
        ip_address: ipAddress,
        is_vpn: isVpn,
        location: isVpn
          ? "Unknown / Masked"
          : "23.8103° N, 90.4125° E (Bangladesh)",
      },
    };

    try {
      const res = await api.post("/api/v1/transaction/inject", payload);
      setLastTx({
        status: res.data.status,
        decision: res.data.decision,
        rrn: rrn,
        isHeavy: res.data.is_heavy,
      });
    } catch (err: any) {
      // ⚠️ এখন সাধারণ মেসেজের বদলে সার্ভার থেকে আসা আসল এররটি স্ক্রিনে দেখাবে!
      const errorDetails =
        err.response?.data?.detail ||
        err.response?.data ||
        err.message ||
        "Unknown Server Error";
      console.error("Full Error:", err);
      alert(
        `❌ Switch Transmission Failed!\n\nReason: ${JSON.stringify(errorDetails, null, 2)}\n\nTip: Check F12 Console for more info.`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans select-none relative overflow-y-auto">
      {/* Top Navigation Bar */}
      <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
          <span className="text-xs font-mono font-bold text-slate-300 tracking-wider">
            FINCLUSTER LIVE CLIENT PORTAL
          </span>
        </div>
        <Link
          href="/"
          className="bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 px-4 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-all shadow-lg hover:border-blue-500"
        >
          <span>Open Main Cluster Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* মোবাইল অ্যাপ / POS টার্মিনাল কার্ড */}
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(30,41,59,0.5)] my-12 relative">
        {/* Phone Header */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Smartphone className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-wide text-white">
                FinCluster Pay
              </h2>
              <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Connected to Central Switch
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 border border-slate-700">
            v1.0 (ISO-8583)
          </span>
        </div>

        {/* ⚡ Quick Hackathon Presets */}
        <div className="mb-5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
            ⚡ Instant Demo Scenarios
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset("normal")}
              className="py-2 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-emerald-400 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Normal Pay</span>
              <span className="text-[9px] text-slate-500">$450 Grocery</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset("cashout")}
              className="py-2 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-blue-400 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <Cpu className="w-4 h-4" />
              <span>Agent Cash</span>
              <span className="text-[9px] text-slate-500">$18.5k bKash</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset("fraud")}
              className="py-2 px-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 rounded-lg text-xs font-bold text-rose-400 flex flex-col items-center justify-center gap-1 transition-all animate-pulse active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Tor Wire</span>
              <span className="text-[9px] text-rose-300/60">$48k Crypto</span>
            </button>
          </div>
        </div>

        {/* ট্রানজিকশন ফর্ম */}
        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-slate-400 block mb-1">
              Transfer Amount ($ USD)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-bold text-sm focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500 outline-none"
              >
                <option value="0">0 - Send Money (P2P)</option>
                <option value="1">1 - Cash Out (Agent)</option>
                <option value="2">2 - Merchant Pay</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Merchant (MCC)
              </label>
              <select
                value={mcc}
                onChange={(e) => setMcc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500 outline-none"
              >
                <option value="5411">5411 - Grocery</option>
                <option value="6011">6011 - ATM Disburse</option>
                <option value="4814">4814 - Mobile TopUp</option>
                <option value="7995">7995 - Gambling ⚠️</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center pt-1">
            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">
                IP Address & ISP
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 text-[11px] outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-4 bg-slate-950 p-2 rounded-xl border border-slate-800 justify-center">
              <input
                type="checkbox"
                id="vpn_sim"
                checked={isVpn}
                onChange={(e) => setIsVpn(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
              <label
                htmlFor="vpn_sim"
                className="text-rose-400 font-bold cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <Globe className="w-3.5 h-3.5" /> VPN
              </label>
            </div>
          </div>

          {/* ট্রান্সমিট বাটন */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-sans font-bold py-3 rounded-xl text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transmitting to Cloud Switch...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmit to FinCluster Switch</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Feedback Toast */}
        {lastTx && (
          <div
            className={`mt-5 p-3.5 rounded-2xl border flex flex-col gap-1 animate-fade-in ${
              lastTx.isHeavy
                ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
                : "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1.5">
                {lastTx.isHeavy ? (
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                {lastTx.isHeavy
                  ? "ROUTED TO HEAVY GPU NODE"
                  : "ROUTED TO LIGHT FAST-PATH"}
              </span>
              <span className="text-[10px] font-mono opacity-80">
                RRN: {lastTx.rrn}
              </span>
            </div>
            <p className="text-[11px] font-mono opacity-90 leading-relaxed mt-1 border-t border-white/10 pt-1">
              {lastTx.decision}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 font-mono text-center max-w-sm">
        💡 Tip: Keep the main dashboard open on a separate screen or tab to
        watch the real-time node routing animations.
      </p>
    </div>
  );
}
