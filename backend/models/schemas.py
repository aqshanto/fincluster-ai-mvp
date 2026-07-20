from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TransactionMetadata(BaseModel):
    stan: str
    rrn: str
    mcc: str
    terminal_id: str
    device_id: str
    ip_address: str
    is_vpn: bool
    location: str


class ManualTxRequest(BaseModel):
    amount: float = Field(gt=0)
    tx_type: Literal[0, 1, 2]
    account_age_days: int = Field(ge=0)
    metadata: TransactionMetadata


class NodeStatus(BaseModel):
    id: int
    name: str
    type: Literal["heavy", "light", "dynamic"]
    load: float
    temp: float
    assigned: int
    status: Literal["healthy", "warning", "crashed", "standby"]
    costActive: float
    costStandby: float
