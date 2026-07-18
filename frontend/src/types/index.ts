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

export interface TelemetryData {
  uptime: number;
  latency: number;
  active_nodes: string;
  sim_time: string;
  total_heavy: number;
  total_light: number;
  saved_cost: number;
  nodes: NodeStatus[];
  ai_enabled: boolean;
  surge_active: boolean;
  anomaly_active: boolean;
  ai_decision?: string;
  cluster_outage: boolean; // নতুন ফ্ল্যাগ
}
