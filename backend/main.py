from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before importing application modules.
# Several modules create global objects during import and read environment
# variables immediately, so this must remain above those imports.
load_dotenv(
    dotenv_path=Path(__file__).resolve().with_name(".env"),
    override=False,
)

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from core.demo_datasets import catalog
from core.orchestrator import orchestrator
from core.security import authenticate_operator, create_access_token, verify_token
from core.transaction_store import DatasetImportError, transaction_store
from ml.hybrid_ai_engine import hybrid_ai
from ml.retraining_manager import retraining_manager
from models.schemas import (
    ClassificationFeedbackRequest,
    HumanReviewDecisionRequest,
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
            *(self._send(websocket, payload) for websocket in connections),
            return_exceptions=False,
        )

        for websocket, delivered in zip(
            connections,
            results,
            strict=True,
        ):
            if not delivered:
                self.disconnect(websocket)


def _float_environment_value(name: str, default: float, *, minimum: float) -> float:
    raw_value = os.getenv(name, str(default))
    try:
        parsed_value = float(raw_value)
    except (TypeError, ValueError):
        logger.warning("Invalid %s=%r; using %.2f", name, raw_value, default)
        return default
    return max(minimum, parsed_value)


SIMULATION_TICK_SECONDS = 0.1
TELEMETRY_BROADCAST_INTERVAL_SECONDS = _float_environment_value(
    "TELEMETRY_BROADCAST_INTERVAL_SECONDS",
    1.0,
    minimum=0.5,
)

manager = TelemetryConnectionManager()
simulation_lock = asyncio.Lock()


async def simulation_loop() -> None:
    """Advance the simulator at 10 Hz while broadcasting a bounded snapshot rate."""

    event_loop = asyncio.get_running_loop()
    next_broadcast_at = event_loop.time() + TELEMETRY_BROADCAST_INTERVAL_SECONDS

    while True:
        tick_started_at = event_loop.time()
        try:
            snapshot: dict | None = None
            current_time = event_loop.time()

            if not manager.connections:
                next_broadcast_at = current_time + TELEMETRY_BROADCAST_INTERVAL_SECONDS

            should_broadcast = bool(manager.connections) and current_time >= next_broadcast_at

            async with simulation_lock:
                orchestrator.update_simulation(SIMULATION_TICK_SECONDS * 1000.0)
                if should_broadcast:
                    snapshot = orchestrator.get_telemetry()

            if snapshot is not None:
                await manager.broadcast(snapshot)
                next_broadcast_at = event_loop.time() + TELEMETRY_BROADCAST_INTERVAL_SECONDS

        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Simulation tick failed")

        tick_elapsed = event_loop.time() - tick_started_at
        await asyncio.sleep(max(0.0, SIMULATION_TICK_SECONDS - tick_elapsed))


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        restored = await asyncio.to_thread(retraining_manager.restore_persisted_model)
        if restored:
            logger.info("Restored the latest promoted model from persistent storage")
        # Recover automatically if a deployment happened after a complete batch
        # committed but before its retraining attempt finished.
        await retraining_manager.maybe_retrain()
    except Exception:
        logger.exception("Could not restore or catch up persistent learning state")

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
    version="1.3.0",
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
        "version": "1.3.0-MVP",
        "protocol": "ISO-8583 / ISO-20022 simulation",
        "documentation": "/docs",
        "access_model": (
            "Public read-only telemetry; "
            "operator JWT required for control actions"
        ),
        "storage": transaction_store.stats()["storage"],
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
        access_token=create_access_token(request.username)
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
        "retraining": retraining_manager.status(),
    }


@app.get("/api/v1/ai/demo-batches")
async def demo_batches():
    manifest = catalog.manifest()
    return {
        "status": "success",
        "dataset_name": manifest.get("dataset_name"),
        "dataset_version": manifest.get("dataset_version"),
        "contains_real_customer_data": manifest.get("contains_real_customer_data", False),
        "limitations": manifest.get("limitations", []),
        "batches": catalog.batches(),
        "imports": transaction_store.list_dataset_imports(),
        "dataset": transaction_store.stats(),
        "retraining": retraining_manager.status(),
    }


