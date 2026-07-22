import Link from "next/link";
import { Activity, ArrowUpRight, Network, Send } from "lucide-react";

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-300">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black tracking-tight text-white">FinCluster AI</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Hackathon MVP
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-bold text-slate-400 lg:flex">
          <a href="#problem" className="transition hover:text-white">
            Problem
          </a>
          <a href="#workflow" className="transition hover:text-white">
            How it works
          </a>
          <a href="#models" className="transition hover:text-white">
            AI lifecycle
          </a>
          <a href="#evidence" className="transition hover:text-white">
            Evidence
          </a>
          <a href="#limitations" className="transition hover:text-white">
            Limitations
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/simulator"
            className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-200 sm:inline-flex"
          >
            <Send className="h-3.5 w-3.5" />
            Simulator
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-400 bg-blue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-400"
          >
            <Activity className="h-3.5 w-3.5" />
            Dashboard
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
