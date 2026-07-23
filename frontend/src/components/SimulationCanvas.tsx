"use client";

import { useEffect, useRef } from "react";

import { NodeStatus, RoutingEvent, TelemetryData } from "@/types";

interface SimulationCanvasProps {
  telemetry: TelemetryData | null;
}

interface Point {
  x: number;
  y: number;
}

interface RoutingLayout {
  source: Point;
  center: Point;
  targets: Point[];
  width: number;
  height: number;
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
  const layoutRef = useRef<RoutingLayout | null>(null);
  const devicePixelRatioRef = useRef(1);
  const outageRef = useRef(false);
  const seenEventRef = useRef(0);
  const runIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!telemetry) {
      return;
    }

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

    const layout = layoutRef.current;

    if (!layout) {
      return;
    }

    const unseenEvents = telemetry.routing_events.filter(
      (event) => event.event_id > seenEventRef.current,
    );

    if (unseenEvents.length === 0) {
      return;
    }

    for (const event of unseenEvents.slice(-12)) {
      spawnParticle(event, telemetry.ai_enabled, layout, particlesRef.current);
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

    return () => {
      window.removeEventListener("force_reset_ui", handleInstantReset);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;

    if (!canvas || !container) {
      return;
    }

    const updateLayout = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const width = Math.max(1, canvasRect.width);
      const height = Math.max(1, canvasRect.height);

      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      const nextCanvasWidth = Math.round(width * devicePixelRatio);
      const nextCanvasHeight = Math.round(height * devicePixelRatio);

      if (
        canvas.width !== nextCanvasWidth ||
        canvas.height !== nextCanvasHeight
      ) {
        canvas.width = nextCanvasWidth;
        canvas.height = nextCanvasHeight;
      }

      devicePixelRatioRef.current = devicePixelRatio;

      const sourceElement = container.querySelector<HTMLElement>(
        "[data-routing-source]",
      );

      const centerElement = container.querySelector<HTMLElement>(
        "[data-routing-center]",
      );

      const nodeElements = Array.from(
        container.querySelectorAll<HTMLElement>("[data-routing-node]"),
      ).sort(
        (first, second) =>
          Number(first.dataset.routingNode ?? 0) -
          Number(second.dataset.routingNode ?? 0),
      );

      if (!sourceElement || !centerElement || nodeElements.length === 0) {
        layoutRef.current = null;
        return;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const centerRect = centerElement.getBoundingClientRect();

      const targets = nodeElements.map((element) => {
        const nodeRect = element.getBoundingClientRect();

        return {
          x: nodeRect.left - canvasRect.left,
          y: nodeRect.top + nodeRect.height / 2 - canvasRect.top,
        };
      });

      layoutRef.current = {
        source: {
          x: sourceRect.right - canvasRect.left,
          y: sourceRect.top + sourceRect.height / 2 - canvasRect.top,
        },
        center: {
          x: centerRect.left + centerRect.width / 2 - canvasRect.left,
          y: centerRect.top + centerRect.height / 2 - canvasRect.top,
        },
        targets,
        width,
        height,
      };
    };

    const resizeObserver = new ResizeObserver(updateLayout);

    resizeObserver.observe(container);

    const observedElements = container.querySelectorAll<HTMLElement>(
      "[data-routing-source], [data-routing-center], [data-routing-node]",
    );

    observedElements.forEach((element) => {
      resizeObserver.observe(element);
    });

    const firstLayoutFrame = window.requestAnimationFrame(updateLayout);

    window.addEventListener("resize", updateLayout);
    container.addEventListener("scroll", updateLayout, true);

    return () => {
      window.cancelAnimationFrame(firstLayoutFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLayout);
      container.removeEventListener("scroll", updateLayout, true);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let animationFrameId = 0;

    const render = () => {
      const layout = layoutRef.current;
      const devicePixelRatio = devicePixelRatioRef.current;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (!layout) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      drawConnection(
        context,
        layout.source,
        layout.center,
        "rgba(51, 65, 85, 0.55)",
      );

      layout.targets.forEach((target, index) => {
        const strokeColor =
          nodesRef.current[index]?.status === "crashed"
            ? "rgba(239, 68, 68, 0.4)"
            : "rgba(51, 65, 85, 0.55)";

        drawConnection(context, layout.center, target, strokeColor);
      });

      if (!outageRef.current) {
        for (
          let index = particlesRef.current.length - 1;
          index >= 0;
          index -= 1
        ) {
          const particle = particlesRef.current[index];

          particle.progress += particle.speed;

          if (particle.progress >= 1) {
            if (particle.stage === 1) {
              const target = layout.targets[particle.targetNodeIdx];

              if (!target) {
                particlesRef.current.splice(index, 1);
                continue;
              }

              particle.stage = 2;
              particle.progress = 0;
              particle.startX = layout.center.x;
              particle.startY = layout.center.y;
              particle.targetX = target.x;
              particle.targetY = target.y;
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

          context.fillStyle = particle.type === "heavy" ? "#ef4444" : "#3b82f6";

          context.shadowColor =
            particle.type === "heavy" ? "#ef4444" : "#3b82f6";

          context.shadowBlur = 12;
          context.fill();
          context.shadowBlur = 0;
        }
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}

function drawConnection(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  strokeColor: string,
) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.lineWidth = 1.5;
  context.lineCap = "round";
  context.strokeStyle = strokeColor;
  context.stroke();
}

function spawnParticle(
  event: RoutingEvent,
  aiEnabled: boolean,
  layout: RoutingLayout,
  particles: Particle[],
) {
  const route = aiEnabled ? event.ai_route : event.legacy_route;

  if (
    !route.success ||
    route.node_id === null ||
    !layout.targets[route.node_id]
  ) {
    return;
  }

  particles.push({
    id: event.event_id,
    x: layout.source.x,
    y: layout.source.y,
    startX: layout.source.x,
    startY: layout.source.y,
    targetX: layout.center.x,
    targetY: layout.center.y,
    type: event.task_type,
    progress: 0,
    speed: event.task_type === "heavy" ? 0.022 : 0.03,
    stage: 1,
    targetNodeIdx: route.node_id,
  });
}
