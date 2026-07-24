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
  event_uid: string;
  event_id: number;
  source: "generated" | "manual";
  task_type: "heavy" | "light";
  task_path: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  factors: RiskFactor[];
  classifier_source: string;
  model_name: string;
  confidence: number;
  predicted_label?: "heavy" | "light";
  review_required?: boolean;
  review_reasons?: string[];
  api_used: boolean;
  fallback_reason: string | null;
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

export interface LocalModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  balanced_accuracy: number;
  roc_auc: number;
  pr_auc: number;
  threshold: number;
  selection_score: number;
  training_rows: number;
  validation_rows: number;
  test_rows: number;
  evaluation_split: string;
}

export interface LocalModelStatus {
  available: boolean;
  model_name: string;
  dataset_source: string;
  requested_algorithm: "auto" | "random_forest" | "xgboost";
  selected_algorithm: "random_forest" | "xgboost" | null;
  threshold: number;
  xgboost_available: boolean;
  review_policy: {
    enabled: boolean;
    confidence_threshold: number;
    fallbacks_require_review: boolean;
  };
  metrics: LocalModelMetrics | null;
  candidate_metrics: Record<string, LocalModelMetrics>;
  artifact_path: string | null;
  error: string | null;
}

export interface AIRuntimeStatus {
  auto_engine: "local_ml";
  manual_engine: "local_ml" | "gemini_api";
  external_ai_available: boolean;
  external_ai_enabled: boolean;
  external_model: string;
  api_calls: number;
  cache_hits: number;
  fallbacks: number;
  last_error: string | null;
  local_model: LocalModelStatus;
}

export interface DatasetStatus {
  rows: number;
  reviewed_rows: number;
  pending_reviews: number;
  correct_predictions: number;
  incorrect_predictions: number;
  reviewed_accuracy: number | null;
  max_rows: number;
  auto_sample_every: number;
  storage: string;
  persistent?: boolean;
  contains_sensitive_identifiers: boolean;
  last_error: string | null;
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
  ai_runtime: AIRuntimeStatus;
  dataset: DatasetStatus;
}

export interface PendingReview {
  event_uid: string;
  event_id: number;
  created_at: string;
  amount: number;
  tx_type: number;
  account_age_days: number;
  mcc: string;
  is_vpn: boolean;
  predicted_label: "heavy" | "light";
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  task_path: string;
  classifier_source: string;
  model_name: string;
  confidence: number;
  review_reasons: string[];
  risk_factors: RiskFactor[];
}

export interface ManualTransactionResult {
  status: "success" | "failed" | "pending_review";
  event_uid: string;
  event_id: number;
  strategy: "ai" | "legacy";
  is_heavy: boolean;
  predicted_label: "heavy" | "light";
  reviewed_label?: "heavy" | "light";
  prediction_correct?: boolean;
  task_path: string;
  risk_score: number;
  original_risk_score?: number;
  risk_level: "low" | "medium" | "high";
  risk_factors: RiskFactor[];
  classifier_source: string;
  model_name: string;
  confidence: number;
  api_used: boolean;
  fallback_reason: string | null;
  review_required: boolean;
  review_reasons: string[];
  route: RouteOutcome | null;
  comparison: {
    ai_route: RouteOutcome;
    legacy_route: RouteOutcome;
  } | null;
  decision: string;
  stan: string | null;
  rrn: string | null;
}