@app.get("/api/v1/ai/retraining/history")
async def retraining_history(limit: int = 20):
    return {
        "status": "success",
        "items": transaction_store.list_retraining_runs(limit=limit),
        "retraining": retraining_manager.status(),
    }


async def _broadcast_current_snapshot() -> None:
    async with simulation_lock:
        snapshot = orchestrator.get_telemetry()
    await manager.broadcast(snapshot)


@app.post("/api/v1/ai/demo-batches/{batch_id}/import")
async def import_demo_batch(
    batch_id: str,
    operator: dict = Depends(verify_token),
):
    if retraining_manager.training:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wait for the current retraining cycle to finish before importing another batch",
        )
    try:
        batch = catalog.get_batch(batch_id)
        result = transaction_store.import_reviewed_csv(
            csv_bytes=batch["path"].read_bytes(),
            batch_id=str(batch["batch_id"]),
            filename=str(batch["filename"]),
            imported_by=str(operator["sub"]),
            expected_start_reviewed=int(batch["expected_start_reviewed"]),
            expected_end_reviewed=int(batch["expected_end_reviewed"]),
            strict_sequence=True,
            metadata={
                "label": batch.get("label"),
                "description": batch.get("description"),
                "prepared_dataset": True,
            },
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prepared demo batch was not found",
        ) from exc
    except (DatasetImportError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    retraining = await retraining_manager.maybe_retrain()
    await _broadcast_current_snapshot()
    return {
        **result,
        "dataset": transaction_store.stats(),
        "retraining": retraining,
    }


@app.post("/api/v1/ai/datasets/import")
async def import_custom_dataset(
    file: UploadFile = File(...),
    batch_id: str = Form(...),
    expected_start_reviewed: int | None = Form(default=None),
    expected_end_reviewed: int | None = Form(default=None),
    strict_sequence: bool = Form(default=False),
    operator: dict = Depends(verify_token),
):
    if retraining_manager.training:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wait for the current retraining cycle to finish before importing another batch",
        )
    filename = file.filename or "reviewed-transactions.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only UTF-8 CSV files are supported",
        )
    contents = await file.read()
    if len(contents) > 2_000_000:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CSV imports are limited to 2 MB",
        )
    try:
        result = transaction_store.import_reviewed_csv(
            csv_bytes=contents,
            batch_id=batch_id,
            filename=filename,
            imported_by=str(operator["sub"]),
            expected_start_reviewed=expected_start_reviewed,
            expected_end_reviewed=expected_end_reviewed,
            strict_sequence=strict_sequence,
            metadata={"prepared_dataset": False},
        )
    except DatasetImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    retraining = await retraining_manager.maybe_retrain()
    await _broadcast_current_snapshot()
    return {
        **result,
        "dataset": transaction_store.stats(),
        "retraining": retraining,
    }


@app.post("/api/v1/ai/demo/reset")
async def reset_learning_demo(_: dict = Depends(verify_token)):
    if retraining_manager.training:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wait for the current retraining cycle to finish before resetting",
        )
    try:
        retraining = await retraining_manager.reset_learning_demo()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    async with simulation_lock:
        orchestrator.reset_simulation()
        snapshot = orchestrator.get_telemetry()
    await manager.broadcast(snapshot)
    return {
        "status": "success",
        "message": "Persistent learning demo reset to zero reviewed labels",
        "dataset": transaction_store.stats(),
        "retraining": retraining,
    }


@app.post("/api/v1/ai/retrain")
async def run_retraining(_: dict = Depends(verify_token)):
    before = retraining_manager.status()
    result = await retraining_manager.maybe_retrain()
    await _broadcast_current_snapshot()
    return {
        "status": "success",
        "triggered": before["reviewed_rows"] >= before["next_retrain_at"],
        "retraining": result,
    }


@app.post("/api/v1/control/toggle-ai")
async def toggle_ai(
    _: dict = Depends(verify_token),
):
    async with simulation_lock:
        orchestrator.ai_enabled = not orchestrator.ai_enabled

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
        orchestrator.surge_active = not orchestrator.surge_active

        return {
            "status": "success",
            "surge_active": orchestrator.surge_active,
        }


