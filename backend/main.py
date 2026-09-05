"""
Lehar AI Backend — FastAPI Application Entry Point
AI-Powered Conversational Interface for ARGO Ocean Data Discovery.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import os
import httpx

from .services.db import init_db
from .services.anomaly_detector import run_anomaly_scan
from .services.telegram_bot import start_telegram_bot_task, stop_telegram_bot_task
from .routers import chat, data, anomaly, pfz, satellite, guardian, telegram, safety


async def _keep_alive_daemon():
    """Periodically pings the public endpoint every 10 minutes to prevent Render free-tier from sleeping."""
    base_url = os.getenv("RENDER_EXTERNAL_URL", os.getenv("BASE_URL", "https://lehar-ai.onrender.com")).rstrip("/")
    ping_url = f"{base_url}/health"
    await asyncio.sleep(45)  # Initial delay
    while True:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(ping_url)
                if resp.status_code == 200:
                    print(f"[Keep-Alive Daemon] Self-ping successful: {ping_url} (HTTP {resp.status_code})")
        except Exception as e:
            print(f"[Keep-Alive Daemon] Self-ping notice: {e}")
        await asyncio.sleep(600)  # Ping every 10 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed data on startup."""
    print("[Lehar AI] Initializing database...")
    init_db()
    # Populate alerts exclusively from locally ingested Argo observations.
    print("[Lehar AI] Calculating evidence-based anomaly observations...")
    run_anomaly_scan(reset_existing=True, max_profiles=200)
    print("[Lehar AI] Launching Telegram Bot Gateway (@LeharAIBot)...")
    start_telegram_bot_task()
    print("[Lehar AI] Launching Keep-Alive Zero-Sleep Daemon...")
    keep_alive_task = asyncio.create_task(_keep_alive_daemon())
    print("[Lehar AI] Backend ready!")
    yield
    print("[Lehar AI] Shutting down...")
    keep_alive_task.cancel()
    stop_telegram_bot_task()


app = FastAPI(
    title="Lehar AI API",
    description="AI-Powered Conversational Interface for ARGO Ocean Data Discovery and Visualization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend (Vite dev server)
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://lehar-ai.onrender.com",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat.router)
app.include_router(data.router)
app.include_router(anomaly.router)
app.include_router(pfz.router)
app.include_router(satellite.router)
app.include_router(guardian.router)
app.include_router(telegram.router)
app.include_router(safety.router)


@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    """
    Receives incoming Telegram updates via HTTPS webhook.
    Enables zero-sleep inbound traffic on Render and matches WhatsApp Webhook pattern!
    """
    from .services.telegram_bot import process_telegram_update
    payload = await request.json()
    if payload:
        asyncio.create_task(process_telegram_update(None, payload))
    return {"ok": True}


@app.get("/api/info")
async def root():
    return {
        "name": "Lehar AI API",
        "version": "1.0.0",
        "tagline": "Know the Sea. Know the Way.",
        "status": "running",
        "team": "Ctrl Alt Elites",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    from .services.db import get_profile_count, get_unique_float_count
    return {
        "status": "healthy",
        "profiles": get_profile_count(),
        "floats": get_unique_float_count(),
    }


# Mount built React frontend static assets if dist directory exists
dist_path = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.exists(dist_path):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_target = os.path.join(dist_path, full_path)
        if os.path.exists(file_target) and os.path.isfile(file_target):
            return FileResponse(file_target)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/")
    async def fallback_root():
        return {
            "name": "Lehar AI API",
            "version": "1.0.0",
            "tagline": "Know the Sea. Know the Way.",
            "status": "running",
            "team": "Ctrl Alt Elites",
            "docs": "/docs",
        }
