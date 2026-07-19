"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface CostChartProps {
  simTime: string;
  savedCost: number;
  aiEnabled?: boolean;
}

export default function CostChart({ simTime, savedCost, aiEnabled = true }: CostChartProps) {
  const [labels, setLabels] = useState<string[]>(["00:00"]);
  const [legacyData, setLegacyData] = useState<number[]>([0]);
  const [aiData, setAiData] = useState<number[]>([0]);

  const simTimeRef = useRef(simTime);
  const savedCostRef = useRef(savedCost);
  const aiEnabledRef = useRef(aiEnabled);

  useEffect(() => {
    simTimeRef.current = simTime;
    savedCostRef.current = savedCost;
    aiEnabledRef.current = aiEnabled;

    // ⚠️ 100% BULLETPROOF GRAPH RESET FIX:
    // যখনই savedCost শূন্য (0) হবে অথবা সময় 00:00:00 হবে, সাথে সাথে গ্রাফ মুছে যাবে!
    const parts = simTime.split(":").map(Number);
    const totalSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);

    if (savedCost === 0 || totalSeconds <= 2 || simTime === "00:00:00") {
      setLabels(["00:00"]);
      setLegacyData([0]);
      setAiData([0]);
    }
  }, [simTime, savedCost, aiEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = simTimeRef.current;
      if (!currentTime) return;

      const parts = currentTime.split(":").map(Number);
      const totalSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);

      // যদি সিস্টেম সদ্য রিসেট করা হয়, তবে নতুন ডেটা পুশ করবে না
      if (savedCostRef.current === 0 || totalSeconds <= 2 || currentTime === "00:00:00") {
        setLabels(["00:00"]);
        setLegacyData([0]);
        setAiData([0]);
        return;
      }

      const timeLabel = currentTime.substring(0, 5);

      setLabels((prev) => {
        if (prev[prev.length - 1] === timeLabel) return prev;
        const next = [...prev, timeLabel];
        return next.length > 30 ? next.slice(1) : next;
      });

      let currentLegacyInc = 0;
      setLegacyData((prev) => {
        const lastVal = prev[prev.length - 1] || 0;
        currentLegacyInc = 1.0 + Math.random() * 0.4;
        const next = [...prev, Number((lastVal + currentLegacyInc).toFixed(2))];
        return next.length > 30 ? next.slice(1) : next;
      });

      setAiData((prev) => {
        const lastVal = prev[prev.length - 1] || 0;
        let aiInc = 0;

        if (aiEnabledRef.current) {
          aiInc = currentLegacyInc * 0.25; // AI ON: খরচ ৭৫% কম বাড়বে
        } else {
          aiInc = currentLegacyInc; // AI OFF: Legacy খরচের সমান বাড়বে (Parallel)
        }

        const next = [...prev, Number((lastVal + aiInc).toFixed(2))];
        return next.length > 30 ? next.slice(1) : next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const data = {
    labels,
    datasets: [
      {
        label: "Legacy Cost ($)",
        data: legacyData,
        borderColor: "#ef4444",
        backgroundColor: "#ef4444",
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        tension: 0.3,
      },
      {
        label: "AI Cost ($)",
        data: aiData,
        borderColor: "#10b981",
        backgroundColor: "#10b981",
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 4,
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
          callback: (value: any) => "$" + value,
        },
      },
    },
    animation: { duration: 300 },
  };

  return (
    <div className="glass-panel p-5 rounded-xl border-l-4 border-l-emerald-500 pointer-events-auto shadow-lg">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-white font-semibold text-sm">Cost Analytics</h3>
          <p className="text-[10px] text-slate-400">
            Legacy vs AI Optimized ($)
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
      <div className="w-full h-40 mt-2">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}