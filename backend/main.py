from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json

from core.orchestrator import orchestrator

app = FastAPI(title="FinCluster AI MVP Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

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

# ⚠️ নতুন RESET API ENDPOINT ⚠️
@app.post("/api/v1/control/reset")
async def reset_simulation():
    orchestrator.reset_simulation()
    return {"status": "success", "message": "Simulation reset to zero"}

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