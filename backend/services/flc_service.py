"""
Service layer for Fish Landing Centers (FLC) coastal registry.
Provides fast in-memory spatial lookups and nearest-landing-center distance/bearing calculations.
"""

import json
import math
import os
from typing import Any

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "flc_centers.json")

_FLC_CACHE: list[dict[str, Any]] | None = None


def get_all_flc_centers() -> list[dict[str, Any]]:
    """Return all cached fish landing centers."""
    global _FLC_CACHE
    if _FLC_CACHE is not None:
        return _FLC_CACHE

    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                _FLC_CACHE = json.load(f)
                return _FLC_CACHE
        except Exception as e:
            print(f"[FLC Service] Error loading cache: {e}")

    # Fallback to base hubs
    _FLC_CACHE = [
        {"id": "FLC-0001", "name": "Mumbai (Sassoon Dock)", "state": "Maharashtra", "latitude": 18.915, "longitude": 72.828, "type": "Major Deep Sea Export Hub", "tier": 1},
        {"id": "FLC-0002", "name": "Veraval Fishing Harbour", "state": "Gujarat", "latitude": 20.902, "longitude": 70.368, "type": "Major Trawler Port", "tier": 1},
        {"id": "FLC-0003", "name": "Kochi (Thoppumpady)", "state": "Kerala", "latitude": 9.968, "longitude": 76.268, "type": "Oceanic Tuna Export Capital", "tier": 1},
        {"id": "FLC-0004", "name": "Chennai (Kasimedu)", "state": "Tamil Nadu", "latitude": 13.125, "longitude": 80.302, "type": "East Coast Primary Trawler Hub", "tier": 1},
        {"id": "FLC-0005", "name": "Visakhapatnam Harbour", "state": "Andhra Pradesh", "latitude": 17.695, "longitude": 83.225, "type": "Bay of Bengal Commercial Base", "tier": 1},
    ]
    return _FLC_CACHE


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance between two points in km."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def compass_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Calculate compass direction (e.g., NW, SSE) from (lat1, lon1) to (lat2, lon2)."""
    d_lon = math.radians(lon2 - lon1)
    y = math.sin(d_lon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(
        math.radians(lat1)
    ) * math.cos(math.radians(lat2)) * math.cos(d_lon)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = int((bearing + 11.25) / 22.5) % 16
    return directions[idx]


def get_nearest_flc(lat: float, lon: float) -> dict[str, Any]:
    """Find the closest Fish Landing Center from arbitrary ocean coordinates."""
    centers = get_all_flc_centers()
    if not centers:
        return {
            "id": "FLC-0001",
            "harbour": "Coastal Station",
            "state": "India",
            "distance_km": 0.0,
            "compass": "Offshore",
            "bearing": 0.0,
        }

    best = None
    min_dist = float("inf")

    for c in centers:
        d = haversine_km(lat, lon, c["latitude"], c["longitude"])
        if d < min_dist:
            min_dist = d
            best = c

    compass = compass_bearing(best["latitude"], best["longitude"], lat, lon)
    return {
        "id": best["id"],
        "harbour": best["name"],
        "state": best.get("state", "India"),
        "distance_km": round(min_dist, 1),
        "compass": compass,
        "type": best.get("type", "Fish Landing Center"),
    }
