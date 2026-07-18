import React from "react";
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

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 w-[300px] transition-all duration-300 shadow-lg pointer-events-auto">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-sm font-bold text-slate-200">{node.name}</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            CPU Load:{" "}
            <span>
              {node.status === "crashed" ? 0 : Math.floor(node.load)}%
            </span>
          </p>
        </div>
        <span className={`status-badge ${badgeClass}`}>{badgeText}</span>
      </div>

      <div className="bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${node.status === "crashed" ? 0 : node.load}%` }}
        ></div>
      </div>

      <div className="flex justify-between items-center mt-3 text-xs font-mono border-t border-slate-700/60 pt-2">
        <span
          className={`flex items-center gap-1 ${node.status === "crashed" ? "text-red-500 font-bold" : node.status === "warning" ? "text-amber-500" : "text-slate-400"}`}
        >
          <Thermometer className="w-3.5 h-3.5" />
          <span>{Math.floor(node.temp)}°C</span>
        </span>
        <span className="text-slate-300">
          Tasks: <span className="font-bold text-white">{node.assigned}</span>
        </span>
        <span className="text-slate-400 font-bold">
          ${currentCost.toFixed(2)}/hr
        </span>
      </div>
    </div>
  );
}
