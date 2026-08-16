"""
Lehar AI Backend — Data Router
Endpoints for browsing raw ARGO profiles, floats, measurements, and summary stats.
"""

from fastapi import APIRouter, Query
from ..services.db import (
    get_float_positions,
    get_float_trajectory,
    get_depth_profile,
    get_profiles_near,
    get_profile_count,
    get_unique_float_count,
)

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/floats")
async def list_floats():
    """Get latest position of all floats."""
    floats = get_float_positions()
    return {"floats": floats, "count": len(floats)}


@router.get("/floats/{float_id}")
async def get_float(float_id: str):
    """Get trajectory for a specific float."""
    trajectory = get_float_trajectory(float_id)
    return {"float_id": float_id, "trajectory": trajectory, "total_cycles": len(trajectory)}


@router.get("/profiles")
async def search_profiles(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius: float = Query(2.0, description="Search radius in degrees"),
    limit: int = Query(50, description="Max results"),
):
    """Get profiles near a lat/lon point."""
    profiles = get_profiles_near(lat, lon, radius, limit)
    return {"profiles": profiles, "count": len(profiles)}


@router.get("/profiles/{profile_id}/depth")
async def get_profile_depth_data(profile_id: int):
    """Get full depth profile (temperature + salinity measurements)."""
    measurements = get_depth_profile(profile_id)
    return {"profile_id": profile_id, "measurements": measurements, "num_levels": len(measurements)}


@router.get("/stats")
async def get_stats():
    """Get dashboard statistics."""
    return {
        "total_profiles": get_profile_count(),
        "total_floats": get_unique_float_count(),
        "coverage_area": "Indian Ocean (30°E-120°E, 30°S-30°N)",
    }
