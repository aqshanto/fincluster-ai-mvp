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
}

export default function CostChart({ simTime, savedCost }: CostChartProps) {
  const [labels, setLabels] = useState<string[]>([]);
  const [legacyData, setLegacyData] = useState<number[]>([]);
  const [aiData, setAiData] = useState<number[]>([]);

  // useRef ব্যবহার করছি যাতে setInterval-এর ভেতরে সবসময় লেটেস্ট ডেটা পাওয়া যায়
  const simTimeRef = useRef(simTime);
  const savedCostRef = useRef(savedCost);

  useEffect(() => {
    simTimeRef.current = simTime;
    savedCostRef.current = savedCost;
  }, [simTime, savedCost]);

  useEffect(() => {
    // প্রতি ৩ সেকেন্ড (৩০০০ms) পর পর চার্ট আপডেট হবে (যা সিমুলেটরের ঠিক ৩০ মিনিটের সমান)
    const interval = setInterval(() => {
      const currentTime = simTimeRef.current;
      if (!currentTime || currentTime === "00:00:00") return;

      // HH:MM ফরম্যাটে সময় নেওয়া হচ্ছে (যেমন: 12:00, 12:30, 13:00)
      const timeLabel = currentTime.substring(0, 5);

      setLabels((prev) => {
        if (prev[prev.length - 1] === timeLabel) return prev;
        const next = [...prev, timeLabel];
        // ঠিক ৩০টি পয়েন্ট দেখাবে, ৩০টির বেশি হলে বাম দিক থেকে ১টি করে সরে যাবে (Slide left)
        return next.length > 30 ? next.slice(1) : next;
      });

      setLegacyData((prev) => {
        // ৩০ মিনিটে সাধারণ (Legacy) সিস্টেমে খরচ একটু বেশি বাড়ে
        const lastVal = prev[prev.length - 1] || 0;
        const increment = 1.2 + Math.random() * 0.4;
        const next = [...prev, Number((lastVal + increment).toFixed(2))];
        return next.length > 30 ? next.slice(1) : next;
      });

      setAiData((prev) => {
        // ৩০ মিনিটে AI অপটিমাইজড সিস্টেমে খরচ অনেক কম বাড়ে
        const lastVal = prev[prev.length - 1] || 0;
        const increment = 0.3 + Math.random() * 0.15;
        const next = [...prev, Number((lastVal + increment).toFixed(2))];
        return next.length > 30 ? next.slice(1) : next;
      });
    }, 3000); // ঠিক ৩ সেকেন্ড পর পর লুপ চলবে

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
    animation: { duration: 400 }, // স্মুথ স্লাইডিং অ্যানিমেশন
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
            ${savedCostRef.current.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="w-full h-40 mt-2">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
