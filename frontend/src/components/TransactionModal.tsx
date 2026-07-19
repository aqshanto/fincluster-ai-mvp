"use client";
import React, { useState } from "react";
import {
  X,
  Send,
  ShieldAlert,
  CheckCircle2,
  Globe,
  Terminal,
  Cpu,
} from "lucide-react";
import api from "@/services/api";

interface TransactionModalProps {
  onClose: () => void;
}

export default function TransactionModal({ onClose }: TransactionModalProps) {
  const [amount, setAmount] = useState("1500");
  const [txType, setTxType] = useState("0"); // 0: Send Money, 1: Cashout, 2: Payment
  const [accountAge, setAccountAge] = useState("120");
  const [mcc, setMcc] = useState("5411"); // 5411: Grocery, 6011: ATM, 7995: Gambling
  const [isVpn, setIsVpn] = useState(false);
  const [ipAddress, setIpAddress] = useState("103.108.140.15 (Dhaka, BD)");
  const [terminalId, setTerminalId] = useState("POS-DHAKA-GULSHAN-01");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // ⚠️ ১-ক্লিক ম্যাজিক প্রিসেট (হ্যাক্যাথনে দ্রুত ডেমো দেখানোর জন্য)
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
      setAccountAge("1"); // ১ দিনের নতুন অ্যাকাউন্ট (Suspicious!)
      setMcc("7995"); // Gambling / Crypto Wire
      setIsVpn(true); // VPN Active!
      setIpAddress("185.220.101.5 (Tor Exit Node / Russia)");
      setTerminalId("WEB-GATEWAY-DARK-00");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // রিয়েল-ওয়ার্ল্ড মেটাডেটা তৈরি
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
      setLastResult(res.data.decision);
    } catch (err) {
      alert("Failed to inject transaction. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-50 pointer-events-auto animate-fade-in">
      <div className="glass-panel p-6 rounded-2xl w-130 border border-slate-700 shadow-2xl bg-slate-900/95 text-slate-100 relative">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 border border-blue-500 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Real-World MFS Transaction Switch
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                ISO-8583 / ISO-20022 Metadata Injector
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

        {/* ⚠️ ১-ক্লিক হ্যাক্যাথন ডেমো প্রিসেট */}
        <div className="mb-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            ⚡ Quick Demo Scenarios (1-Click Fill)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset("normal")}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-medium text-emerald-400 flex items-center justify-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Normal Pay ($450)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("cashout")}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-medium text-blue-400 flex items-center justify-center gap-1.5 transition-all"
            >
              <Cpu className="w-3.5 h-3.5" /> Agent Cash ($18.5k)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("fraud")}
              className="py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700 rounded text-xs font-bold text-rose-400 flex items-center justify-center gap-1.5 transition-all animate-pulse"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> 3AM Tor Wire ($48k)
            </button>
          </div>
        </div>

        {/* ফর্ম */}
        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">
                Amount ($ USD)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white focus:border-blue-500 outline-none font-bold"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white focus:border-blue-500 outline-none"
              >
                <option value="0">0 - Send Money (P2P)</option>
                <option value="1">1 - Cash Out (Agent/ATM)</option>
                <option value="2">2 - Merchant Payment (POS)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">
                MCC (Merchant Category Code)
              </label>
              <select
                value={mcc}
                onChange={(e) => setMcc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white focus:border-blue-500 outline-none"
              >
                <option value="5411">5411 - Supermarket / Grocery</option>
                <option value="6011">
                  6011 - Automated Cash Disburse (ATM)
                </option>
                <option value="4814">4814 - Telecommunication / TopUp</option>
                <option value="7995">
                  7995 - Gambling / Crypto Exchange ⚠️
                </option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">
                Account Age (Days)
              </label>
              <input
                type="number"
                value={accountAge}
                onChange={(e) => setAccountAge(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center pt-1">
            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">
                Origin IP Address & ISP
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 text-[11px] outline-none"
              />
            </div>
            <div className="flex items-center gap-2 mt-4 bg-slate-950 p-2 rounded border border-slate-800">
              <input
                type="checkbox"
                id="vpn"
                checked={isVpn}
                onChange={(e) => setIsVpn(e.target.checked)}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
              <label
                htmlFor="vpn"
                className="text-rose-400 font-bold cursor-pointer flex items-center gap-1"
              >
                <Globe className="w-3.5 h-3.5" /> VPN / Tor
              </label>
            </div>
          </div>

          {/* Result Box */}
          {lastResult && (
            <div className="mt-3 p-2.5 bg-blue-950/80 border border-blue-500/50 rounded-lg text-blue-200 text-[11px] leading-relaxed animate-fade-in">
              <span className="font-bold text-white uppercase block mb-0.5">
                ⚡ Switch Execution Log:
              </span>
              {lastResult}
            </div>
          )}

          <div className="pt-3 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold py-2.5 rounded-lg text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>
                {loading
                  ? "Transmitting to Switch..."
                  : "Inject Transaction into Cluster"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
