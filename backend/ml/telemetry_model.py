from __future__ import annotations


class ThermalPredictor:
    """Small deterministic thermal guard used as a local, non-blocking baseline."""

    def risk_level(self, load: float, temp: float) -> str:
        if temp >= 95:
            return "critical"
        if temp >= 85 or (temp >= 75 and load >= 80):
            return "high"
        if temp >= 75 or (temp >= 68 and load >= 90):
            return "warning"
        return "normal"

    def predict_overheat_risk(self, load: float, temp: float) -> bool:
        return self.risk_level(load, temp) in {"warning", "high", "critical"}


thermal_ml = ThermalPredictor()
