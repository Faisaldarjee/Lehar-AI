"""
Lehar AI Backend — FastAPI Application Entry Point
AI-Powered Conversational Interface for ARGO Ocean Data Discovery.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from .services.db import init_db
from .services.anomaly_detector import run_anomaly_scan
from .services.telegram_bot import start_telegram_bot_task, stop_telegram_bot_task
from .routers import chat, data, anomaly, pfz, satellite, guardian, telegram


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
    print("[Lehar AI] Backend ready!")
    yield
    print("[Lehar AI] Shutting down...")
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
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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


@app.get("/")
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
