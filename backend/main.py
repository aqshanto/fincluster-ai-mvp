import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models.schemas import LoginRequest, TokenResponse, TelemetryData
from core.security import create_access_token, verify_token
from core.orchestrator import orchestrator

app = FastAPI(title="FinCluster AI - MFS Orchestration Backend")

# CORS Setup (ফ্রন্টএন্ডের সাথে কানেক্ট করার জন্য)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Auth Endpoint (Admin Login)
@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    # হ্যাক্যাথন ডেমোর জন্য ডিফল্ট এডমিন ক্রেডেনশিয়াল
    if req.username == "admin" and req.password == "hackathon2026":
        token = create_access_token({"sub": req.username, "role": "admin"})
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

# 2. Control Endpoints (Protected by JWT)
@app.post("/api/v1/control/toggle-ai")
async def toggle_ai(user: dict = Depends(verify_token)):
    orchestrator.ai_enabled = not orchestrator.ai_enabled
    return {"status": "success", "ai_enabled": orchestrator.ai_enabled}

@app.post("/api/v1/control/toggle-surge")
async def toggle_surge(user: dict = Depends(verify_token)):
    orchestrator.surge_active = not orchestrator.surge_active
    return {"status": "success", "surge_active": orchestrator.surge_active}

@app.post("/api/v1/control/trigger-anomaly")
async def trigger_anomaly(user: dict = Depends(verify_token)):
    orchestrator.anomaly_active = True
    async def reset_anomaly():
        await asyncio.sleep(8)
        orchestrator.anomaly_active = False
    asyncio.create_task(reset_anomaly())
    return {"status": "success", "message": "Node 1 Anomaly triggered for 8 seconds"}

# 3. Real-time Telemetry WebSocket (60 FPS feel)
@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # প্রতি লুপে সিমুলেশন আপডেট করা হচ্ছে (প্রায় 50ms বা 20fps হারে ডেটা পাঠানো হবে)
            orchestrator.update_simulation(dt_ms=50.0)
            data = orchestrator.get_telemetry()
            await websocket.send_json(data)
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        print("Client disconnected from telemetry websocket")