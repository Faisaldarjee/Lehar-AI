"""
Lehar AI — Guardian Proactive Alert System Router
Provides safety warnings and high-yield opportunity alerts pushed to registered fishermen.
"""

from fastapi import APIRouter
from ..services.guardian_engine import (
    scan_for_guardian_alerts,
    get_guardian_status,
    generate_dawn_cast_briefing,
    REGISTERED_FISHERMEN
)
from ..models.schemas import GuardianStatusResponse, GuardianAlert

router = APIRouter(prefix="/api/guardian", tags=["guardian"])


@router.get("/dawn-cast")
async def get_dawn_cast(harbour: str = "Mumbai (Sassoon Dock)", lat: float = 18.91, lon: float = 72.83, lang: str = "hi"):
    """
    Get the 04:30 AM pre-departure Dawn Cast advisory combining wave physics,
    Solunar feeding peak, top 2 high-yield PFZ targets, and NavIC fuel estimation.
    """
    return generate_dawn_cast_briefing(harbour_name=harbour, lat=lat, lon=lon, lang=lang)


@router.get("/alerts", response_model=GuardianStatusResponse)
async def get_alerts():
    """Get active proactive alerts and current Guardian watchdog metrics."""
    status = get_guardian_status()
    alerts = scan_for_guardian_alerts()
    return {
        **status,
        "alerts": alerts,
    }


@router.post("/scan", response_model=GuardianStatusResponse)
async def trigger_guardian_scan():
    """
    Manually triggers a fresh multi-sensor ocean watchdog scan.
    Returns matched safety and opportunity alerts dispatched to registered fishermen.
    """
    status = get_guardian_status()
    alerts = scan_for_guardian_alerts()
    return {
        **status,
        "alerts": alerts,
    }


@router.get("/fishermen")
async def get_registered_fishermen():
    """List mock registered coastal fishermen for demo transparency."""
    return {
        "count": len(REGISTERED_FISHERMEN),
        "fishermen": REGISTERED_FISHERMEN,
    }
