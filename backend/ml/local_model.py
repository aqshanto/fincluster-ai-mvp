from __future__ import annotations

import math
import os
import random
import threading
from pathlib import Path
from typing import Any

from ml.features import FEATURE_VERSION, MCCS, vectorize_transaction
from ml.model_training import (
    ModelMetrics,
    ml_dependencies_available,
    normalize_algorithm,
    train_and_select_model,
    xgboost_available,
)
from ml.rule_engine import rule_engine

try:
    import joblib
except ImportError:  # pragma: no cover - deployment fallback is tested elsewhere
    joblib = None  # type: ignore[assignment]


class LocalTransactionClassifier:
    """Local heavy/light classifier with Random Forest and XGBoost candidates.

    The runtime model never learns from its own predictions. Human-reviewed
    labels are used by the controlled batch retraining manager, which can load a
    promoted artifact without interrupting transaction scoring.
    """

    MODEL_NAME = "AutoSelectedLocalClassifier-synthetic-v2"
    DATASET_SOURCE = "seeded synthetic MFS workload data"
    FEATURE_VERSION = FEATURE_VERSION
    DEFAULT_THRESHOLD = 0.52

    def __init__(self, rows: int = 6000, seed: int = 2026) -> None:
        self.rows = rows
        self.seed = seed
        self.available = ml_dependencies_available() and joblib is not None
        self.model: Any | None = None
        self.metrics: ModelMetrics | None = None
        self.candidate_metrics: dict[str, dict[str, Any]] = {}
        self.error: str | None = None
        self.model_name = self.MODEL_NAME
        self.dataset_source = self.DATASET_SOURCE
        self.threshold = self.DEFAULT_THRESHOLD
        self.selected_algorithm: str | None = None
        self.requested_algorithm = normalize_algorithm(
            os.getenv("LOCAL_MODEL_ALGORITHM", "random_forest")
        )
        self.review_enabled = os.getenv("HUMAN_REVIEW_ENABLED", "true").lower() in {
            "1",
            "true",
            "yes",
        }
        self.review_confidence_threshold = max(
            0.0,
            min(1.0, float(os.getenv("HUMAN_REVIEW_CONFIDENCE_THRESHOLD", "0.25"))),
        )
        self.review_fallbacks = os.getenv(
            "HUMAN_REVIEW_FALLBACK_REQUIRED", "true"
        ).lower() in {"1", "true", "yes"}
        self._model_lock = threading.RLock()

        configured_path = os.getenv("LOCAL_MODEL_PATH", "").strip()
        if not configured_path and os.getenv("AUTO_RETRAIN_ENABLED", "false").lower() in {
            "1",
            "true",
            "yes",
        }:
            default_retrained_path = (
                Path(__file__).resolve().parents[1]
                / "models"
                / "transaction_classifier.joblib"
            )
            configured_path = os.getenv(
                "AUTO_RETRAIN_MODEL_PATH", str(default_retrained_path)
            ).strip()
        self.artifact_path = Path(configured_path) if configured_path else None

        if self.available:
            try:
                if self.artifact_path and self.artifact_path.exists():
                    self._load_artifact(self.artifact_path)
                else:
                    self._train()
            except Exception as exc:  # keep the simulator alive with rule fallback
                self.available = False
                self.error = (
                    f"Local model initialization failed: {type(exc).__name__}: {exc}"
                )

    def _load_artifact(self, path: Path) -> None:
        assert joblib is not None
        artifact = joblib.load(path)
        if artifact.get("feature_version") != self.FEATURE_VERSION:
            raise ValueError("model artifact feature version is incompatible")
        model = artifact.get("model")
        if not hasattr(model, "predict_proba"):
            raise ValueError("model artifact does not support probability inference")

        metrics = artifact.get("metrics") or {}
        with self._model_lock:
            self.model = model
            self.model_name = str(
                artifact.get("model_name", "LocalClassifier-reviewed-v2")
            )
            self.dataset_source = str(
                artifact.get(
                    "dataset_source", "human-reviewed simulator transactions"
                )
            )
            self.threshold = float(
                artifact.get(
                    "threshold", metrics.get("threshold", self.DEFAULT_THRESHOLD)
                )
            )
            self.selected_algorithm = str(
                artifact.get(
                    "selected_algorithm", artifact.get("model_type", "unknown")
                )
            )
            self.candidate_metrics = dict(artifact.get("candidate_metrics") or {})
            self.metrics = ModelMetrics.from_dict(metrics)
            self.artifact_path = path
            self.available = True
            self.error = None

    def load_artifact(self, path: Path) -> None:
        """Hot-load a validated reviewed-data artifact."""
        self._load_artifact(path)

    @staticmethod
    def _vectorize(
        *, amount: float, tx_type: int, account_age_days: int, mcc: str, is_vpn: bool
    ) -> list[float]:
        """Backward-compatible wrapper used by older scripts and tests."""
        return vectorize_transaction(
            amount=amount,
            tx_type=tx_type,
            account_age_days=account_age_days,
            mcc=mcc,
            is_vpn=is_vpn,
        )

    @staticmethod
    def _latent_probability(
        *,
        amount: float,
        tx_type: int,
        account_age_days: int,
        mcc: str,
        is_vpn: bool,
        noise: float,
    ) -> float:
        log_amount = math.log1p(amount)
        z = -7.1
        z += 0.58 * log_amount
        z += 1.30 if tx_type == 1 else 0.15 if tx_type == 0 else -0.25
        z += 2.10 if is_vpn else 0.0
        z += 1.65 if mcc == "7995" else 0.55 if mcc == "6011" else 0.0
        z += 1.15 if account_age_days < 7 else 0.55 if account_age_days < 30 else 0.0
        z += 1.25 if amount >= 20_000 and is_vpn else 0.0
        z += 0.85 if account_age_days < 30 and tx_type == 1 else 0.0
        z += noise
        return 1.0 / (1.0 + math.exp(-z))

    def _generate_dataset(self) -> tuple[list[list[float]], list[int]]:
        rng = random.Random(self.seed)
        features: list[list[float]] = []
        labels: list[int] = []

        for _ in range(self.rows):
            amount = round(
                math.exp(rng.uniform(math.log(100), math.log(100_000))), 2
            )
            tx_type = rng.choices([0, 1, 2], weights=[0.42, 0.30, 0.28], k=1)[0]
            account_age_days = int(min(3650, rng.expovariate(1 / 420)))
            mcc = rng.choices(MCCS, weights=[0.50, 0.22, 0.20, 0.08], k=1)[0]
            is_vpn = rng.random() < 0.07
            probability = self._latent_probability(
                amount=amount,
                tx_type=tx_type,
                account_age_days=account_age_days,
                mcc=mcc,
                is_vpn=is_vpn,
                noise=rng.gauss(0, 0.45),
            )
            label = int(probability >= 0.50)
            if rng.random() < 0.04:
                label = 1 - label
            features.append(
                vectorize_transaction(
                    amount=amount,
                    tx_type=tx_type,
                    account_age_days=account_age_days,
                    mcc=mcc,
                    is_vpn=is_vpn,
                )
            )
            labels.append(label)

        return features, labels

    def _train(self) -> None:
        features, labels = self._generate_dataset()
        selection = train_and_select_model(
            features,
            labels,
            requested_algorithm=self.requested_algorithm,
            seed=self.seed,
            dataset_label="synthetic",
        )
        with self._model_lock:
            self.model = selection.model
            self.selected_algorithm = selection.selected_algorithm
            self.model_name = selection.model_name
            self.threshold = selection.threshold
            self.metrics = selection.metrics
            self.candidate_metrics = selection.candidate_metrics

    def _review_policy(
        self,
        *,
        confidence: float,
        fallback_reason: str | None,
    ) -> tuple[bool, list[str]]:
        if not self.review_enabled:
            return False, []

        reasons: list[str] = []
        if confidence < self.review_confidence_threshold:
            reasons.append(
                f"Model confidence {confidence:.2f} is below the {self.review_confidence_threshold:.2f} review threshold"
            )
        if fallback_reason and self.review_fallbacks:
            reasons.append("The local ML engine used a fallback decision")
        return bool(reasons), reasons

    def score_transaction(
        self,
        *,
        amount: float,
        tx_type: int,
        account_age_days: int,
        mcc: str = "5411",
        is_vpn: bool = False,
    ) -> dict[str, Any]:
        if not self.available or self.model is None:
            fallback = rule_engine.fallback_score_transaction(
                amount=amount,
                tx_type=tx_type,
                account_age_days=account_age_days,
                mcc=mcc,
                is_vpn=is_vpn,
                fallback_reason=self.error or "local ML dependencies are unavailable",
            )
            predicted_label = "heavy" if fallback["is_heavy"] else "light"
            fallback.update(
                {
                    "predicted_label": predicted_label,
                    "model_probability": fallback["risk_score"] / 100.0,
                    "review_required": self.review_enabled and self.review_fallbacks,
                    "review_reasons": ["The local ML engine used a fallback decision"],
                }
            )
            return fallback

        vector = vectorize_transaction(
            amount=amount,
            tx_type=tx_type,
            account_age_days=account_age_days,
            mcc=mcc,
            is_vpn=is_vpn,
        )
        with self._model_lock:
            model = self.model
            threshold = self.threshold
            model_name = self.model_name
            probability = float(model.predict_proba([vector])[0][1])

        is_heavy = probability >= threshold
        risk_score = int(round(probability * 100))
        confidence = round(
            min(
                1.0,
                abs(probability - threshold) / max(threshold, 1 - threshold),
            ),
            3,
        )

        if probability >= max(0.72, threshold + 0.12):
            risk_level = "high"
            task_path = "DEEP FRAUD CHECK"
        elif is_heavy:
            risk_level = "medium"
            task_path = "ENHANCED VERIFICATION"
        else:
            risk_level = "low"
            task_path = "LIGHT FAST-PATH"

        review_required, review_reasons = self._review_policy(
            confidence=confidence,
            fallback_reason=None,
        )
        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "task_path": task_path,
            "is_heavy": is_heavy,
            "cpu_load_required": round(4.0 + probability * 14.0, 2),
            "factors": rule_engine.evidence_factors(
                amount=amount,
                tx_type=tx_type,
                account_age_days=account_age_days,
                mcc=mcc,
                is_vpn=is_vpn,
            ),
            "classifier_source": "local_ml",
            "model_name": model_name,
            "confidence": confidence,
            "model_probability": round(probability, 6),
            "predicted_label": "heavy" if is_heavy else "light",
            "review_required": review_required,
            "review_reasons": review_reasons,
            "api_used": False,
            "fallback_reason": None,
        }

    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model_name": self.model_name,
            "dataset_source": self.dataset_source,
            "requested_algorithm": self.requested_algorithm,
            "selected_algorithm": self.selected_algorithm,
            "threshold": round(self.threshold, 4),
            "xgboost_available": xgboost_available(),
            "review_policy": {
                "enabled": self.review_enabled,
                "confidence_threshold": self.review_confidence_threshold,
                "fallbacks_require_review": self.review_fallbacks,
            },
            "metrics": self.metrics.as_dict() if self.metrics else None,
            "candidate_metrics": self.candidate_metrics,
            "artifact_path": str(self.artifact_path) if self.artifact_path else None,
            "error": self.error,
        }


local_model = LocalTransactionClassifier()
