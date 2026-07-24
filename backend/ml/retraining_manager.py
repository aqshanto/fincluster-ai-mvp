from __future__ import annotations

import asyncio
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from core.demo_datasets import catalog
from core.transaction_store import transaction_store
from ml.features import FEATURE_VERSION, vectorize_transaction
from ml.local_model import local_model
from ml.model_training import evaluate_model, train_and_select_model


class ReviewRetrainingManager:
    """Controlled, persistent retraining from human-reviewed labels.

    The first attempt occurs at ``AUTO_RETRAIN_MIN_REVIEWED``. Every later
    attempt waits for another complete ``AUTO_RETRAIN_BATCH_SIZE`` labels. An
    attempt is recorded even when its challenger is rejected, preventing the
    backend from repeatedly training on the same rows after a restart.
    """

    def __init__(self) -> None:
        self.enabled = os.getenv("AUTO_RETRAIN_ENABLED", "false").lower() in {
            "1",
            "true",
            "yes",
        }
        self.min_reviewed = max(50, int(os.getenv("AUTO_RETRAIN_MIN_REVIEWED", "100")))
        self.batch_size = max(10, int(os.getenv("AUTO_RETRAIN_BATCH_SIZE", "100")))
        self.algorithm = os.getenv("AUTO_RETRAIN_ALGORITHM", "auto")
        default_artifact = (
            Path(__file__).resolve().parents[1]
            / "models"
            / "transaction_classifier.joblib"
        )
        self.artifact_path = Path(
            os.getenv("AUTO_RETRAIN_MODEL_PATH", str(default_artifact))
        )
        self.min_selection_score = float(
            os.getenv("AUTO_RETRAIN_MIN_SELECTION_SCORE", "0.60")
        )
        self.min_recall = float(os.getenv("AUTO_RETRAIN_MIN_RECALL", "0.55"))
        self.min_balanced_accuracy = float(
            os.getenv("AUTO_RETRAIN_MIN_BALANCED_ACCURACY", "0.60")
        )
        self.demo_min_training_seconds = max(
            0.0,
            float(os.getenv("AUTO_RETRAIN_DEMO_MIN_SECONDS", "1.0")),
        )
        self._lock = asyncio.Lock()
        self.training = False
        self._load_persistent_state()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _load_persistent_state(self) -> None:
        state = transaction_store.get_retraining_state()
        self.last_attempted_reviewed_rows = int(
            state.get("last_attempted_reviewed_rows", 0)
        )
        self.last_promoted_reviewed_rows = int(
            state.get("last_promoted_reviewed_rows", 0)
        )
        self.promotions = int(state.get("promotions", 0))
        self.last_started_at = state.get("last_started_at")
        self.last_completed_at = state.get("last_completed_at")
        self.last_error = state.get("last_error")
        self.last_result = state.get("last_result")

    def refresh_persistent_state(self) -> None:
        self._load_persistent_state()

    def _persist_state(self) -> None:
        transaction_store.save_retraining_state(
            {
                "last_attempted_reviewed_rows": self.last_attempted_reviewed_rows,
                "last_promoted_reviewed_rows": self.last_promoted_reviewed_rows,
                "promotions": self.promotions,
                "last_started_at": self.last_started_at,
                "last_completed_at": self.last_completed_at,
                "last_error": self.last_error,
                "last_result": self.last_result,
            }
        )

    @staticmethod
    def _review_counts(rows: list[dict[str, Any]]) -> tuple[int, int]:
        heavy = sum(1 for row in rows if row["reviewed_label"] == "heavy")
        light = sum(1 for row in rows if row["reviewed_label"] == "light")
        return heavy, light

    def next_threshold(self) -> int:
        if self.last_attempted_reviewed_rows < self.min_reviewed:
            return self.min_reviewed
        return self.last_attempted_reviewed_rows + self.batch_size

    def should_retrain(self, reviewed_rows: int) -> bool:
        if not self.enabled or self.training:
            return False
        return reviewed_rows >= self.next_threshold()

    async def maybe_retrain(self) -> dict[str, Any]:
        rows = transaction_store.reviewed_training_rows()
        if not self.should_retrain(len(rows)):
            return self.status()

        async with self._lock:
            rows = transaction_store.reviewed_training_rows()
            if not self.should_retrain(len(rows)):
                return self.status()

            self.training = True
            self.last_started_at = self._now()
            self.last_completed_at = None
            self.last_error = None
            self._persist_state()
            started_monotonic = time.monotonic()
            heavy_count, light_count = self._review_counts(rows)

            try:
                result = await asyncio.to_thread(self._train_sync, rows)
                self.last_result = result
                if result["promoted"]:
                    self.last_promoted_reviewed_rows = len(rows)
                    self.promotions += 1
            except Exception as exc:  # keep the current champion online
                self.last_error = f"{type(exc).__name__}: {exc}"
                self.last_result = {
                    "reviewed_rows": len(rows),
                    "heavy_rows": heavy_count,
                    "light_rows": light_count,
                    "selected_algorithm": None,
                    "model_name": None,
                    "metrics": {},
                    "candidate_metrics": {},
                    "quality_passed": False,
                    "promoted": False,
                    "error": self.last_error,
                }
            finally:
                elapsed = time.monotonic() - started_monotonic
                remaining = self.demo_min_training_seconds - elapsed
                if remaining > 0:
                    await asyncio.sleep(remaining)

                # Mark every completed attempt, including rejected/failed ones.
                self.last_attempted_reviewed_rows = len(rows)
                self.last_completed_at = self._now()
                if self.last_result is not None:
                    self.last_result["started_at"] = self.last_started_at
                    self.last_result["completed_at"] = self.last_completed_at
                    if self.last_error:
                        self.last_result["error"] = self.last_error
                self.training = False
                self._persist_state()
                if self.last_result is not None:
                    transaction_store.add_retraining_run(self.last_result)

        return self.status()

    def _evaluation_data(self) -> tuple[list[list[float]], list[int]]:
        rows = catalog.evaluation_rows()
        features = [
            vectorize_transaction(
                amount=float(row["amount"]),
                tx_type=int(row["tx_type"]),
                account_age_days=int(row["account_age_days"]),
                mcc=str(row["mcc"]),
                is_vpn=str(row["is_vpn"]).strip().lower() in {"1", "true", "yes"},
            )
            for row in rows
        ]
        labels = [int(str(row["reviewed_label"]).strip().lower() == "heavy") for row in rows]
        return features, labels

    def _train_sync(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        heavy_count, light_count = self._review_counts(rows)
        if min(heavy_count, light_count) < 10:
            raise ValueError(
                "Human-reviewed data must contain at least 10 heavy and 10 light rows"
            )

        features = [
            vectorize_transaction(
                amount=float(row["amount"]),
                tx_type=int(row["tx_type"]),
                account_age_days=int(row["account_age_days"]),
                mcc=str(row["mcc"]),
                is_vpn=bool(row["is_vpn"]),
            )
            for row in rows
        ]
        labels = [int(row["reviewed_label"] == "heavy") for row in rows]
        selection = train_and_select_model(
            features,
            labels,
            requested_algorithm=self.algorithm,
            seed=2026,
            dataset_label="reviewed",
        )

        evaluation_features, evaluation_labels = self._evaluation_data()
        evaluation_metrics = evaluate_model(
            selection.model,
            evaluation_features,
            evaluation_labels,
            threshold=selection.threshold,
            training_rows=len(rows),
        )
        metrics = evaluation_metrics.as_dict()
        quality_passed = (
            evaluation_metrics.selection_score >= self.min_selection_score
            and evaluation_metrics.recall >= self.min_recall
            and evaluation_metrics.balanced_accuracy >= self.min_balanced_accuracy
        )
        algorithm_label = (
            "RandomForest" if selection.selected_algorithm == "random_forest" else "XGBoost"
        )
        model_name = f"FinCluster-{algorithm_label}-reviewed-r{len(rows)}"

        result = {
            "reviewed_rows": len(rows),
            "heavy_rows": heavy_count,
            "light_rows": light_count,
            "selected_algorithm": selection.selected_algorithm,
            "model_name": model_name,
            "metrics": metrics,
            "training_holdout_metrics": selection.metrics.as_dict(),
            "candidate_metrics": selection.candidate_metrics,
            "quality_passed": quality_passed,
            "promoted": False,
            "evaluation_dataset": "fixed_evaluation_120.csv",
        }
        if not quality_passed:
            return result

        artifact = {
            "feature_version": FEATURE_VERSION,
            "model": selection.model,
            "model_name": model_name,
            "dataset_source": "human-reviewed FinCluster simulator transactions",
            "selected_algorithm": selection.selected_algorithm,
            "threshold": selection.threshold,
            "metrics": metrics,
            "training_holdout_metrics": selection.metrics.as_dict(),
            "candidate_metrics": selection.candidate_metrics,
            "trained_at": self._now(),
            "reviewed_rows": len(rows),
            "evaluation_dataset": "fixed_evaluation_120.csv",
        }
        self.artifact_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=self.artifact_path.parent,
            prefix="fincluster-model-",
            suffix=".joblib.tmp",
            delete=False,
        ) as handle:
            temp_path = Path(handle.name)
        try:
            joblib.dump(artifact, temp_path)
            artifact_bytes = temp_path.read_bytes()
            transaction_store.save_model_artifact(
                model_version=model_name,
                selected_algorithm=selection.selected_algorithm,
                artifact_bytes=artifact_bytes,
                metrics=metrics,
                reviewed_rows=len(rows),
            )
            temp_path.replace(self.artifact_path)
            local_model.load_artifact(self.artifact_path)
        finally:
            temp_path.unlink(missing_ok=True)

        result["promoted"] = True
        result["artifact_path"] = str(self.artifact_path)
        return result

    async def reset_learning_demo(self) -> dict[str, Any]:
        """Reset persistent learning state and restore the seeded champion."""

        async with self._lock:
            if self.training:
                raise RuntimeError("Wait for the current retraining cycle to finish")

            transaction_store.reset_learning_demo()
            self.artifact_path.unlink(missing_ok=True)
            await asyncio.to_thread(local_model.reset_to_synthetic)
            self.training = False
            self._load_persistent_state()
            return self.status()

    def restore_persisted_model(self) -> bool:
        """Restore the latest promoted model after an ephemeral web restart."""

        self.refresh_persistent_state()
        persisted = transaction_store.latest_model_artifact()
        if persisted is None:
            return False
        self.artifact_path.parent.mkdir(parents=True, exist_ok=True)
        self.artifact_path.write_bytes(persisted["artifact_bytes"])
        local_model.load_artifact(self.artifact_path)
        return True

    def status(self) -> dict[str, Any]:
        reviewed_rows = transaction_store.stats()["reviewed_rows"]
        return {
            "enabled": self.enabled,
            "training": self.training,
            "algorithm": self.algorithm,
            "min_reviewed": self.min_reviewed,
            "batch_size": self.batch_size,
            "reviewed_rows": reviewed_rows,
            # Backward-compatible alias used by the existing frontend.
            "last_trained_reviewed_rows": self.last_attempted_reviewed_rows,
            "last_attempted_reviewed_rows": self.last_attempted_reviewed_rows,
            "last_promoted_reviewed_rows": self.last_promoted_reviewed_rows,
            "next_retrain_at": self.next_threshold(),
            "artifact_path": str(self.artifact_path),
            "quality_gates": {
                "selection_score": self.min_selection_score,
                "recall": self.min_recall,
                "balanced_accuracy": self.min_balanced_accuracy,
            },
            "last_started_at": self.last_started_at,
            "last_completed_at": self.last_completed_at,
            "last_error": self.last_error,
            "last_result": self.last_result,
            "promotions": self.promotions,
            "evaluation_dataset": "fixed_evaluation_120.csv",
        }


retraining_manager = ReviewRetrainingManager()
