"""
Lehar AI — Guardian Proactive Alert System Router
Provides safety warnings and high-yield opportunity alerts pushed to registered fishermen.
"""

from fastapi import APIRouter
from ..services.guardian_engine import scan_for_guardian_alerts, get_guardian_status, REGISTERED_FISHERMEN
from ..models.schemas import GuardianStatusResponse, GuardianAlert

router = APIRouter(prefix="/api/guardian", tags=["guardian"])


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
