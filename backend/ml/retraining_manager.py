from __future__ import annotations

import asyncio
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from core.transaction_store import transaction_store
from ml.features import FEATURE_VERSION, vectorize_transaction
from ml.local_model import local_model
from ml.model_training import train_and_select_model


class ReviewRetrainingManager:
    """Controlled batch retraining from human-reviewed simulator labels.

    Retraining never runs in the transaction request path. It is disabled by
    default in production and can be enabled locally. A candidate artifact is
    promoted only after it passes explicit quality gates.
    """

    def __init__(self) -> None:
        self.enabled = os.getenv("AUTO_RETRAIN_ENABLED", "false").lower() in {
            "1",
            "true",
            "yes",
        }
        self.min_reviewed = max(50, int(os.getenv("AUTO_RETRAIN_MIN_REVIEWED", "100")))
        self.batch_size = max(5, int(os.getenv("AUTO_RETRAIN_BATCH_SIZE", "25")))
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
        self._lock = asyncio.Lock()
        self.last_trained_reviewed_rows = 0
        self.last_started_at: str | None = None
        self.last_completed_at: str | None = None
        self.last_error: str | None = None
        self.last_result: dict[str, Any] | None = None
        self.training = False
        self.promotions = 0

    def _review_counts(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        heavy = sum(1 for row in rows if row["reviewed_label"] == "heavy")
        light = sum(1 for row in rows if row["reviewed_label"] == "light")
        return heavy, light

    def should_retrain(self, reviewed_rows: int) -> bool:
        if not self.enabled or self.training:
            return False
        if reviewed_rows < self.min_reviewed:
            return False
        return reviewed_rows - self.last_trained_reviewed_rows >= self.batch_size

    async def maybe_retrain(self) -> dict[str, Any]:
        rows = transaction_store.reviewed_training_rows()
        if not self.should_retrain(len(rows)):
            return self.status()

        async with self._lock:
            rows = transaction_store.reviewed_training_rows()
            if not self.should_retrain(len(rows)):
                return self.status()
            self.training = True
            self.last_started_at = datetime.now(timezone.utc).isoformat()
            try:
                result = await asyncio.to_thread(self._train_sync, rows)
                self.last_result = result
                self.last_error = None
                if result["promoted"]:
                    self.last_trained_reviewed_rows = len(rows)
                    self.promotions += 1
            except Exception as exc:  # keep the currently loaded model online
                self.last_error = f"{type(exc).__name__}: {exc}"
            finally:
                self.training = False
                self.last_completed_at = datetime.now(timezone.utc).isoformat()
        return self.status()

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
        metrics = selection.metrics.as_dict()
        quality_passed = (
            selection.metrics.selection_score >= self.min_selection_score
            and selection.metrics.recall >= self.min_recall
            and selection.metrics.balanced_accuracy >= self.min_balanced_accuracy
        )

        result = {
            "reviewed_rows": len(rows),
            "heavy_rows": heavy_count,
            "light_rows": light_count,
            "selected_algorithm": selection.selected_algorithm,
            "model_name": selection.model_name,
            "metrics": metrics,
            "candidate_metrics": selection.candidate_metrics,
            "quality_passed": quality_passed,
            "promoted": False,
        }
        if not quality_passed:
            return result

        artifact = {
            "feature_version": FEATURE_VERSION,
            "model": selection.model,
            "model_name": selection.model_name,
            "dataset_source": "human-reviewed FinCluster simulator transactions",
            "selected_algorithm": selection.selected_algorithm,
            "threshold": selection.threshold,
            "metrics": metrics,
            "candidate_metrics": selection.candidate_metrics,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_rows": len(rows),
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
            temp_path.replace(self.artifact_path)
            local_model.load_artifact(self.artifact_path)
        finally:
            temp_path.unlink(missing_ok=True)

        result["promoted"] = True
        result["artifact_path"] = str(self.artifact_path)
        return result

    def status(self) -> dict[str, Any]:
        reviewed_rows = transaction_store.stats()["reviewed_rows"]
        next_retrain_at = max(
            self.min_reviewed,
            self.last_trained_reviewed_rows + self.batch_size,
        )
        return {
            "enabled": self.enabled,
            "training": self.training,
            "algorithm": self.algorithm,
            "min_reviewed": self.min_reviewed,
            "batch_size": self.batch_size,
            "reviewed_rows": reviewed_rows,
            "last_trained_reviewed_rows": self.last_trained_reviewed_rows,
            "next_retrain_at": next_retrain_at,
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
        }


retraining_manager = ReviewRetrainingManager()
