from __future__ import annotations

import math
import random
from collections import deque
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Literal

from core.transaction_store import transaction_store
from ml.hybrid_ai_engine import hybrid_ai
from ml.rule_engine import rule_engine
from models.schemas import NodeStatus

StrategyName = Literal["ai", "legacy"]


@dataclass
class StrategyMetrics:
    total_cost: float = 0.0
    failed_tasks: int = 0
    successful_tasks: int = 0
    round_robin_cursor: int = 0
    latency_samples: deque[float] = field(default_factory=lambda: deque(maxlen=1000))


@dataclass
class RouteOutcome:
    success: bool
    node_id: int | None
    node_name: str | None
    reason: str
    estimated_latency_ms: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "node_id": self.node_id,
            "node_name": self.node_name,
            "reason": self.reason,
            "estimated_latency_ms": round(self.estimated_latency_ms, 1),
        }


class MFSOrchestrator:
    TICK_MS = 100.0
    SIM_SPEED_MULTIPLIER = 600.0
    SERVICE_DECAY_PER_TICK = 1.1
    RANDOM_SEED = 2026

    def __init__(self) -> None:
        self.run_id = 0
        self.reset_simulation()

    @staticmethod
    def _new_nodes() -> list[NodeStatus]:
        return [
            NodeStatus(id=0, name="Node 1 (Heavy GPU)", type="heavy", load=0.0, temp=35.0, assigned=0, status="healthy", costActive=2.5, costStandby=0.15),
            NodeStatus(id=1, name="Node 2 (Light CPU)", type="light", load=0.0, temp=30.0, assigned=0, status="healthy", costActive=0.4, costStandby=0.05),
            NodeStatus(id=2, name="Node 3 (Scaler)", type="dynamic", load=0.0, temp=25.0, assigned=0, status="standby", costActive=1.2, costStandby=0.08),
        ]

    def reset_simulation(self) -> None:
        self.run_id += 1
        self.rng = random.Random(self.RANDOM_SEED)
        self.ai_enabled = True  # Selects the live view; both benchmark clusters always run.
        self.surge_active = False
        self.anomaly_active = False
        self.sim_seconds = 0.0
        self.total_heavy = 0
        self.total_light = 0
        self.latest_ai_decision = "System normal. Local ML classification and explainable smart scheduling are active."
        self.event_sequence = 0
        self.routing_events: deque[dict[str, Any]] = deque(maxlen=30)
        self.ai_nodes = self._new_nodes()
        self.legacy_nodes = deepcopy(self.ai_nodes)
        self.ai_metrics = StrategyMetrics()
        self.legacy_metrics = StrategyMetrics()
        self._thermal_band = 0

    def update_simulation(self, dt_ms: float = TICK_MS) -> None:
        sim_dt_seconds = (dt_ms / 1000.0) * self.SIM_SPEED_MULTIPLIER
        self.sim_seconds += sim_dt_seconds
        sim_dt_hours = sim_dt_seconds / 3600.0

        spawn_chance = 0.70 if self.surge_active else 0.15
        if self.rng.random() < spawn_chance:
            self._process_task(self._generate_seeded_task(), source="generated")

        self._update_cluster("ai", self.ai_nodes, self.ai_metrics, sim_dt_hours)
        self._update_cluster("legacy", self.legacy_nodes, self.legacy_metrics, sim_dt_hours)
        self._refresh_decision_log()

    def _generate_seeded_task(self) -> dict[str, Any]:
        return {
            "amount": self.rng.choice([500, 1200, 2500, 5000, 15000, 24000, 48000, 50000]),
            "tx_type": self.rng.choice([0, 1, 2]),
            "account_age_days": self.rng.randint(0, 720),
            "mcc": self.rng.choice(["5411", "6011", "4814", "7995"]),
            "is_vpn": self.rng.random() < (0.12 if self.surge_active else 0.04),
            "stan": None,
            "rrn": None,
        }

    def _allocate_event_identity(self) -> tuple[str, int]:
        self.event_sequence += 1
        return f"{self.run_id}:{self.event_sequence}", self.event_sequence

    def _process_task(
        self,
        task: dict[str, Any],
        source: str,
        analysis: dict[str, Any] | None = None,
        *,
        event_uid: str | None = None,
        event_id: int | None = None,
        persist: bool = True,
    ) -> dict[str, Any]:
        if analysis is None:
            analysis = hybrid_ai.score_auto(
                amount=task["amount"],
                tx_type=task["tx_type"],
                account_age_days=task["account_age_days"],
                mcc=task.get("mcc", "5411"),
                is_vpn=task.get("is_vpn", False),
            )

        if analysis["is_heavy"]:
            self.total_heavy += 1
        else:
            self.total_light += 1

        ai_route = self._route_task("ai", self.ai_nodes, self.ai_metrics, analysis)
        legacy_route = self._route_task("legacy", self.legacy_nodes, self.legacy_metrics, analysis)

        if event_uid is None or event_id is None:
            event_uid, event_id = self._allocate_event_identity()
        event = {
            "event_uid": event_uid,
            "event_id": event_id,
            "source": source,
            "task_type": "heavy" if analysis["is_heavy"] else "light",
            "task_path": analysis["task_path"],
            "risk_score": analysis["risk_score"],
            "risk_level": analysis["risk_level"],
            "factors": analysis["factors"],
            "classifier_source": analysis.get("classifier_source", "unknown"),
            "model_name": analysis.get("model_name", "unknown"),
            "confidence": analysis.get("confidence", 0.0),
            "predicted_label": analysis.get(
                "predicted_label", "heavy" if analysis["is_heavy"] else "light"
            ),
            "review_required": analysis.get("review_required", False),
            "review_reasons": analysis.get("review_reasons", []),
            "api_used": analysis.get("api_used", False),
            "fallback_reason": analysis.get("fallback_reason"),
            "amount": task["amount"],
            "stan": task.get("stan"),
            "rrn": task.get("rrn"),
            "ai_route": ai_route.as_dict(),
            "legacy_route": legacy_route.as_dict(),
        }
        self.routing_events.append(event)
        if persist:
            transaction_store.record(event=event, task=task, analysis=analysis)
        return event

    def _route_task(
        self,
        strategy: StrategyName,
        nodes: list[NodeStatus],
        metrics: StrategyMetrics,
        analysis: dict[str, Any],
    ) -> RouteOutcome:
        if all(node.status == "crashed" for node in nodes):
            metrics.failed_tasks += 1
            return RouteOutcome(False, None, None, "No available processing node", 500.0)

        if strategy == "ai":
            preferred_id = 0 if analysis["is_heavy"] else 1
            preferred = nodes[preferred_id]
            if preferred.status == "healthy" and preferred.load < 85:
                destination = preferred
                reason = f"Task-aware route to the preferred {'GPU' if analysis['is_heavy'] else 'fast-path CPU'} node"
            else:
                candidates = [node for node in nodes if node.status != "crashed"]
                destination = min(
                    candidates,
                    key=lambda node: (
                        0 if node.status == "healthy" else 1,
                        0 if node.type == "dynamic" else 1,
                        node.load,
                        node.temp,
                    ),
                )
                reason = f"Health-aware fallback because {preferred.name} is unavailable, hot, or overloaded"
        else:
            ordered = [nodes[(metrics.round_robin_cursor + offset) % len(nodes)] for offset in range(len(nodes))]
            metrics.round_robin_cursor = (metrics.round_robin_cursor + 1) % len(nodes)
            destination = next((node for node in ordered if node.status != "crashed"), None)
            if destination is None:
                metrics.failed_tasks += 1
                return RouteOutcome(False, None, None, "Round-robin found no live node", 500.0)
            reason = "Blind round-robin route; task complexity and thermal warning were not considered"

        if destination.status == "standby":
            destination.status = "healthy"

        load_to_add = float(analysis["cpu_load_required"])
        queue_before = destination.load
        destination.assigned += 1
        destination.load = min(100.0, destination.load + load_to_add)

        mismatch_penalty = 0.0
        if analysis["is_heavy"] and destination.type == "light":
            mismatch_penalty = 35.0
        elif not analysis["is_heavy"] and destination.type == "heavy":
            mismatch_penalty = 10.0
        thermal_penalty = max(0.0, destination.temp - 70.0) * 1.8
        estimated_latency = 5.0 + queue_before * 0.65 + load_to_add * 0.8 + mismatch_penalty + thermal_penalty

        metrics.successful_tasks += 1
        metrics.latency_samples.append(estimated_latency)
        return RouteOutcome(True, destination.id, destination.name, reason, estimated_latency)

    def _update_cluster(
        self,
        strategy: StrategyName,
        nodes: list[NodeStatus],
        metrics: StrategyMetrics,
        sim_dt_hours: float,
    ) -> None:
        for index, node in enumerate(nodes):
            if node.load > 0:
                node.load = max(0.0, node.load - self.SERVICE_DECAY_PER_TICK)

            # Crashed nodes cool regardless of whether the anomaly toggle is still on.
            if node.status == "crashed":
                node.temp = max(25.0, node.temp - 0.8)
                if node.temp < 50.0:
                    node.status = "standby" if index == 2 and strategy == "ai" else "healthy"
                continue

            if index == 0 and self.anomaly_active:
                node.temp += 0.5
            elif node.load > 75:
                node.temp += 0.15
            elif node.temp > 25:
                node.temp = max(25.0, node.temp - 0.2)

            if node.temp > 95:
                node.status = "crashed"
                node.load = 0.0
            elif node.temp > 75:
                node.status = "warning"
            elif node.status == "warning":
                node.status = "healthy"

        scaler = nodes[2]
        if strategy == "ai" and scaler.status != "crashed":
            should_sleep = (
                not self.surge_active
                and scaler.load <= 0.1
                and nodes[0].load < 60
                and nodes[1].load < 60
            )
            if should_sleep:
                scaler.status = "standby"
            elif scaler.temp > 75:
                scaler.status = "warning"
            else:
                scaler.status = "healthy"
        elif strategy == "legacy" and scaler.status == "standby":
            scaler.status = "healthy"

        metrics.total_cost += self._cost_rate(nodes) * sim_dt_hours

    @staticmethod
    def _cost_rate(nodes: list[NodeStatus]) -> float:
        return sum(
            node.costStandby if node.status in {"standby", "crashed"} else node.costActive
            for node in nodes
        )

    def _refresh_decision_log(self) -> None:
        node = self.ai_nodes[0]
        band = 3 if node.status == "crashed" else 2 if node.temp >= 85 else 1 if node.temp >= 75 else 0
        if band != self._thermal_band:
            self._thermal_band = band
            if band > 0:
                self.latest_ai_decision = rule_engine.thermal_recommendation(node.name, node.temp, node.load)
            elif self.anomaly_active:
                self.latest_ai_decision = "[SELF-HEALING]: Node 1 returned below the warning threshold and can rejoin smart scheduling."

    @staticmethod
    def _manual_task(
        amount: float,
        tx_type: int,
        account_age_days: int,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "amount": amount,
            "tx_type": tx_type,
            "account_age_days": account_age_days,
            "mcc": metadata.get("mcc", "5411"),
            "is_vpn": metadata.get("is_vpn", False),
            "stan": metadata.get("stan"),
            "rrn": metadata.get("rrn"),
        }

    def hold_manual_transaction(
        self,
        amount: float,
        tx_type: int,
        account_age_days: int,
        metadata: dict[str, Any],
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        task = self._manual_task(amount, tx_type, account_age_days, metadata)
        event_uid, event_id = self._allocate_event_identity()
        stored = transaction_store.record_pending_review(
            event_uid=event_uid,
            event_id=event_id,
            task=task,
            analysis=analysis,
        )
        if not stored:
            raise RuntimeError("The transaction could not be added to the review queue")

        reasons = list(analysis.get("review_reasons") or ["Human review requested"])
        reason_text = "; ".join(reasons)
        predicted_label = analysis.get(
            "predicted_label", "heavy" if analysis["is_heavy"] else "light"
        )
        self.latest_ai_decision = (
            f"[HUMAN REVIEW HOLD | EVENT:{event_uid}]: The model predicted "
            f"{predicted_label.upper()} at confidence {analysis.get('confidence', 0.0):.2f}. "
            f"No processing node was selected until an operator reviews it. {reason_text}"
        )
        return {
            "status": "pending_review",
            "event_uid": event_uid,
            "event_id": event_id,
            "strategy": "ai" if self.ai_enabled else "legacy",
            "is_heavy": bool(analysis["is_heavy"]),
            "predicted_label": predicted_label,
            "task_path": analysis["task_path"],
            "risk_score": analysis["risk_score"],
            "risk_level": analysis["risk_level"],
            "risk_factors": analysis["factors"],
            "classifier_source": analysis.get("classifier_source", "unknown"),
            "model_name": analysis.get("model_name", "unknown"),
            "confidence": analysis.get("confidence", 0.0),
            "api_used": analysis.get("api_used", False),
            "fallback_reason": analysis.get("fallback_reason"),
            "review_required": True,
            "review_reasons": reasons,
            "route": None,
            "comparison": None,
            "decision": self.latest_ai_decision,
            "stan": metadata.get("stan"),
            "rrn": metadata.get("rrn"),
        }

    def inject_manual_transaction(
        self,
        amount: float,
        tx_type: int,
        account_age_days: int,
        metadata: dict[str, Any],
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        event = self._process_task(
            self._manual_task(amount, tx_type, account_age_days, metadata),
            source="manual",
            analysis=analysis,
        )
        selected_route = event["ai_route"] if self.ai_enabled else event["legacy_route"]
        strategy_label = "AI smart scheduler" if self.ai_enabled else "legacy round-robin"
        factors_text = ", ".join(
            f"{factor['label']} +{factor['points']}" for factor in event["factors"]
        ) or "No elevated-risk factors"
        engine_label = event["model_name"]
        fallback_text = f" Fallback: {event['fallback_reason']}." if event.get("fallback_reason") else ""
        self.latest_ai_decision = (
            f"[MANUAL TX | STAN:{metadata.get('stan', 'N/A')} | {engine_label}]: "
            f"Risk {event['risk_score']} ({event['risk_level']}) from {factors_text}. "
            f"{strategy_label} selected {selected_route['node_name'] or 'no node'}.{fallback_text}"
        )

        return {
            "status": "success" if selected_route["success"] else "failed",
            "event_uid": event["event_uid"],
            "event_id": event["event_id"],
            "strategy": "ai" if self.ai_enabled else "legacy",
            "is_heavy": event["task_type"] == "heavy",
            "predicted_label": event["predicted_label"],
            "task_path": event["task_path"],
            "risk_score": event["risk_score"],
            "risk_level": event["risk_level"],
            "risk_factors": event["factors"],
            "classifier_source": event["classifier_source"],
            "model_name": event["model_name"],
            "confidence": event["confidence"],
            "api_used": event["api_used"],
            "fallback_reason": event["fallback_reason"],
            "review_required": False,
            "review_reasons": [],
            "route": selected_route,
            "comparison": {"ai_route": event["ai_route"], "legacy_route": event["legacy_route"]},
            "decision": self.latest_ai_decision,
            "stan": metadata.get("stan"),
            "rrn": metadata.get("rrn"),
        }

    def resolve_manual_review(
        self,
        pending: dict[str, Any],
        reviewed_label: Literal["heavy", "light"],
        reviewed_by: str,
    ) -> dict[str, Any]:
        original_analysis = dict(pending.get("analysis") or {})
        predicted_label = str(pending["predicted_label"])
        human_is_heavy = reviewed_label == "heavy"
        original_risk_score = int(pending["risk_score"])
        routed_risk_score = (
            max(60, original_risk_score)
            if human_is_heavy
            else min(49, original_risk_score)
        )
        if human_is_heavy:
            task_path = "DEEP FRAUD CHECK" if routed_risk_score >= 70 else "ENHANCED VERIFICATION"
            risk_level = "high" if routed_risk_score >= 70 else "medium"
            cpu_load_required = max(12.0, float(original_analysis.get("cpu_load_required", 14.0)))
        else:
            task_path = "LIGHT FAST-PATH"
            risk_level = "low"
            cpu_load_required = min(7.0, float(original_analysis.get("cpu_load_required", 5.0)))

        factors = list(original_analysis.get("factors") or pending.get("risk_factors") or [])
        factors.append(
            {
                "code": "human_review",
                "label": "Human operator decision",
                "points": 0,
                "detail": f"Operator {reviewed_by} confirmed {reviewed_label}",
            }
        )
        human_analysis = {
            "risk_score": routed_risk_score,
            "risk_level": risk_level,
            "task_path": task_path,
            "is_heavy": human_is_heavy,
            "cpu_load_required": cpu_load_required,
            "factors": factors,
            "classifier_source": "human_review",
            "model_name": "HumanOperatorReview-v1",
            "confidence": 1.0,
            "model_probability": 1.0 if human_is_heavy else 0.0,
            "predicted_label": reviewed_label,
            "review_required": False,
            "review_reasons": [],
            "api_used": False,
            "fallback_reason": None,
        }
        task = {
            "amount": pending["amount"],
            "tx_type": pending["tx_type"],
            "account_age_days": pending["account_age_days"],
            "mcc": pending["mcc"],
            "is_vpn": pending["is_vpn"],
            "stan": None,
            "rrn": None,
        }
        event = self._process_task(
            task,
            source="manual",
            analysis=human_analysis,
            event_uid=pending["event_uid"],
            event_id=pending["event_id"],
            persist=False,
        )
        review_record = transaction_store.resolve_pending_review(
            event_uid=pending["event_uid"],
            reviewed_label=reviewed_label,
            reviewed_by=reviewed_by,
            routed_event=event,
        )
        if review_record is None:
            raise RuntimeError("The pending review could not be resolved")

        selected_route = event["ai_route"] if self.ai_enabled else event["legacy_route"]
        correctness = "confirmed" if review_record["prediction_correct"] else "corrected"
        self.latest_ai_decision = (
            f"[HUMAN REVIEW RESOLVED | EVENT:{pending['event_uid']}]: Operator {reviewed_by} "
            f"{correctness} the model prediction ({predicted_label} -> {reviewed_label}). "
            f"The reviewed workload was routed to {selected_route['node_name'] or 'no node'}."
        )
        return {
            "status": "success" if selected_route["success"] else "failed",
            "event_uid": event["event_uid"],
            "event_id": event["event_id"],
            "strategy": "ai" if self.ai_enabled else "legacy",
            "is_heavy": human_is_heavy,
            "predicted_label": predicted_label,
            "reviewed_label": reviewed_label,
            "prediction_correct": review_record["prediction_correct"],
            "task_path": event["task_path"],
            "risk_score": event["risk_score"],
            "original_risk_score": original_risk_score,
            "risk_level": event["risk_level"],
            "risk_factors": event["factors"],
            "classifier_source": event["classifier_source"],
            "model_name": event["model_name"],
            "confidence": 1.0,
            "api_used": False,
            "fallback_reason": None,
            "review_required": False,
            "review_reasons": [],
            "route": selected_route,
            "comparison": {"ai_route": event["ai_route"], "legacy_route": event["legacy_route"]},
            "decision": self.latest_ai_decision,
            "stan": None,
            "rrn": None,
        }

    @staticmethod
    def _percentile(values: deque[float], percentile: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        index = max(0, min(len(ordered) - 1, math.ceil(percentile * len(ordered)) - 1))
        return ordered[index]

    def _strategy_summary(self, nodes: list[NodeStatus], metrics: StrategyMetrics) -> dict[str, Any]:
        samples = list(metrics.latency_samples)
        avg_latency = sum(samples) / len(samples) if samples else 5.0
        elapsed_minutes = max(self.sim_seconds / 60.0, 1.0 / 60.0)
        return {
            "cost": round(metrics.total_cost, 3),
            "failures": metrics.failed_tasks,
            "successful_tasks": metrics.successful_tasks,
            "throughput_tx_per_min": round(metrics.successful_tasks / elapsed_minutes, 2),
            "avg_latency_ms": round(avg_latency, 1),
            "p95_latency_ms": round(self._percentile(metrics.latency_samples, 0.95), 1),
            "max_temperature_c": round(max(node.temp for node in nodes), 1),
            "active_nodes": sum(1 for node in nodes if node.status not in {"standby", "crashed"}),
        }

    @staticmethod
    def format_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def get_telemetry(self) -> dict[str, Any]:
        ai_summary = self._strategy_summary(self.ai_nodes, self.ai_metrics)
        legacy_summary = self._strategy_summary(self.legacy_nodes, self.legacy_metrics)
        selected_nodes = self.ai_nodes if self.ai_enabled else self.legacy_nodes
        selected_summary = ai_summary if self.ai_enabled else legacy_summary
        total_tasks = self.total_heavy + self.total_light
        selected_failures = self.ai_metrics.failed_tasks if self.ai_enabled else self.legacy_metrics.failed_tasks
        uptime = 100.0 if total_tasks == 0 else max(0.0, 100.0 - (selected_failures / total_tasks) * 100.0)
        active_count = sum(1 for node in selected_nodes if node.status not in {"standby", "crashed"})

        return {
            "run_id": self.run_id,
            "uptime": round(uptime, 2),
            "latency": selected_summary["avg_latency_ms"],
            "active_nodes": f"{active_count}/3",
            "sim_time": self.format_time(self.sim_seconds),
            "total_heavy": self.total_heavy,
            "total_light": self.total_light,
            "legacy_cost": legacy_summary["cost"],
            "optimized_cost": ai_summary["cost"],
            "saved_cost": round(legacy_summary["cost"] - ai_summary["cost"], 3),
            "nodes": [node.model_dump() for node in selected_nodes],
            "ai_enabled": self.ai_enabled,
            "surge_active": self.surge_active,
            "anomaly_active": self.anomaly_active,
            "ai_decision": self.latest_ai_decision,
            "cluster_outage": all(node.status == "crashed" for node in selected_nodes),
            "benchmark": {"ai": ai_summary, "legacy": legacy_summary},
            "routing_events": list(self.routing_events),
            "ai_runtime": hybrid_ai.status(),
            "dataset": transaction_store.stats(),
        }


orchestrator = MFSOrchestrator()
