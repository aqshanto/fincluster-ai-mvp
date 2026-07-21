from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from core.orchestrator import orchestrator
from core.security import authenticate_operator, create_access_token, verify_token
from core.transaction_store import transaction_store
from ml.hybrid_ai_engine import hybrid_ai
from models.schemas import (
    ClassificationFeedbackRequest,
    LoginRequest,
    ManualTxRequest,
    TokenResponse,
)


logger = logging.getLogger("fincluster")


def _cors_origins() -> list[str]:
    configured = os.getenv(
        "CORS_ORIGINS",
        "https://fincluster-ai-mvp.vercel.app,http://localhost:3000",
    )

    origins = [
        origin.strip().rstrip("/")
        for origin in configured.split(",")
        if origin.strip()
    ]

    return origins or ["http://localhost:3000"]


CORS_ORIGINS = _cors_origins()


class TelemetryConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def accept(self, websocket: WebSocket) -> None:
        await websocket.accept()

    def add(self, websocket: WebSocket) -> None:
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    @staticmethod
    async def _send(websocket: WebSocket, payload: dict) -> bool:
        try:
            await asyncio.wait_for(
                websocket.send_json(payload),
                timeout=0.75,
            )
            return True

        except Exception:
            return False

    async def broadcast(self, payload: dict) -> None:
        connections = tuple(self.connections)

        if not connections:
            return

        results = await asyncio.gather(
            *(self._send(ws, payload) for ws in connections),
            return_exceptions=False,
        )

        for websocket, delivered in zip(
            connections,
            results,
            strict=True,
        ):
            if not delivered:
                self.disconnect(websocket)


manager = TelemetryConnectionManager()

simulation_lock = asyncio.Lock()


async def simulation_loop() -> None:
    """
    The only code path that advances global simulation time.
    """

    while True:
        try:
            async with simulation_lock:
                orchestrator.update_simulation(100.0)
                snapshot = orchestrator.get_telemetry()

            await manager.broadcast(snapshot)

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception("Simulation tick failed")

        await asyncio.sleep(0.1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(
        simulation_loop(),
        name="fincluster-simulation-loop",
    )

    try:
        yield

    finally:
        task.cancel()

        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="FinCluster AI MVP Backend",
    version="1.2.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


@app.get("/")
async def root_status():
    runtime = hybrid_ai.status()

    return {
        "system": "FinCluster AI Core Switch & Routing Engine",
        "status": "ONLINE",
        "version": "1.2.0-MVP",
        "protocol": "ISO-8583 / ISO-20022 simulation",
        "documentation": "/docs",
        "access_model": (
            "Public read-only telemetry; "
            "operator JWT required for control actions"
        ),
        "ai": {
            "auto_simulation": runtime["auto_engine"],
            "manual_simulation": runtime["manual_engine"],
            "external_ai_available": runtime["external_ai_available"],
        },
    }


@app.post(
    "/api/v1/auth/login",
    response_model=TokenResponse,
)
async def login(request: LoginRequest):

    if not authenticate_operator(
        request.username,
        request.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    return TokenResponse(
        access_token=create_access_token(
            request.username
        )
    )


@app.get("/api/v1/auth/me")
async def current_operator(
    operator: dict = Depends(verify_token),
):
    return {
        "username": operator["sub"],
        "role": operator["role"],
    }


@app.get("/api/v1/ai/status")
async def ai_status():
    return {
        "ai_runtime": hybrid_ai.status(),
        "dataset": transaction_store.stats(),
    }


@app.post("/api/v1/control/toggle-ai")
async def toggle_ai(
    _: dict = Depends(verify_token),
):
    async with simulation_lock:
        orchestrator.ai_enabled = (
            not orchestrator.ai_enabled
        )

        return {
            "status": "success",
            "ai_enabled": orchestrator.ai_enabled,
        }


@app.post("/api/v1/control/toggle-external-ai")
async def toggle_external_ai(
    _: dict = Depends(verify_token),
):
    try:
        enabled = hybrid_ai.toggle_external()

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    async with simulation_lock:
        snapshot = orchestrator.get_telemetry()

    await manager.broadcast(snapshot)

    return {
        "status": "success",
        "external_ai_enabled": enabled,
        "manual_engine": (
            "gemini_api"
            if enabled
            else "local_ml"
        ),
    }


@app.post("/api/v1/control/toggle-surge")
async def toggle_surge(
    _: dict = Depends(verify_token),
):
    async with simulation_lock:
        orchestrator.surge_active = (
            not orchestrator.surge_active
        )

        return {
            "status": "success",
            "surge_active": orchestrator.surge_active,
        }


@app.post("/api/v1/control/trigger-anomaly")
async def trigger_anomaly(
    _: dict = Depends(verify_token),
):
    async with simulation_lock:
        orchestrator.anomaly_active = (
            not orchestrator.anomaly_active
        )

        return {
            "status": "success",
            "anomaly_active": orchestrator.anomaly_active,
        }


@app.post("/api/v1/control/reset")
async def reset_simulation(
    _: dict = Depends(verify_token),
):

    async with simulation_lock:
        orchestrator.reset_simulation()
        snapshot = orchestrator.get_telemetry()

    await manager.broadcast(snapshot)

    return {
        "status": "success",
        "message": "Simulation reset",
        "run_id": snapshot["run_id"],
    }


@app.post("/api/v1/transaction/inject")
async def inject_transaction(
    request: ManualTxRequest,
    _: dict = Depends(verify_token),
):

    metadata = request.metadata.model_dump(
        mode="json"
    )

    # External AI inference never blocks simulation.
    analysis = await hybrid_ai.score_manual(
        amount=request.amount,
        tx_type=request.tx_type,
        account_age_days=request.account_age_days,
        mcc=metadata["mcc"],
        is_vpn=metadata["is_vpn"],
    )

    async with simulation_lock:

        result = orchestrator.inject_manual_transaction(
            amount=request.amount,
            tx_type=request.tx_type,
            account_age_days=request.account_age_days,
            metadata=metadata,
            analysis=analysis,
        )

        snapshot = orchestrator.get_telemetry()

    await manager.broadcast(snapshot)

    return result


@app.post("/api/v1/ai/feedback")
async def classification_feedback(
    request: ClassificationFeedbackRequest,
    _: dict = Depends(verify_token),
):

    saved = transaction_store.add_feedback(
        request.event_uid,
        request.reviewed_label,
    )

    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Manual transaction was not found "
                "in the current dataset"
            ),
        )

    return {
        "status": "success",
        "event_uid": request.event_uid,
        "reviewed_label": request.reviewed_label,
    }


@app.get("/api/v1/ai/dataset.csv")
async def export_dataset(
    _: dict = Depends(verify_token),
):

    try:
        csv_text = transaction_store.export_csv()

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset storage unavailable",
        ) from exc

    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Content-Disposition":
            'attachment; filename="fincluster-training-data.csv"'
        },
    )


@app.websocket("/ws/telemetry")
async def websocket_telemetry(
    websocket: WebSocket,
):

    origin = websocket.headers.get("origin")

    if origin and origin.rstrip("/") not in CORS_ORIGINS:
        await websocket.close(
            code=1008,
            reason="Origin is not allowed",
        )
        return


    await manager.accept(websocket)

    async with simulation_lock:
        snapshot = orchestrator.get_telemetry()

    await websocket.send_json(snapshot)

    manager.add(websocket)

    try:
        while True:
            await websocket.receive_text()

    except (
        WebSocketDisconnect,
        RuntimeError,
    ):
        manager.disconnect(websocket)