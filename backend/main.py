from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from core.orchestrator import orchestrator
from core.security import authenticate_operator, create_access_token, verify_token
from models.schemas import LoginRequest, ManualTxRequest, TokenResponse


class TelemetryConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def accept(self, websocket: WebSocket) -> None:
        await websocket.accept()

    def add(self, websocket: WebSocket) -> None:
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        stale: list[WebSocket] = []
        for websocket in tuple(self.connections):
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)


manager = TelemetryConnectionManager()
simulation_lock = asyncio.Lock()


async def simulation_loop() -> None:
    """The only code path that advances global simulation time."""
    while True:
        async with simulation_lock:
            orchestrator.update_simulation(100.0)
            snapshot = orchestrator.get_telemetry()
        await manager.broadcast(snapshot)
        await asyncio.sleep(0.1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(simulation_loop(), name="fincluster-simulation-loop")
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="FinCluster AI MVP Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root_status():
    return {
        "system": "FinCluster AI Core Switch & Routing Engine",
        "status": "ONLINE",
        "version": "1.1.0-MVP",
        "protocol": "ISO-8583 / ISO-20022 simulation",
        "documentation": "/docs",
        "access_model": "Public read-only telemetry; operator JWT required for control actions",
    }


@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    if not authenticate_operator(request.username, request.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    return TokenResponse(access_token=create_access_token(request.username))


@app.get("/api/v1/auth/me")
async def current_operator(operator: dict = Depends(verify_token)):
    return {"username": operator["sub"], "role": operator["role"]}


@app.post("/api/v1/control/toggle-ai")
async def toggle_ai(_: dict = Depends(verify_token)):
    async with simulation_lock:
        orchestrator.ai_enabled = not orchestrator.ai_enabled
        return {"status": "success", "ai_enabled": orchestrator.ai_enabled}


@app.post("/api/v1/control/toggle-surge")
async def toggle_surge(_: dict = Depends(verify_token)):
    async with simulation_lock:
        orchestrator.surge_active = not orchestrator.surge_active
        return {"status": "success", "surge_active": orchestrator.surge_active}


@app.post("/api/v1/control/trigger-anomaly")
async def trigger_anomaly(_: dict = Depends(verify_token)):
    async with simulation_lock:
        orchestrator.anomaly_active = not orchestrator.anomaly_active
        return {"status": "success", "anomaly_active": orchestrator.anomaly_active}


@app.post("/api/v1/control/reset")
async def reset_simulation(_: dict = Depends(verify_token)):
    async with simulation_lock:
        orchestrator.reset_simulation()
        snapshot = orchestrator.get_telemetry()
    await manager.broadcast(snapshot)
    return {"status": "success", "message": "Simulation reset", "run_id": snapshot["run_id"]}


@app.post("/api/v1/transaction/inject")
async def inject_transaction(request: ManualTxRequest, _: dict = Depends(verify_token)):
    async with simulation_lock:
        result = orchestrator.inject_manual_transaction(
            amount=request.amount,
            tx_type=request.tx_type,
            account_age_days=request.account_age_days,
            metadata=request.metadata.model_dump(),
        )
        snapshot = orchestrator.get_telemetry()
    await manager.broadcast(snapshot)
    return result


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.accept(websocket)
    async with simulation_lock:
        snapshot = orchestrator.get_telemetry()
    await websocket.send_json(snapshot)
    manager.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
