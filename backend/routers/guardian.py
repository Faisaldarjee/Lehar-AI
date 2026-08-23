"""
Lehar AI — Guardian Proactive Alert System Router
Provides safety warnings and high-yield opportunity alerts pushed to registered fishermen.
"""

from fastapi import APIRouter
from ..services.guardian_engine import scan_for_guardian_alerts, get_guardian_status, REGISTERED_FISHERMEN
from ..models.schemas import GuardianStatusResponse, GuardianAlert

router = APIRouter(prefix="/api/guardian", tags=["guardian"])


@router.get("/alerts", response_model=GuardianStatusResponse)
async def get_alerts(
    harbour: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = None,
):
    """
    Get active proactive alerts and current Guardian watchdog metrics.
    Supports smart Geo-Fencing by coastal harbour (e.g. 'Mumbai', 'Kochi', 'Veraval')
    or coordinates [lat, lon] with configurable radius (default 80km).
    """
    status = get_guardian_status(harbour=harbour, lat=lat, lon=lon, max_radius_km=radius_km)
    alerts = scan_for_guardian_alerts(harbour=harbour, lat=lat, lon=lon, max_radius_km=radius_km)
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
    """List registered coastal fishermen & active Telegram subscribers."""
    from ..services.telegram_bot import get_all_subscribers
    tg_subs = get_all_subscribers()
    return {
        "count": len(REGISTERED_FISHERMEN) + len(tg_subs),
        "fishermen": REGISTERED_FISHERMEN,
        "telegram_subscribers": tg_subs,
    }


@router.post("/broadcast-telegram")
async def trigger_telegram_broadcast():
    """
    Manually triggers a proactive Guardian alert broadcast directly to all active Telegram subscribers.
    Dispatches rich card + personalized voice note!
    """
    from ..services.telegram_bot import get_all_subscribers, send_proactive_guardian_alert
    from ..services.guardian_engine import scan_for_guardian_alerts

    subs = get_all_subscribers()
    alerts = scan_for_guardian_alerts()
    dispatched = 0
    alert_title = None

    if subs and alerts:
        top_alert = alerts[0]
        alert_title = top_alert.get("title")
        for sub in subs:
            try:
                await send_proactive_guardian_alert(sub, top_alert)
                dispatched += 1
            except Exception as e:
                pass

    return {
        "status": "success",
        "subscribers_count": len(subs),
        "dispatched_count": dispatched,
        "alert_dispatched": alert_title or "No active alerts in queue",
    }
