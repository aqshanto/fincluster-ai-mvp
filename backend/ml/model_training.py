from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Any, Sequence
import importlib.util

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        balanced_accuracy_score,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
except ImportError:  # pragma: no cover - deployment fallback is tested elsewhere
    RandomForestClassifier = None  # type: ignore[assignment]
    train_test_split = None  # type: ignore[assignment]

SUPPORTED_ALGORITHMS = {"auto", "random_forest", "xgboost"}


@dataclass(frozen=True)
class ModelMetrics:
    accuracy: float
    precision: float
    recall: float
    f1: float
    balanced_accuracy: float
    roc_auc: float
    pr_auc: float
    threshold: float
    selection_score: float
    training_rows: int
    validation_rows: int
    test_rows: int
    evaluation_split: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "accuracy": round(self.accuracy, 4),
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
            "balanced_accuracy": round(self.balanced_accuracy, 4),
            "roc_auc": round(self.roc_auc, 4),
            "pr_auc": round(self.pr_auc, 4),
            "threshold": round(self.threshold, 4),
            "selection_score": round(self.selection_score, 4),
            "training_rows": self.training_rows,
            "validation_rows": self.validation_rows,
            "test_rows": self.test_rows,
            "evaluation_split": self.evaluation_split,
        }

    @classmethod
    def from_dict(cls, values: dict[str, Any]) -> "ModelMetrics":
        return cls(
            accuracy=float(values.get("accuracy", 0.0)),
            precision=float(values.get("precision", 0.0)),
            recall=float(values.get("recall", 0.0)),
            f1=float(values.get("f1", 0.0)),
            balanced_accuracy=float(values.get("balanced_accuracy", values.get("accuracy", 0.0))),
            roc_auc=float(values.get("roc_auc", 0.0)),
            pr_auc=float(values.get("pr_auc", 0.0)),
            threshold=float(values.get("threshold", 0.52)),
            selection_score=float(values.get("selection_score", 0.0)),
            training_rows=int(values.get("training_rows", 0)),
            validation_rows=int(values.get("validation_rows", 0)),
            test_rows=int(values.get("test_rows", 0)),
            evaluation_split=str(values.get("evaluation_split", "unknown")),
        )


@dataclass(frozen=True)
class ModelSelection:
    model: Any
    selected_algorithm: str
    model_name: str
    threshold: float
    metrics: ModelMetrics
    candidate_metrics: dict[str, dict[str, Any]]


def ml_dependencies_available() -> bool:
    return RandomForestClassifier is not None and train_test_split is not None


def xgboost_available() -> bool:
    return importlib.util.find_spec("xgboost") is not None


def _xgboost_classifier() -> Any | None:
    if not xgboost_available():
        return None
    from xgboost import XGBClassifier

    return XGBClassifier


