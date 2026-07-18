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
  aiEnabled?: boolean; // ⚠️ নতুন প্রপস যুক্ত করা হয়েছে
}

export default function CostChart({
  simTime,
  savedCost,
  aiEnabled = true,
}: CostChartProps) {
  const [labels, setLabels] = useState<string[]>([]);
  const [legacyData, setLegacyData] = useState<number[]>([]);
  const [aiData, setAiData] = useState<number[]>([]);

  // useRef ব্যবহার করছি যাতে setInterval-এর ভেতরে সবসময় লেটেস্ট ডেটা পাওয়া যায়
  const simTimeRef = useRef(simTime);
  const savedCostRef = useRef(savedCost);
  const aiEnabledRef = useRef(aiEnabled);

  useEffect(() => {
    simTimeRef.current = simTime;
    savedCostRef.current = savedCost;
    aiEnabledRef.current = aiEnabled;

    // ⚠️ FOOLPROOF RESET DETECTION:
    // simTime (যেমন: "00:00:01") থেকে মোট সেকেন্ড বের করা হচ্ছে
    const parts = simTime.split(":").map(Number);
    const totalSeconds =
      (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);

    // যদি সময় ৩ সেকেন্ডের কম হয় (অর্থাৎ Reset বাটন চাপলে), গ্রাফ একদম জিরো হয়ে যাবে!
    if (totalSeconds <= 2) {
      setLabels(["00:00"]);
      setLegacyData([0]);
      setAiData([0]);
    }
  }, [simTime, savedCost, aiEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = simTimeRef.current;
      if (!currentTime) return;

      // সময় যদি ০ থাকে (সবেমাত্র Reset করা হলে) নতুন পয়েন্ট অ্যাড করবে না
      const parts = currentTime.split(":").map(Number);
      const totalSeconds =
        (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      if (totalSeconds <= 2) return;

      const timeLabel = currentTime.substring(0, 5);

      setLabels((prev) => {
        if (prev[prev.length - 1] === timeLabel) return prev;
        const next = [...prev, timeLabel];
        return next.length > 30 ? next.slice(1) : next;
      });

      // ⚠️ গাণিতিক হিসাব (MATHEMATICAL CALCULATION LOGIC) ⚠️
      // ১. Legacy Cost সবসময় সাধারণ নিয়মে বাড়বে (যেমন: প্রতি ৩০ মিনিটে ১.০ থেকে ১.৪ ডলার)
      let currentLegacyInc = 0;
      setLegacyData((prev) => {
        const lastVal = prev[prev.length - 1] || 0;
        currentLegacyInc = 1.0 + Math.random() * 0.4;
        const next = [...prev, Number((lastVal + currentLegacyInc).toFixed(2))];
        return next.length > 30 ? next.slice(1) : next;
      });

      // ২. AI Cost নির্ভর করবে AI চালু আছে নাকি বন্ধ তার ওপর!
      setAiData((prev) => {
        const lastVal = prev[prev.length - 1] || 0;
        let aiInc = 0;

        if (aiEnabledRef.current) {
          // AI ON থাকলে: অপটিমাইজেশন হবে, তাই খরচ Legacy খরচের মাত্র ২৫% হবে (লাইন দুটি দুই দিকে যাবে)
          aiInc = currentLegacyInc * 0.25;
        } else {
          // AI OFF থাকলে: সিস্টেম সাধারণ Legacy নিয়মে চলবে, তাই খরচ Legacy খরচের একদম সমান হবে (লাইন প্যারালাল চলবে)
          aiInc = currentLegacyInc;
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
    animation: { duration: 400 },
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