@app.post("/api/v1/control/trigger-anomaly")
async def trigger_anomaly(
    _: dict = Depends(verify_token),
):
    async with simulation_lock:
        orchestrator.anomaly_active = not orchestrator.anomaly_active

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
    metadata = request.metadata.model_dump(mode="json")

    # External inference must never hold the global simulation lock.
    # A slow or rate-limited provider therefore cannot freeze telemetry
    # or automatic simulator traffic.
    analysis = await hybrid_ai.score_manual(
        amount=request.amount,
        tx_type=request.tx_type,
        account_age_days=request.account_age_days,
        mcc=metadata["mcc"],
        is_vpn=metadata["is_vpn"],
    )

    if request.force_human_review:
        analysis["review_required"] = True

        reasons = list(
            analysis.get("review_reasons") or []
        )
        reasons.append(
            "Operator explicitly requested human review"
        )

        analysis["review_reasons"] = reasons

    try:
        async with simulation_lock:
            if analysis.get("review_required", False):
                result = orchestrator.hold_manual_transaction(
                    amount=request.amount,
                    tx_type=request.tx_type,
                    account_age_days=request.account_age_days,
                    metadata=metadata,
                    analysis=analysis,
                )
            else:
                result = orchestrator.inject_manual_transaction(
                    amount=request.amount,
                    tx_type=request.tx_type,
                    account_age_days=request.account_age_days,
                    metadata=metadata,
                    analysis=analysis,
                )

            snapshot = orchestrator.get_telemetry()

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await manager.broadcast(snapshot)

    return result


@app.get("/api/v1/ai/reviews")
async def pending_reviews(
    limit: int = 50,
    _: dict = Depends(verify_token),
):
    safe_limit = max(1, min(limit, 200))

    return {
        "status": "success",
        "items": transaction_store.list_pending_reviews(
            limit=safe_limit
        ),
        "dataset": transaction_store.stats(),
        "retraining": retraining_manager.status(),
    }


@app.post("/api/v1/ai/reviews/resolve")
async def resolve_human_review(
    request: HumanReviewDecisionRequest,
    operator: dict = Depends(verify_token),
):
    pending = transaction_store.get_pending_review(
        request.event_uid
    )

    if pending is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending transaction review was not found",
        )

    try:
        async with simulation_lock:
            result = orchestrator.resolve_manual_review(
                pending,
                reviewed_label=request.reviewed_label,
                reviewed_by=str(operator["sub"]),
            )

            snapshot = orchestrator.get_telemetry()

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    await manager.broadcast(snapshot)

    asyncio.create_task(
        retraining_manager.maybe_retrain(),
        name="fincluster-reviewed-data-retraining",
    )

    result["dataset"] = transaction_store.stats()
    result["retraining"] = retraining_manager.status()

    return result


@app.post("/api/v1/ai/feedback")
async def classification_feedback(
    request: ClassificationFeedbackRequest,
    operator: dict = Depends(verify_token),
):
    saved = transaction_store.add_feedback(
        request.event_uid,
        request.reviewed_label,
        reviewed_by=str(operator["sub"]),
    )

    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Manual transaction was not found, "
                "or it is still waiting in the review queue"
            ),
        )

    asyncio.create_task(
        retraining_manager.maybe_retrain(),
        name="fincluster-feedback-retraining",
    )

    return {
        "status": "success",
        "event_uid": request.event_uid,
        **saved,
        "dataset": transaction_store.stats(),
        "retraining": retraining_manager.status(),
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
            "Content-Disposition": (
                'attachment; filename="fincluster-training-data.csv"'
            )
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

    try:
        async with simulation_lock:
            snapshot = orchestrator.get_telemetry()

        await websocket.send_json(snapshot)
        manager.add(websocket)

        while True:
            await websocket.receive_text()

    except (WebSocketDisconnect, RuntimeError):
        manager.disconnect(websocket)

    except Exception:
        manager.disconnect(websocket)
        logger.exception("Unexpected WebSocket telemetry error")