def normalize_algorithm(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_")
    aliases = {
        "rf": "random_forest",
        "randomforest": "random_forest",
        "xgb": "xgboost",
        "xgbclassifier": "xgboost",
        "": "auto",
    }
    normalized = aliases.get(normalized, normalized)
    if normalized not in SUPPORTED_ALGORITHMS:
        choices = ", ".join(sorted(SUPPORTED_ALGORITHMS))
        raise ValueError(f"LOCAL_MODEL_ALGORITHM must be one of: {choices}")
    return normalized


def _selection_score(*, f1: float, recall: float, precision: float, balanced_accuracy: float) -> float:
    # Missing a heavy transaction is costly, so recall and F1 receive most weight.
    return 0.45 * f1 + 0.30 * recall + 0.15 * balanced_accuracy + 0.10 * precision


def _evaluate(
    labels: Sequence[int],
    probabilities: Sequence[float],
    *,
    threshold: float,
    training_rows: int,
    validation_rows: int,
    test_rows: int,
    evaluation_split: str,
) -> ModelMetrics:
    predictions = [int(probability >= threshold) for probability in probabilities]
    precision = float(precision_score(labels, predictions, zero_division=0))
    recall = float(recall_score(labels, predictions, zero_division=0))
    f1 = float(f1_score(labels, predictions, zero_division=0))
    balanced = float(balanced_accuracy_score(labels, predictions))
    return ModelMetrics(
        accuracy=float(accuracy_score(labels, predictions)),
        precision=precision,
        recall=recall,
        f1=f1,
        balanced_accuracy=balanced,
        roc_auc=float(roc_auc_score(labels, probabilities)),
        pr_auc=float(average_precision_score(labels, probabilities)),
        threshold=threshold,
        selection_score=_selection_score(
            f1=f1,
            recall=recall,
            precision=precision,
            balanced_accuracy=balanced,
        ),
        training_rows=training_rows,
        validation_rows=validation_rows,
        test_rows=test_rows,
        evaluation_split=evaluation_split,
    )


def _tune_threshold(labels: Sequence[int], probabilities: Sequence[float]) -> float:
    best_threshold = 0.52
    best_key = (-1.0, -1.0, -1.0, -1.0)
    for step in range(25, 76):
        threshold = step / 100.0
        predictions = [int(probability >= threshold) for probability in probabilities]
        precision = float(precision_score(labels, predictions, zero_division=0))
        recall = float(recall_score(labels, predictions, zero_division=0))
        f1 = float(f1_score(labels, predictions, zero_division=0))
        balanced = float(balanced_accuracy_score(labels, predictions))
        score = _selection_score(
            f1=f1,
            recall=recall,
            precision=precision,
            balanced_accuracy=balanced,
        )
        key = (score, recall, f1, precision)
        if key > best_key:
            best_key = key
            best_threshold = threshold
    return best_threshold


def _build_candidates(requested_algorithm: str, y_train: Sequence[int], seed: int) -> dict[str, Any]:
    if RandomForestClassifier is None:
        raise RuntimeError("scikit-learn is not installed")

    candidates: dict[str, Any] = {}
    if requested_algorithm in {"auto", "random_forest"}:
        candidates["random_forest"] = RandomForestClassifier(
            n_estimators=180,
            max_depth=10,
            min_samples_leaf=4,
            class_weight="balanced_subsample",
            random_state=seed,
            n_jobs=1,
        )

    if requested_algorithm in {"auto", "xgboost"}:
        xgb_classifier = _xgboost_classifier()
        if xgb_classifier is None:
            if requested_algorithm == "xgboost":
                raise RuntimeError(
                    "xgboost is not installed; install requirements-xgboost.txt"
                )
        else:
            positives = max(1, sum(int(label == 1) for label in y_train))
            negatives = max(1, len(y_train) - positives)
            candidates["xgboost"] = xgb_classifier(
                n_estimators=240,
                max_depth=5,
                learning_rate=0.045,
                min_child_weight=3,
                subsample=0.86,
                colsample_bytree=0.90,
                reg_alpha=0.05,
                reg_lambda=1.4,
                scale_pos_weight=negatives / positives,
                objective="binary:logistic",
                eval_metric="logloss",
                tree_method="hist",
                random_state=seed,
                n_jobs=1,
                verbosity=0,
            )

    if not candidates:
        raise RuntimeError("No local ML candidate is available")
    return candidates


def train_and_select_model(
    features: Sequence[Sequence[float]],
    labels: Sequence[int],
    *,
    requested_algorithm: str = "auto",
    seed: int = 2026,
    dataset_label: str = "synthetic",
) -> ModelSelection:
    if not ml_dependencies_available():
        raise RuntimeError("scikit-learn is not installed")
    if len(features) != len(labels):
        raise ValueError("Feature and label counts do not match")
    if len(features) < 50:
        raise ValueError("At least 50 rows are required to train a local model")
    class_counts = {label: labels.count(label) for label in set(labels)}
    if set(class_counts) != {0, 1} or min(class_counts.values()) < 10:
        raise ValueError("Training data must contain at least 10 heavy and 10 light rows")

    algorithm = normalize_algorithm(requested_algorithm)
    x_train_valid, x_test, y_train_valid, y_test = train_test_split(
        features,
        labels,
        test_size=0.20,
        random_state=seed,
        stratify=labels,
    )
    x_train, x_valid, y_train, y_valid = train_test_split(
        x_train_valid,
        y_train_valid,
        test_size=0.20,
        random_state=seed,
        stratify=y_train_valid,
    )

    candidates = _build_candidates(algorithm, y_train, seed)
    evaluated: list[tuple[str, Any, float, ModelMetrics]] = []
    candidate_metrics: dict[str, dict[str, Any]] = {}

    for candidate_name, model in candidates.items():
        model.fit(x_train, y_train)
        validation_probabilities = model.predict_proba(x_valid)[:, 1]
        threshold = _tune_threshold(y_valid, validation_probabilities)
        validation_metrics = _evaluate(
            y_valid,
            validation_probabilities,
            threshold=threshold,
            training_rows=len(x_train),
            validation_rows=len(x_valid),
            test_rows=len(x_test),
            evaluation_split="validation",
        )
        candidate_metrics[candidate_name] = validation_metrics.as_dict()
        evaluated.append((candidate_name, model, threshold, validation_metrics))

    selected_name, selected_model, threshold, _ = max(
        evaluated,
        key=lambda item: (
            item[3].selection_score,
            item[3].recall,
            item[3].f1,
            item[3].roc_auc,
        ),
    )
    test_probabilities = selected_model.predict_proba(x_test)[:, 1]
    test_metrics = _evaluate(
        y_test,
        test_probabilities,
        threshold=threshold,
        training_rows=len(x_train),
        validation_rows=len(x_valid),
        test_rows=len(x_test),
        evaluation_split="held_out_test",
    )
    model_version = os.getenv(
        "MODEL_VERSION",
        "v2"
    )

    display_names = {
        "random_forest": f"RandomForestClassifier-{dataset_label}-{model_version}",
        "xgboost": f"XGBClassifier-{dataset_label}-{model_version}",
    }
    return ModelSelection(
        model=selected_model,
        selected_algorithm=selected_name,
        model_name=display_names[selected_name],
        threshold=threshold,
        metrics=test_metrics,
        candidate_metrics=candidate_metrics,
    )
