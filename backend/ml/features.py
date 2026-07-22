from __future__ import annotations

import math

FEATURE_VERSION = 1
MCCS = ("5411", "6011", "4814", "7995")


def vectorize_transaction(
    *,
    amount: float,
    tx_type: int,
    account_age_days: int,
    mcc: str,
    is_vpn: bool,
) -> list[float]:
    """Convert a transaction into the stable numeric feature vector used by local models."""
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
