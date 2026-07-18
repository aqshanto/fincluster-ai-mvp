from pydantic import BaseModel
from typing import List, Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class NodeStatus(BaseModel):
    id: int
    name: str
    type: str  # 'heavy', 'light', or 'dynamic'
    load: float
    temp: float
    assigned: int
    status: str  # 'healthy', 'warning', 'crashed', or 'standby'
    costActive: float
    costStandby: float

class TelemetryData(BaseModel):
    uptime: float
    latency: float
    active_nodes: str
    sim_time: str
    total_heavy: int
    total_light: int
    saved_cost: float
    nodes: List[NodeStatus]
    ai_enabled: bool
    surge_active: bool
    anomaly_active: bool