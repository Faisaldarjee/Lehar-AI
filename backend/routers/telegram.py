"""
Lehar AI — Telegram Bot Management Router
Provides bot status, connectivity diagnostics, and webhook setup endpoints.
"""

from fastapi import APIRouter
from ..services.telegram_bot import get_telegram_status

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.get("/status")
async def telegram_status():
    """Get live operational status of the Telegram Bot gateway."""
    return get_telegram_status()
