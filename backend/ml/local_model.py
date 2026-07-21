from __future__ import annotations

import math
import os
import random
from pathlib import Path
from dataclasses import dataclass
from typing import Any

from ml.rule_engine import rule_engine

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    import joblib
except ImportError:  # pragma: no cover - exercised only in a broken deployment
    RandomForestClassifier = None  # type: ignore[assignment]


MCCS = ("5411", "6011", "4814", "7995")


@dataclass(frozen=True)
class ModelMetrics:
    accuracy: float
    precision: float
    recall: float
    roc_auc: float
    training_rows: int
    validation_rows: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "accuracy": round(self.accuracy, 4),
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "roc_auc": round(self.roc_auc, 4),
            "training_rows": self.training_rows,
            "validation_rows": self.validation_rows,
        }


class LocalTransactionClassifier:
    """A genuine local ML classifier trained once on seeded synthetic data.

    The labels are generated from a non-linear latent risk process with noise and
    interaction effects. This is appropriate for a simulator when private MFS
    data is unavailable, but the status endpoint clearly identifies the dataset
    as synthetic so it is not presented as production fraud intelligence.
    """

    MODEL_NAME = "RandomForestClassifier-synthetic-v1"
    DATASET_SOURCE = "seeded synthetic MFS workload data"
    FEATURE_VERSION = 1
    HEAVY_THRESHOLD = 0.52

    def __init__(self, rows: int = 6000, seed: int = 2026) -> None:
        self.rows = rows
        self.seed = seed
        self.available = RandomForestClassifier is not None
        self.model: Any | None = None
        self.metrics: ModelMetrics | None = None
        self.error: str | None = None
        self.model_name = self.MODEL_NAME
        self.dataset_source = self.DATASET_SOURCE
        configured_path = os.getenv("LOCAL_MODEL_PATH", "").strip()
        self.artifact_path = Path(configured_path) if configured_path else None
        if self.available:
            try:
                if self.artifact_path and self.artifact_path.exists():
                    self._load_artifact(self.artifact_path)
                else:
                    self._train()
            except Exception as exc:  # keep the simulator alive with rule fallback
                self.available = False
                self.error = f"Local model initialization failed: {type(exc).__name__}: {exc}"


    def _load_artifact(self, path: Path) -> None:
        artifact = joblib.load(path)
        if artifact.get("feature_version") != self.FEATURE_VERSION:
            raise ValueError("model artifact feature version is incompatible")
        model = artifact.get("model")
        if not hasattr(model, "predict_proba"):
            raise ValueError("model artifact does not support probability inference")
        metrics = artifact.get("metrics") or {}
        self.model = model
        self.model_name = str(artifact.get("model_name", "RandomForestClassifier-reviewed-v1"))
        self.dataset_source = str(artifact.get("dataset_source", "human-reviewed simulator transactions"))
        self.metrics = ModelMetrics(
            accuracy=float(metrics.get("accuracy", 0.0)),
            precision=float(metrics.get("precision", 0.0)),
            recall=float(metrics.get("recall", 0.0)),
            roc_auc=float(metrics.get("roc_auc", 0.0)),
            training_rows=int(metrics.get("training_rows", 0)),
            validation_rows=int(metrics.get("validation_rows", 0)),
        )

    @staticmethod
    def _vectorize(
        *, amount: float, tx_type: int, account_age_days: int, mcc: str, is_vpn: bool
    ) -> list[float]:
        safe_amount = max(1.0, amount)
        return [
            math.log1p(safe_amount),
            min(account_age_days, 3650) / 3650.0,
            float(is_vpn),
            float(tx_type == 0),
            float(tx_type == 1),
            float(tx_type == 2),
            float(mcc == "5411"),
            float(mcc == "6011"),
            float(mcc == "4814"),
            float(mcc == "7995"),
            float(amount >= 20_000 and is_vpn),
            float(account_age_days < 30 and tx_type == 1),
        ]

    @staticmethod
    def _latent_probability(
        *, amount: float, tx_type: int, account_age_days: int, mcc: str, is_vpn: bool, noise: float
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
            amount = round(math.exp(rng.uniform(math.log(100), math.log(100_000))), 2)
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
                self._vectorize(
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
        assert RandomForestClassifier is not None
        features, labels = self._generate_dataset()
        x_train, x_valid, y_train, y_valid = train_test_split(
            features,
            labels,
            test_size=0.22,
            random_state=self.seed,
            stratify=labels,
        )
        model = RandomForestClassifier(
            n_estimators=140,
            max_depth=9,
            min_samples_leaf=5,
            class_weight="balanced_subsample",
            random_state=self.seed,
            n_jobs=1,
        )
        model.fit(x_train, y_train)
        probabilities = model.predict_proba(x_valid)[:, 1]
        predictions = [int(probability >= self.HEAVY_THRESHOLD) for probability in probabilities]
        self.model = model
        self.metrics = ModelMetrics(
            accuracy=accuracy_score(y_valid, predictions),
            precision=precision_score(y_valid, predictions, zero_division=0),
            recall=recall_score(y_valid, predictions, zero_division=0),
            roc_auc=roc_auc_score(y_valid, probabilities),
            training_rows=len(x_train),
            validation_rows=len(x_valid),
        )

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
            return rule_engine.fallback_score_transaction(
                amount=amount,
                tx_type=tx_type,
                account_age_days=account_age_days,
                mcc=mcc,
                is_vpn=is_vpn,
                fallback_reason=self.error or "scikit-learn is not installed",
            )

        vector = self._vectorize(
            amount=amount,
            tx_type=tx_type,
            account_age_days=account_age_days,
            mcc=mcc,
            is_vpn=is_vpn,
        )
        probability = float(self.model.predict_proba([vector])[0][1])
        is_heavy = probability >= self.HEAVY_THRESHOLD
        risk_score = int(round(probability * 100))

        if probability >= 0.72:
            risk_level = "high"
            task_path = "DEEP FRAUD CHECK"
        elif is_heavy:
            risk_level = "medium"
            task_path = "ENHANCED VERIFICATION"
        else:
            risk_level = "low"
            task_path = "LIGHT FAST-PATH"

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
            "model_name": self.model_name,
            "confidence": round(abs(probability - 0.5) * 2.0, 3),
            "api_used": False,
            "fallback_reason": None,
        }

    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model_name": self.model_name,
            "dataset_source": self.dataset_source,
            "metrics": self.metrics.as_dict() if self.metrics else None,
            "artifact_path": str(self.artifact_path) if self.artifact_path else None,
            "error": self.error,
        }


local_model = LocalTransactionClassifier()
