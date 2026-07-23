import { Thermometer } from "lucide-react";

import { NodeStatus } from "@/types";

interface NodeCardProps {
  node: NodeStatus;
}

export default function NodeCard({ node }: NodeCardProps) {
  const isStandby = node.status === "standby";
  const currentCost = isStandby ? node.costStandby : node.costActive;

  let badgeClass = "bg-healthy";
  let badgeText = "HEALTHY";
  let barColor = "bg-emerald-500";

  if (node.status === "crashed") {
    badgeClass = "bg-crashed";
    badgeText = "CRASHED";
    barColor = "bg-red-500";
  } else if (node.status === "warning") {
    badgeClass = "bg-warning";
    badgeText = "WARNING (Rerouting)";
    barColor = "bg-amber-500";
  } else if (node.status === "standby") {
    badgeClass = "bg-standby";
    badgeText = "STANDBY (Sleep)";
    barColor = "bg-slate-600";
  } else if (node.load > 70) {
    barColor = "bg-amber-500";
  }

  const visibleLoad = node.status === "crashed" ? 0 : Math.floor(node.load);

  return (
    <article className="pointer-events-auto w-full rounded-xl border border-slate-700 bg-slate-900/90 p-4 shadow-lg transition-all duration-300">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-200 sm:text-base lg:text-sm">
            {node.name}
          </h4>
          <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs lg:text-[10px]">
            CPU Load: <span>{visibleLoad}%</span>
          </p>
        </div>

        <span className={`status-badge shrink-0 ${badgeClass}`}>
          {badgeText}
        </span>
      </div>

      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${visibleLoad}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-3 font-mono text-[11px] sm:text-xs lg:text-[11px]">
        <span
          className={`flex items-center gap-1 ${
            node.status === "crashed"
              ? "font-bold text-red-500"
              : node.status === "warning"
                ? "text-amber-500"
                : "text-slate-400"
          }`}
        >
          <Thermometer className="h-3.5 w-3.5" />
          {Math.floor(node.temp)}°C
        </span>

        <span className="text-center text-slate-300">
          Tasks: <strong className="text-white">{node.assigned}</strong>
        </span>

        <span className="text-right font-bold text-slate-400">
          ${currentCost.toFixed(2)}/hr
        </span>
      </div>
    </article>
  );
}
