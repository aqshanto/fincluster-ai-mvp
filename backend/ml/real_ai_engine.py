"""Backward-compatible imports for older project references.

The deterministic scorer previously in this module was renamed because it was
not a machine-learning model. New code should import `hybrid_ai`, `local_model`,
or `rule_engine` explicitly.
"""

from ml.hybrid_ai_engine import hybrid_ai
from ml.local_model import local_model
from ml.rule_engine import rule_engine

__all__ = ["hybrid_ai", "local_model", "rule_engine"]
