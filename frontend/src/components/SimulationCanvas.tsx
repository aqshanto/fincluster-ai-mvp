"use client";

import React, { useEffect, useRef } from "react";
import { NodeStatus, RoutingEvent, TelemetryData } from "@/types";

interface SimulationCanvasProps {
  telemetry: TelemetryData | null;
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
  stage: 1 | 2;
  targetNodeIdx: number;
}

export default function SimulationCanvas({ telemetry }: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nodesRef = useRef<NodeStatus[]>([]);
  const outageRef = useRef(false);
  const seenEventRef = useRef(0);
  const runIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!telemetry) return;

    nodesRef.current = telemetry.nodes;
    outageRef.current = telemetry.cluster_outage;

    if (runIdRef.current !== telemetry.run_id) {
      runIdRef.current = telemetry.run_id;
      particlesRef.current = [];
      seenEventRef.current = 0;
    }

    if (telemetry.cluster_outage) {
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const unseenEvents = telemetry.routing_events.filter(
      (event) => event.event_id > seenEventRef.current,
    );
    if (unseenEvents.length === 0) return;

    for (const event of unseenEvents.slice(-12)) {
      spawnParticle(event, telemetry.ai_enabled, canvas, particlesRef.current);
    }

    seenEventRef.current = Math.max(
      seenEventRef.current,
      ...unseenEvents.map((event) => event.event_id),
    );
  }, [telemetry]);

  useEffect(() => {
    const handleInstantReset = () => {
      particlesRef.current = [];
      seenEventRef.current = 0;
    };

    window.addEventListener("force_reset_ui", handleInstantReset);
    return () => window.removeEventListener("force_reset_ui", handleInstantReset);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrameId = 0;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      const startX = 260;
      const startY = canvas.height / 2;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const rightX = canvas.width - 260;
      const nodePositions = [
        { x: rightX, y: centerY - 130 },
        { x: rightX, y: centerY },
        { x: rightX, y: centerY + 130 },
      ];

      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(centerX, centerY);
      context.strokeStyle = "rgba(51, 65, 85, 0.4)";
      context.stroke();

      nodePositions.forEach((position, index) => {
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(position.x, position.y);
        context.strokeStyle =
          nodesRef.current[index]?.status === "crashed"
            ? "rgba(239, 68, 68, 0.3)"
            : "rgba(51, 65, 85, 0.4)";
        context.stroke();
      });

      if (!outageRef.current) {
        for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
          const particle = particlesRef.current[index];
          particle.progress += particle.speed;

          if (particle.progress >= 1) {
            if (particle.stage === 1) {
              particle.stage = 2;
              particle.progress = 0;
              particle.startX = centerX;
              particle.startY = centerY;
              particle.targetX = nodePositions[particle.targetNodeIdx].x;
              particle.targetY = nodePositions[particle.targetNodeIdx].y;
            } else {
              particlesRef.current.splice(index, 1);
              continue;
            }
          }

          particle.x =
            particle.startX +
            (particle.targetX - particle.startX) * particle.progress;
          particle.y =
            particle.startY +
            (particle.targetY - particle.startY) * particle.progress;

          context.beginPath();
          context.arc(
            particle.x,
            particle.y,
            particle.type === "heavy" ? 5 : 4,
            0,
            Math.PI * 2,
          );
          context.fillStyle =
            particle.type === "heavy" ? "#ef4444" : "#3b82f6";
          context.shadowColor =
            particle.type === "heavy" ? "#ef4444" : "#3b82f6";
          context.shadowBlur = 10;
          context.fill();
          context.shadowBlur = 0;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
}

function spawnParticle(
  event: RoutingEvent,
  aiEnabled: boolean,
  canvas: HTMLCanvasElement,
  particles: Particle[],
) {
  const route = aiEnabled ? event.ai_route : event.legacy_route;
  if (!route.success || route.node_id === null) return;

  const startX = 260;
  const startY = canvas.height / 2;

  particles.push({
    id: event.event_id,
    x: startX,
    y: startY,
    startX,
    startY,
    targetX: canvas.width / 2,
    targetY: canvas.height / 2,
    type: event.task_type,
    progress: 0,
    speed: event.task_type === "heavy" ? 0.022 : 0.03,
    stage: 1,
    targetNodeIdx: route.node_id,
  });
}
