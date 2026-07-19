from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import random
import uuid

from core.orchestrator import orchestrator

app = FastAPI(title="FinCluster AI MVP Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ⚠️ নতুন ROOT ENDPOINT (ব্রাউজারে লিংকে ঢোকার পর আর Not Found দেখাবে না)
@app.get("/")
async def root_status():
    return {
        "system": "FinCluster AI Core Switch & Routing Engine",
        "status": "ONLINE 🟢",
        "version": "1.0.0-MVP",
        "protocol": "ISO-8583 / ISO-20022",
        "documentation": "https://fincluster-backend.onrender.com/docs",
        "message": "Welcome to the real-time MFS transaction routing backend!"
    }

class LoginRequest(BaseModel):
    username: str
    password: str

# ⚠️ রিয়েল-ওয়ার্ল্ড ট্রানজিকশন মেটাডেটা স্কিমা
class TransactionMetadata(BaseModel):
    stan: str
    rrn: str
    mcc: str          # Merchant Category Code (e.g., 5411 Grocery, 7995 Gambling)
    terminal_id: str  # POS / ATM / Gateway ID
    device_id: str    # Hardware IMEI/Fingerprint
    ip_address: str
    is_vpn: bool
    location: str     # Latitude, Longitude

class ManualTxRequest(BaseModel):
    amount: float
    tx_type: int      # 0: Send Money, 1: Cash Out, 2: Merchant Pay
    account_age_days: int
    metadata: TransactionMetadata

@app.post("/api/v1/auth/login")
async def login(req: LoginRequest):
    if req.username == "admin" and req.password in ["secret", "hackathon2026"]:
        return {"access_token": "hackathon_super_secret_jwt_key_2026", "token_type": "bearer"}
    return {"error": "Invalid credentials"}, 400

@app.post("/api/v1/control/toggle-ai")
async def toggle_ai():
    orchestrator.ai_enabled = not orchestrator.ai_enabled
    return {"status": "success", "ai_enabled": orchestrator.ai_enabled}

@app.post("/api/v1/control/toggle-surge")
async def toggle_surge():
    orchestrator.surge_active = not orchestrator.surge_active
    return {"status": "success", "surge_active": orchestrator.surge_active}

@app.post("/api/v1/control/trigger-anomaly")
async def trigger_anomaly():
    orchestrator.anomaly_active = not orchestrator.anomaly_active
    return {"status": "success", "anomaly_active": orchestrator.anomaly_active}

@app.post("/api/v1/control/reset")
async def reset_simulation():
    orchestrator.reset_simulation()
    return {"status": "success", "message": "Simulation reset to zero"}

# ⚠️ নতুন INJECT API ENDPOINT
@app.post("/api/v1/transaction/inject")
async def inject_transaction(req: ManualTxRequest):
    result = orchestrator.inject_manual_transaction(
        amount=req.amount,
        tx_type=req.tx_type,
        account_age=req.account_age_days,
        metadata=req.metadata.model_dump()
    )
    return result

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            orchestrator.update_simulation(100.0)
            data = orchestrator.get_telemetry()
            await websocket.send_text(json.dumps(data))
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("Client disconnected from telemetry stream")