"""
Lehar AI Backend — Anomaly Router
Endpoints for real-time marine heatwave and threshold anomaly alerts.
"""

from fastapi import APIRouter, Query
from ..services.db import get_anomalies
from ..services.anomaly_detector import run_anomaly_scan

router = APIRouter(prefix="/api", tags=["anomaly"])


@router.get("/anomalies")
async def list_anomalies(limit: int = Query(20, description="Max alerts to return")):
    """Get latest anomaly alerts."""
    alerts = get_anomalies(limit)
    return {"anomalies": alerts, "count": len(alerts)}


@router.post("/anomalies/scan")
async def trigger_scan():
    """Manually trigger an anomaly scan on recent profiles."""
    new_count = run_anomaly_scan(reset_existing=True)
    return {
        "message": f"Scan complete. {new_count} evidence-based observation(s) found.",
        "new_count": new_count,
        "disclaimer": "Observations are not weather, cyclone, fishing, or navigation advisories.",
    }
