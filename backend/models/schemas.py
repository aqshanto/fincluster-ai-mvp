from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, IPvAnyAddress, field_validator


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TransactionMetadata(BaseModel):
    stan: str = Field(pattern=r"^\d{6}$")
    rrn: str = Field(pattern=r"^\d{12}$")
    mcc: str = Field(pattern=r"^\d{4}$")
    terminal_id: str = Field(min_length=1, max_length=64)
    device_id: str = Field(min_length=1, max_length=64)
    ip_address: IPvAnyAddress
    is_vpn: bool
    location: str = Field(min_length=1, max_length=100)

    @field_validator("terminal_id", "device_id", "location")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ManualTxRequest(BaseModel):
    amount: float = Field(gt=0, le=1_000_000)
    tx_type: Literal[0, 1, 2]
    account_age_days: int = Field(ge=0, le=36_500)
    force_human_review: bool = False
    metadata: TransactionMetadata


class ClassificationFeedbackRequest(BaseModel):
    event_uid: str = Field(pattern=r"^\d+:\d+$", max_length=40)
    reviewed_label: Literal["heavy", "light"]


class HumanReviewDecisionRequest(BaseModel):
    event_uid: str = Field(pattern=r"^\d+:\d+$", max_length=40)
    reviewed_label: Literal["heavy", "light"]


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
