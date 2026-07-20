export interface NodeStatus {
  id: number;
  name: string;
  type: "heavy" | "light" | "dynamic";
  load: number;
  temp: number;
  assigned: number;
  status: "healthy" | "warning" | "crashed" | "standby";
  costActive: number;
  costStandby: number;
}

export interface RiskFactor {
  code: string;
  label: string;
  points: number;
  detail: string;
}

export interface RouteOutcome {
  success: boolean;
  node_id: number | null;
  node_name: string | null;
  reason: string;
  estimated_latency_ms: number;
}

export interface RoutingEvent {
  event_id: number;
  source: "generated" | "manual";
  task_type: "heavy" | "light";
  task_path: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  factors: RiskFactor[];
  amount: number;
  stan: string | null;
  rrn: string | null;
  ai_route: RouteOutcome;
  legacy_route: RouteOutcome;
}

export interface StrategyBenchmark {
  cost: number;
  failures: number;
  successful_tasks: number;
  throughput_tx_per_min: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  max_temperature_c: number;
  active_nodes: number;
}

export interface BenchmarkData {
  ai: StrategyBenchmark;
  legacy: StrategyBenchmark;
}

export interface TelemetryData {
  run_id: number;
  uptime: number;
  latency: number;
  active_nodes: string;
  sim_time: string;
  total_heavy: number;
  total_light: number;
  legacy_cost: number;
  optimized_cost: number;
  saved_cost: number;
  nodes: NodeStatus[];
  ai_enabled: boolean;
  surge_active: boolean;
  anomaly_active: boolean;
  ai_decision?: string;
  cluster_outage: boolean;
  benchmark: BenchmarkData;
  routing_events: RoutingEvent[];
}

export interface ManualTransactionResult {
  status: "success" | "failed";
  strategy: "ai" | "legacy";
  is_heavy: boolean;
  task_path: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  risk_factors: RiskFactor[];
  route: RouteOutcome;
  comparison: {
    ai_route: RouteOutcome;
    legacy_route: RouteOutcome;
  };
  decision: string;
  stan: string;
  rrn: string;
}
