"""
Lehar AI Backend — Argovis API Client
Fetches real ARGO float profiles and CTD measurements from Argovis REST API.
"""

import httpx
import os
from dotenv import load_dotenv

load_dotenv()

ARGOVIS_BASE = "https://argovis-api.colorado.edu"
ARGOVIS_KEY = os.getenv("ARGOVIS_API_KEY", "")


def _headers() -> dict:
    """Build request headers with optional API key."""
    headers = {"Accept": "application/json"}
    if ARGOVIS_KEY:
        headers["x-argokey"] = ARGOVIS_KEY
    return headers


async def search_profiles(
    start_date: str,
    end_date: str,
    polygon: list[list[float]] | None = None,
    center: tuple[float, float] | None = None,
    radius: float = 100,
) -> list[dict]:
    """
    Search Argo profiles by date range and location.
    
    Args:
        start_date: ISO 8601 start date
        end_date: ISO 8601 end date  
        polygon: List of [lon, lat] coordinates defining search area
        center: (lat, lon) tuple for circular search
        radius: Radius in km for circular search
    """
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "data": "all",
    }

    if polygon:
        # Argovis expects polygon as stringified list
        import json
        params["polygon"] = json.dumps(polygon)
    elif center:
        params["center"] = f"{center[0]},{center[1]}"
        params["radius"] = str(radius)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{ARGOVIS_BASE}/argo",
            params=params,
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def get_profile_by_id(profile_id: str) -> dict:
    """Get a specific Argo profile by its ID."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{ARGOVIS_BASE}/argo/{profile_id}",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


def search_profiles_sync(
    start_date: str,
    end_date: str,
    center_lat: float = 0,
    center_lon: float = 75,
    radius: float = 500,
) -> list[dict]:
    """
    Synchronous version for data ingestion scripts.
    """
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "center": f"{center_lat},{center_lon}",
        "radius": str(radius),
        "data": "all",
    }

    with httpx.Client(timeout=120.0) as client:
        response = client.get(
            f"{ARGOVIS_BASE}/argo",
            params=params,
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()
