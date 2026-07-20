"use client";

import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { BenchmarkData } from "@/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface CostChartProps {
  runId: number;
  simTime: string;
  legacyCost: number;
  optimizedCost: number;
  savedCost: number;
  benchmark?: BenchmarkData;
}

interface CostSeries {
  labels: string[];
  legacy: number[];
  optimized: number[];
}

const emptySeries = (): CostSeries => ({
  labels: ["00:00"],
  legacy: [0],
  optimized: [0],
});

export default function CostChart({
  runId,
  simTime,
  legacyCost,
  optimizedCost,
  savedCost,
  benchmark,
}: CostChartProps) {
  const [series, setSeries] = useState<CostSeries>(emptySeries);

  // A backend run ID is the reset signal. Zero savings is a valid metric.
  useEffect(() => {
    setSeries(emptySeries());
  }, [runId]);

  useEffect(() => {
    const label = simTime.substring(0, 5);
    setSeries((current) => {
      const lastIndex = current.labels.length - 1;
      if (current.labels[lastIndex] === label) {
        const legacy = [...current.legacy];
        const optimized = [...current.optimized];
        legacy[lastIndex] = legacyCost;
        optimized[lastIndex] = optimizedCost;
        return { ...current, legacy, optimized };
      }

      const next: CostSeries = {
        labels: [...current.labels, label],
        legacy: [...current.legacy, legacyCost],
        optimized: [...current.optimized, optimizedCost],
      };

      if (next.labels.length <= 30) return next;
      return {
        labels: next.labels.slice(-30),
        legacy: next.legacy.slice(-30),
        optimized: next.optimized.slice(-30),
      };
    });
  }, [simTime, legacyCost, optimizedCost]);

  const data = {
    labels: series.labels,
    datasets: [
      {
        label: "Legacy Cost ($)",
        data: series.legacy,
        borderColor: "#ef4444",
        backgroundColor: "#ef4444",
        borderWidth: 2,
        pointRadius: 1.5,
        tension: 0.3,
      },
      {
        label: "AI Cost ($)",
        data: series.optimized,
        borderColor: "#10b981",
        backgroundColor: "#10b981",
        borderWidth: 2,
        pointRadius: 1.5,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: { color: "#cbd5e1", font: { size: 10 } },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(51, 65, 85, 0.3)" },
        ticks: { color: "#94a3b8", font: { size: 9 }, maxTicksLimit: 6 },
      },
      y: {
        grid: { color: "rgba(51, 65, 85, 0.3)" },
        ticks: {
          color: "#94a3b8",
          font: { size: 10 },
          callback: (value: string | number) => `$${value}`,
        },
      },
    },
    animation: { duration: 250 },
  };

  return (
    <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500 pointer-events-auto shadow-lg">
      <div className="flex justify-between items-start mb-1">
        <div>
          <h3 className="text-white font-semibold text-sm">Fair Benchmark</h3>
          <p className="text-[10px] text-slate-400">
            Same seeded transactions and service rates
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
            Total Saved
          </p>
          <p className="text-xl font-bold text-emerald-400 metric-value">
            ${savedCost.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="w-full h-32 mt-1">
        <Line data={data} options={options} />
      </div>

      {benchmark && (
        <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr] text-[9px] font-mono border-t border-slate-700/70 pt-2 gap-y-1">
          <span className="text-slate-500">Metric</span>
          <span className="text-emerald-400 text-right">AI</span>
          <span className="text-red-400 text-right">Legacy</span>
          <MetricRow label="P95 latency" ai={`${benchmark.ai.p95_latency_ms} ms`} legacy={`${benchmark.legacy.p95_latency_ms} ms`} />
          <MetricRow label="Failures" ai={benchmark.ai.failures} legacy={benchmark.legacy.failures} />
          <MetricRow label="Throughput" ai={`${benchmark.ai.throughput_tx_per_min}/min`} legacy={`${benchmark.legacy.throughput_tx_per_min}/min`} />
          <MetricRow label="Max temp" ai={`${benchmark.ai.max_temperature_c}°C`} legacy={`${benchmark.legacy.max_temperature_c}°C`} />
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  ai,
  legacy,
}: {
  label: string;
  ai: React.ReactNode;
  legacy: React.ReactNode;
}) {
  return (
    <>
      <span className="text-slate-400">{label}</span>
      <span className="text-right">{ai}</span>
      <span className="text-right">{legacy}</span>
    </>
  );
}
