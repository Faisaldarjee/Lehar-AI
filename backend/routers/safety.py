"""
Lehar AI — Marine Safety & Coast Guard Operations Router
Exposes secured endpoints for Maritime Rescue Coordination Centres (MRCC),
live SOS distress feeds, geofenced marine hazard surveillance, and judge simulation tools.
"""

import os
from typing import Optional
from fastapi import APIRouter, Header, Query, HTTPException, status
from pydantic import BaseModel, Field

from ..services.db import (
    get_active_hazards,
    create_hazard_zone,
    get_active_sos_alerts,
    acknowledge_sos_alert,
    resolve_sos_alert,
    create_sos_alert
)

router = APIRouter(prefix="/api/safety", tags=["safety"])

COASTGUARD_API_KEY = os.getenv("COASTGUARD_API_KEY", "incois-mrcc-secure-2026")


def verify_coastguard_auth(
    x_coastguard_key: Optional[str] = Header(None, alias="x-coastguard-key"),
    key: Optional[str] = Query(None)
):
    """
    Validates API key for Maritime Rescue Coordination Centre (MRCC) endpoints.
    Allows authentication via 'x-coastguard-key' header or '?key=' query parameter.
    """
    provided_key = x_coastguard_key or key
    if not provided_key or provided_key.strip() != COASTGUARD_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid Maritime Rescue Coordination Centre (MRCC) API key required."
        )
    return True


class HazardSimulationPayload(BaseModel):
    title: str = Field(..., example="Saurashtra Severe Squall Warning")
    hazard_type: str = Field("high_wave", example="high_wave")  # cyclone, high_wave, storm_surge, marine_heatwave
    center_lat: float = Field(..., example=20.45)
    center_lon: float = Field(..., example=69.45)
    radius_km: float = Field(100.0, example=100.0)
    severity: str = Field("warning", example="warning")  # watch, warning, severe, critical
    source: str = Field("IMD/NOAA Simulated", example="IMD/NOAA Simulated")
    wave_height_m: Optional[float] = Field(4.2, example=4.2)
    wind_speed_kmh: Optional[float] = Field(65.0, example=65.0)
    valid_hours: int = Field(48, example=48)


class SosAckPayload(BaseModel):
    patrol_craft: str = Field("ICGS Samrat (Fast Patrol Vessel)", example="ICGS Samrat (Fast Patrol Vessel)")
    eta_minutes: int = Field(25, example=25)
    notes: Optional[str] = Field("Search and Rescue interceptor en route.", example="Search and Rescue interceptor en route.")


class TestSosPayload(BaseModel):
    chat_id: int = Field(999999, example=999999)
    latitude: float = Field(18.82, example=18.82)
    longitude: float = Field(72.55, example=72.55)
    reporter_name: str = Field("Captain Ramesh Koli", example="Captain Ramesh Koli")
    harbour: str = Field("Mumbai (Sassoon Dock)", example="Mumbai (Sassoon Dock)")
    vessel_name: str = Field("Mahalaxmi-IV (Mechanized Gillnetter)", example="Mahalaxmi-IV (Mechanized Gillnetter)")
    notes: Optional[str] = Field("Simulated engine failure 22km offshore.", example="Simulated engine failure 22km offshore.")


# --- Coast Guard Feed Endpoints ---

@router.get("/coastguard/alerts")
async def get_coastguard_feed(
    limit: int = 50,
    x_coastguard_key: Optional[str] = Header(None, alias="x-coastguard-key"),
    key: Optional[str] = Query(None)
):
    """
    [Secured] Real-time emergency distress beacon feed for Indian Coast Guard MRCC Dashboard.
    Requires header: 'x-coastguard-key: incois-mrcc-secure-2026' or query param '?key=...'.
    """
    verify_coastguard_auth(x_coastguard_key, key)
    alerts = get_active_sos_alerts(limit=limit)
    return {
        "status": "online",
        "station": "Indian Coast Guard Maritime Rescue Coordination Centre (MRCC)",
        "active_distress_count": sum(1 for a in alerts if a.get("status") == "active"),
        "total_beacons": len(alerts),
        "alerts": alerts
    }


@router.post("/coastguard/alerts/{sos_id}/ack")
async def acknowledge_distress_beacon(
    sos_id: int,
    payload: SosAckPayload,
    x_coastguard_key: Optional[str] = Header(None, alias="x-coastguard-key"),
    key: Optional[str] = Query(None)
):
    """[Secured] Acknowledge an active SOS distress beacon with patrol vessel deployment details."""
    verify_coastguard_auth(x_coastguard_key, key)
    note_text = f"Dispatched: {payload.patrol_craft} | ETA: ~{payload.eta_minutes} mins | {payload.notes or ''}".strip()
    acknowledge_sos_alert(sos_id, notes=note_text)
    return {
        "success": True,
        "sos_id": sos_id,
        "status": "acknowledged",
        "assigned_craft": payload.patrol_craft,
        "eta_minutes": payload.eta_minutes
    }


@router.post("/coastguard/alerts/{sos_id}/resolve")
async def mark_distress_resolved(
    sos_id: int,
    x_coastguard_key: Optional[str] = Header(None, alias="x-coastguard-key"),
    key: Optional[str] = Query(None)
):
    """[Secured] Mark an SOS rescue mission as successfully resolved."""
    verify_coastguard_auth(x_coastguard_key, key)
    resolve_sos_alert(sos_id)
    return {"success": True, "sos_id": sos_id, "status": "resolved"}


# --- Marine Hazard Endpoints ---

@router.get("/hazards/active")
async def get_active_hazard_zones():
    """Returns all currently active marine hazard zones for GIS map layer and telemetry radar."""
    hazards = get_active_hazards()
    return {
        "count": len(hazards),
        "hazard_zones": hazards
    }


@router.post("/hazards/simulate")
async def simulate_hazard_zone(payload: HazardSimulationPayload):
    """
    Simulation tool for hackathon judges and evaluators to inject an active hazard zone
    and watch the Telegram Bot and GIS interface intercept vessels in real time.
    """
    zone_id = create_hazard_zone(
        title=payload.title,
        hazard_type=payload.hazard_type,
        center_lat=payload.center_lat,
        center_lon=payload.center_lon,
        radius_km=payload.radius_km,
        severity=payload.severity,
        source=payload.source,
        wave_height_m=payload.wave_height_m,
        wind_speed_kmh=payload.wind_speed_kmh,
        valid_hours=payload.valid_hours
    )
    return {
        "success": True,
        "zone_id": zone_id,
        "message": f"Simulated hazard '{payload.title}' injected successfully. Active for {payload.valid_hours} hours.",
        "hazard": {
            "title": payload.title,
            "center": [payload.center_lat, payload.center_lon],
            "radius_km": payload.radius_km,
            "severity": payload.severity,
            "wave_height_m": payload.wave_height_m,
            "wind_speed_kmh": payload.wind_speed_kmh
        }
    }


@router.post("/test-sos")
async def test_trigger_sos(payload: TestSosPayload):
    """Test endpoint to trigger a simulated SOS distress beacon for live demonstration."""
    sos_id = create_sos_alert(
        chat_id=payload.chat_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        reporter_name=payload.reporter_name,
        harbour=payload.harbour,
        vessel_name=payload.vessel_name,
        coast_guard_station="DHQ-2 (Mumbai)",
        notes=payload.notes or "Simulated test beacon"
    )
    return {
        "success": True,
        "sos_id": sos_id,
        "status": "active",
        "message": f"Distress beacon #SOS-{sos_id:04d} logged successfully for vessel {payload.vessel_name}."
    }
