"""
Lehar AI — PFZ (Potential Fishing Zone) Router
Provides real-time multi-sensor fused fishing zone advisories for Indian coastal harbours.
"""

from fastapi import APIRouter, Query
from ..services.pfz_engine import get_pfz_advisories, get_all_harbours, get_coastal_pfz_lines
from ..services.flc_service import get_all_flc_centers
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


@router.get("/pfz/lines")
async def pfz_vector_lines():
    """Get coastal multi-sensor PFZ thermal & chlorophyll front vector lines."""
    lines = get_coastal_pfz_lines()
    return {
        "lines": lines,
        "count": len(lines)
    }


@router.get("/ports")
@router.get("/pfz/ports")
async def pfz_ports():
    """Get full coastal registry of 586+ Indian fishing harbours and landing centres."""
    flc_ports = get_all_flc_centers()
    return {
        "ports": flc_ports,
        "count": len(flc_ports)
    }
