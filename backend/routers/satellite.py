"""
Lehar AI — Satellite Grid API Router
Serves downsampled continuous SST & Chlorophyll-a grids for Leaflet heatmap overlay.
"""

from fastapi import APIRouter, Query
from ..services.satellite_client import get_satellite_grid, load_satellite_snapshot
from ..models.schemas import SatelliteGridResponse

router = APIRouter(prefix="/api/satellite", tags=["satellite"])


@router.get("/grid", response_model=SatelliteGridResponse)
async def satellite_grid(
    downsample: int = Query(1, ge=1, le=8, description="Downsample stride (1 = 0.5° resolution, 2 = 1.0° resolution)")
):
    """
    Get continuous satellite SST & Chlorophyll-a overlay grid for Indian Ocean.
    Fuses NOAA CoastWatch ERDDAP MUR SST with NASA VIIRS Ocean Color.
    """
    snapshot = load_satellite_snapshot()
    points = get_satellite_grid(downsample_step=downsample)
    
    return {
        "metadata": {
            **snapshot.get("metadata", {}),
            "served_points": len(points),
            "downsample_factor": downsample
        },
        "points": points
    }
