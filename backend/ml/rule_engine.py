from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class RiskFactor:
    code: str
    label: str
    points: int
    detail: str


class ExplainableRuleEngine:
    """Transparent rules used for explanations and as the last-resort fallback.

    These rules do not represent the project's ML classifier. They provide
    judge-visible evidence and keep the simulator available if model loading or
    an external AI provider fails.
    """

    HIGH_RISK_MCCS = {"7995": "Gambling / high-risk digital goods"}
    CASH_MCCS = {"6011": "ATM / automated cash disbursement"}

    def evidence_factors(
        self,
        *,
        amount: float,
        tx_type: int,
        account_age_days: int,
        mcc: str = "5411",
        is_vpn: bool = False,
    ) -> list[dict[str, Any]]:
        factors: list[RiskFactor] = []

        if amount >= 40_000:
            factors.append(RiskFactor("amount_critical", "Very large amount", 30, f"BDT {amount:,.0f} is at least BDT 40,000"))
        elif amount >= 20_000:
            factors.append(RiskFactor("amount_high", "Large amount", 20, f"BDT {amount:,.0f} is at least BDT 20,000"))
        elif amount >= 10_000:
            factors.append(RiskFactor("amount_medium", "Elevated amount", 10, f"BDT {amount:,.0f} is at least BDT 10,000"))

        if is_vpn:
            factors.append(RiskFactor("vpn", "VPN / Tor origin", 35, "Origin identity or location is masked"))

        if account_age_days < 7:
            factors.append(RiskFactor("new_account", "Very new account", 20, f"Account is only {account_age_days} day(s) old"))
        elif account_age_days < 30:
            factors.append(RiskFactor("young_account", "Young account", 10, f"Account is {account_age_days} days old"))

        if mcc in self.HIGH_RISK_MCCS:
            factors.append(RiskFactor("high_risk_mcc", "High-risk merchant category", 25, f"MCC {mcc}: {self.HIGH_RISK_MCCS[mcc]}"))
        elif mcc in self.CASH_MCCS:
            factors.append(RiskFactor("cash_mcc", "Cash disbursement", 10, f"MCC {mcc}: {self.CASH_MCCS[mcc]}"))

        if tx_type == 1:
            factors.append(RiskFactor("cashout", "Cash-out transaction", 10, "Cash-out requires agent, liquidity, and velocity checks"))

        return [asdict(factor) for factor in factors]

    def fallback_score_transaction(
        self,
        *,
        amount: float,
        tx_type: int,
        account_age_days: int,
        mcc: str = "5411",
        is_vpn: bool = False,
        fallback_reason: str | None = None,
    ) -> dict[str, Any]:
        factors = self.evidence_factors(
            amount=amount,
            tx_type=tx_type,
            account_age_days=account_age_days,
            mcc=mcc,
            is_vpn=is_vpn,
        )
        score = min(100, sum(int(factor["points"]) for factor in factors))

        if score >= 50:
            risk_level = "high"
            task_path = "DEEP FRAUD CHECK"
            is_heavy = True
            cpu_load_required = 18.0
        elif score >= 25:
            risk_level = "medium"
            task_path = "ENHANCED VERIFICATION"
            is_heavy = True
            cpu_load_required = 11.0
        else:
            risk_level = "low"
            task_path = "LIGHT FAST-PATH"
            is_heavy = False
            cpu_load_required = 4.0

        return {
            "risk_score": score,
            "risk_level": risk_level,
            "task_path": task_path,
            "is_heavy": is_heavy,
            "cpu_load_required": cpu_load_required,
            "factors": factors,
            "classifier_source": "rule_fallback",
            "model_name": "ExplainableRuleEngine",
            "confidence": round(abs(score / 100.0 - 0.5) * 2.0, 3),
            "api_used": False,
            "fallback_reason": fallback_reason,
        }

    def thermal_recommendation(self, node_name: str, temp: float, load: float) -> str:
        if temp >= 95:
            return (
                f"[THERMAL SAFETY]: {node_name} crossed {temp:.1f}°C and was isolated. "
                "Traffic is moving to healthy nodes while forced cooldown runs."
            )
        if temp >= 85:
            return (
                f"[THERMAL MITIGATION]: {node_name} is at {temp:.1f}°C / {load:.0f}% load. "
                "Stop new heavy assignments and divert them to the scaler."
            )
        return (
            f"[THERMAL WATCH]: {node_name} reached {temp:.1f}°C. "
            "Reduce heavy-task allocation and monitor the next thermal interval."
        )


rule_engine = ExplainableRuleEngine()
