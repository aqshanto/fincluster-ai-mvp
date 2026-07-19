"use client";
import React, { useEffect, useRef } from "react";

interface SimulationCanvasProps {
  aiEnabled?: boolean;
  surgeActive?: boolean;
  nodes?: any[];
  aiDecision?: string;
  clusterOutage?: boolean;
  totalHeavy?: number; // ⚠️ নতুন প্রপস: লাইভ Heavy টাস্ক সংখ্যা
  totalLight?: number; // ⚠️ নতুন প্রপস: লাইভ Light টাস্ক সংখ্যা
  telemetry?: any;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  type: "heavy" | "light";
  progress: number;
  speed: number;
  stage: 1 | 2; // stage 1: Left to Center, stage 2: Center to Right Nodes
  targetNodeIdx: number;
}

export default function SimulationCanvas({
  aiEnabled = true,
  surgeActive = false,
  nodes = [],
  clusterOutage = false,
  totalHeavy = 0,
  totalLight = 0,
  telemetry,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const prevHeavyRef = useRef<number>(totalHeavy);
  const prevLightRef = useRef<number>(totalLight);

  // যদি telemetry প্রপস হিসেবে আসে, তবে সেখান থেকে ভ্যালু নেবে
  const actualHeavy = telemetry?.total_heavy ?? totalHeavy;
  const actualLight = telemetry?.total_light ?? totalLight;
  const actualAiEnabled = telemetry?.ai_enabled ?? aiEnabled;
  const actualOutage = telemetry?.cluster_outage ?? clusterOutage;
  const actualNodes = telemetry?.nodes ?? nodes;

  // ⚠️ 100% LIVE TRANSACTION BALL SYNC FIX:
  // যখনই টাস্কের সংখ্যা বাড়বে, নতুন বল (Particle) তৈরি হবে!
  useEffect(() => {
    if (actualOutage) {
      particlesRef.current = []; // Outage হলে সব বল থেমে যাবে
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const deltaHeavy = actualHeavy - prevHeavyRef.current;
    const deltaLight = actualLight - prevLightRef.current;

    prevHeavyRef.current = actualHeavy;
    prevLightRef.current = actualLight;

    // Reset করা হলে বলগুলো ক্লিয়ার হয়ে যাবে
    if (actualHeavy === 0 && actualLight === 0) {
      particlesRef.current = [];
      return;
    }

    const startX = 250; // বামপাশের MFS App Users বক্সের অবস্থান
    const startY = canvas.height / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Heavy বল স্পন (সর্বোচ্চ একবারে ৬টি যাতে অ্যানিমেশন স্মুথ থাকে)
    if (deltaHeavy > 0) {
      const spawnCount = Math.min(deltaHeavy, 6);
      for (let i = 0; i < spawnCount; i++) {
        particlesRef.current.push({
          id: Math.random(),
          x: startX,
          y: startY,
          startX: startX,
          startY: startY,
          targetX: centerX,
          targetY: centerY,
          type: "heavy",
          progress: 0,
          speed: 0.02 + Math.random() * 0.015,
          stage: 1,
          targetNodeIdx: actualAiEnabled ? 0 : 0, // AI ON থাকলে Heavy যাবে Node 1-এ
        });
      }
    }

    // Light বল স্পন
    if (deltaLight > 0) {
      const spawnCount = Math.min(deltaLight, 6);
      for (let i = 0; i < spawnCount; i++) {
        particlesRef.current.push({
          id: Math.random(),
          x: startX,
          y: startY,
          startX: startX,
          startY: startY,
          targetX: centerX,
          targetY: centerY,
          type: "light",
          progress: 0,
          speed: 0.025 + Math.random() * 0.02,
          stage: 1,
          targetNodeIdx: actualAiEnabled ? 1 : 1, // AI ON থাকলে Light যাবে Node 2-এ
        });
      }
    }
  }, [actualHeavy, actualLight, actualOutage, actualAiEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = 260;
      const startY = canvas.height / 2;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const rightX = canvas.width - 260;
      const nodePositions = [
        { x: rightX, y: centerY - 130 }, // Node 1
        { x: rightX, y: centerY }, // Node 2
        { x: rightX, y: centerY + 130 }, // Node 3
      ];

      // ১. কানেকশন লাইন আঁকা (Connecting Lines)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";

      // Left to Center Line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(centerX, centerY);
      ctx.stroke();

      // Center to Right Nodes Lines
      nodePositions.forEach((pos, idx) => {
        const nodeStatus = actualNodes[idx]?.status;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle =
          nodeStatus === "crashed"
            ? "rgba(239, 68, 68, 0.3)"
            : "rgba(51, 65, 85, 0.4)";
        ctx.stroke();
      });

      // ২. বলগুলোর ৬০ এফপিএস অ্যানিমেশন (60 FPS Ball Animation)
      if (!actualOutage) {
        particlesRef.current.forEach((p, index) => {
          p.progress += p.speed;

          if (p.progress >= 1) {
            if (p.stage === 1) {
              // Stage 1 শেষ হলে Center থেকে Target Node-এর দিকে যাত্রা শুরু করবে
              p.stage = 2;
              p.progress = 0;
              p.startX = centerX;
              p.startY = centerY;

              let targetIdx = 0;
              if (actualAiEnabled) {
                targetIdx = p.type === "heavy" ? 0 : 1;
                if (actualNodes[targetIdx]?.status === "crashed") targetIdx = 2;
              } else {
                targetIdx = Math.floor(Math.random() * 3); // Blind Round Robin
              }
              p.targetNodeIdx = targetIdx;
              p.targetX = nodePositions[targetIdx].x;
              p.targetY = nodePositions[targetIdx].y;
            } else {
              // Target Node-এ পৌঁছে গেলে বলটি মুছে যাবে
              particlesRef.current.splice(index, 1);
              return;
            }
          }

          // Linear Interpolation (Smooth Movement)
          p.x = p.startX + (p.targetX - p.startX) * p.progress;
          p.y = p.startY + (p.targetY - p.startY) * p.progress;

          // বল আঁকা (Drawing Glowing Balls)
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.type === "heavy" ? 5 : 4, 0, Math.PI * 2);
          ctx.fillStyle = p.type === "heavy" ? "#ef4444" : "#3b82f6";
          ctx.shadowColor = p.type === "heavy" ? "#ef4444" : "#3b82f6";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0; // Reset shadow for next drawings
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [actualOutage, actualAiEnabled, actualNodes]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
}
