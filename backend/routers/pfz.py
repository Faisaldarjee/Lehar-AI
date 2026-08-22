"""
Lehar AI — PFZ (Potential Fishing Zone) Router
Provides real-time multi-sensor fused fishing zone advisories for Indian coastal harbours.
"""

from fastapi import APIRouter, Query
from ..services.pfz_engine import get_pfz_advisories, get_all_harbours
from ..models.schemas import PFZResponse

router = APIRouter(prefix="/api", tags=["pfz"])


@router.get("/pfz", response_model=PFZResponse)
async def pfz_advisories(
    region: str = Query("arabian_sea", description="Region: arabian_sea, bay_of_bengal, mumbai, kochi, chennai, vizag, all"),
    limit: int = Query(40, ge=1, le=100),
):
    """Get multi-sensor fused PFZ fishing advisories for a region."""
    advisories = get_pfz_advisories(region=region, limit=limit)
    return {
        "region": region,
        "advisories": advisories,
        "count": len(advisories),
        "fusion_sources": [
            "INCOIS ARGO Subsurface Profiler (0-2000m)",
            "NOAA JPL MUR Satellite SST (1km)",
            "NASA VIIRS Chlorophyll-a (8-day Composite)"
        ]
    }


@router.get("/pfz/ports")
async def pfz_ports():
    """Get all major and minor Indian fishing harbours."""
    ports = get_all_harbours()
    return {
        "ports": ports,
        "count": len(ports)
    }
