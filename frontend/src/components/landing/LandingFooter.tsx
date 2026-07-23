import Link from "next/link";
import { ExternalLink, Network } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-black text-white">FinCluster AI MVP</p>
            <p className="text-xs text-slate-500">
              Team DIU_Gurte_Aisi · AI-aware MFS routing simulator
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <a href="#top" className="transition hover:text-white">
            Top
          </a>
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
          <Link href="/simulator" className="transition hover:text-white">
            Simulator
          </Link>
          <a
            href="https://github.com/aqshanto/fincluster-ai-mvp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>

      <div className="border-t border-slate-900 px-4 py-4 text-center text-[11px] leading-5 text-slate-600">
        Synthetic baseline metrics and the current six-review sample are MVP
        evidence, not production banking performance claims.
      </div>
    </footer>
  );
}
