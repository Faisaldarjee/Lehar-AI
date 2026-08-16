"""
Lehar AI — PFZ (Potential Fishing Zone) Router
Provides real-time fishing zone advisories for Indian coastal harbours.
"""

from fastapi import APIRouter, Query

from ..services.pfz_engine import get_pfz_advisories

router = APIRouter(prefix="/api", tags=["pfz"])


@router.get("/pfz")
async def pfz_advisories(
    region: str = Query("arabian_sea", description="Region: arabian_sea, bay_of_bengal, mumbai, kochi, chennai, vizag, all"),
    limit: int = Query(30, ge=1, le=100),
):
    """Get PFZ fishing advisories for a region."""
    advisories = get_pfz_advisories(region=region, limit=limit)
    return {
        "region": region,
        "advisories": advisories,
        "count": len(advisories),
    }
