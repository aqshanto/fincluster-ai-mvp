from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from core.orchestrator import MFSOrchestrator, StrategyMetrics
from core.transaction_store import TransactionDatasetStore
from ml.hybrid_ai_engine import HybridAIEngine
from ml.local_model import LocalTransactionClassifier, local_model


class LocalModelTests(unittest.TestCase):
    def test_model_is_available_and_reports_validation_metrics(self) -> None:
        status = local_model.status()
        self.assertTrue(status["available"])
        self.assertIsNotNone(status["metrics"])
        self.assertGreater(status["metrics"]["roc_auc"], 0.75)
        self.assertGreater(status["metrics"]["f1"], 0.60)
        self.assertIn(status["selected_algorithm"], {"random_forest", "xgboost"})
        self.assertIn("random_forest", status["candidate_metrics"])

    def test_xgboost_is_evaluated_when_available(self) -> None:
        if not local_model.status()["xgboost_available"]:
            self.skipTest("optional XGBoost dependency is not installed")
        old_algorithm = os.environ.get("LOCAL_MODEL_ALGORITHM")
        os.environ["LOCAL_MODEL_ALGORITHM"] = "auto"
        try:
            challenger = LocalTransactionClassifier(rows=1200)
            self.assertIn("xgboost", challenger.status()["candidate_metrics"])
        finally:
            if old_algorithm is None:
                os.environ.pop("LOCAL_MODEL_ALGORITHM", None)
            else:
                os.environ["LOCAL_MODEL_ALGORITHM"] = old_algorithm

    def test_risky_transaction_scores_above_normal_transaction(self) -> None:
        normal = local_model.score_transaction(
            amount=450,
            tx_type=2,
            account_age_days=365,
            mcc="5411",
            is_vpn=False,
        )
        risky = local_model.score_transaction(
            amount=48_000,
            tx_type=1,
            account_age_days=1,
            mcc="7995",
            is_vpn=True,
        )
        self.assertLess(normal["risk_score"], risky["risk_score"])
        self.assertFalse(normal["is_heavy"])
        self.assertTrue(risky["is_heavy"])
        self.assertEqual(risky["classifier_source"], "local_ml")


class HybridEngineTests(unittest.IsolatedAsyncioTestCase):
    async def test_auto_simulation_never_requires_external_api(self) -> None:
        engine = HybridAIEngine()
        engine.external_enabled = True
        result = engine.score_auto(
            amount=1_000,
            tx_type=0,
            account_age_days=300,
            mcc="5411",
            is_vpn=False,
        )
        self.assertEqual(result["classifier_source"], "local_ml")
        self.assertFalse(result["api_used"])

    async def test_manual_uses_local_model_when_api_is_disabled(self) -> None:
        engine = HybridAIEngine()
        engine.external_enabled = False
        result = await engine.score_manual(
            amount=1_000,
            tx_type=0,
            account_age_days=300,
            mcc="5411",
            is_vpn=False,
        )
        self.assertEqual(result["classifier_source"], "local_ml")


class RoutingTests(unittest.TestCase):
    def test_fallback_prefers_healthy_node_before_warning_scaler(self) -> None:
        orchestrator = MFSOrchestrator()
        nodes = orchestrator._new_nodes()
        nodes[0].status = "warning"
        nodes[1].status = "healthy"
        nodes[2].status = "warning"
        analysis = {
            "is_heavy": True,
            "cpu_load_required": 10.0,
        }
        route = orchestrator._route_task("ai", nodes, StrategyMetrics(), analysis)
        self.assertEqual(route.node_id, 1)


class DatasetStoreTests(unittest.TestCase):
    def test_manual_row_can_receive_human_feedback(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            old_path = os.environ.get("AI_DATASET_PATH")
            os.environ["AI_DATASET_PATH"] = str(Path(directory) / "test.db")
            try:
                store = TransactionDatasetStore()
                event = {
                    "event_uid": "7:3",
                    "event_id": 3,
                    "source": "manual",
                    "ai_route": {"node_id": 0, "estimated_latency_ms": 12.0},
                    "legacy_route": {"node_id": 1, "estimated_latency_ms": 28.0},
                }
                task = {
                    "amount": 5000,
                    "tx_type": 0,
                    "account_age_days": 100,
                    "mcc": "5411",
                    "is_vpn": False,
                }
                analysis = {
                    "classifier_source": "local_ml",
                    "model_name": "test-model",
                    "risk_score": 25,
                    "risk_level": "low",
                    "is_heavy": False,
                    "task_path": "LIGHT FAST-PATH",
                }
                self.assertTrue(store.record(event=event, task=task, analysis=analysis))
                self.assertTrue(store.add_feedback("7:3", "light"))
                self.assertEqual(store.stats()["reviewed_rows"], 1)
                self.assertNotIn("103.", store.export_csv())
            finally:
                if old_path is None:
                    os.environ.pop("AI_DATASET_PATH", None)
                else:
                    os.environ["AI_DATASET_PATH"] = old_path


if __name__ == "__main__":
    unittest.main()
