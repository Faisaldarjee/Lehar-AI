"""
Lehar AI — Telegram Bot Management Router
Exposes a single read-only endpoint, GET /api/telegram/status, which reports the
live operational state of the Telegram Bot gateway (token configured, worker
running, subscriber count, messages handled).
"""

from fastapi import APIRouter
from ..services.telegram_bot import get_telegram_status

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.get("/status")
async def telegram_status():
    """Get live operational status of the Telegram Bot gateway."""
    return get_telegram_status()
