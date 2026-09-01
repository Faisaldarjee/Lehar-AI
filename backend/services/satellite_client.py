"""
Lehar AI Backend — Satellite Data Fusion Client
Provides continuous surface coverage (SST + Chlorophyll-a) to fuse with sparse subsurface
ARGO float observations. By default it serves a MODELED offline climatology snapshot
(deterministic analytical field), with optional best-effort live NOAA ERDDAP overlay.

Supports:
1. High-speed local offline snapshot caching (backend/data/satellite_snapshot.json)
2. Optional live NOAA JPL MUR SST (1km) querying via the fetch script (best-effort)
3. Nearest-neighbor grid lookup for exact lat/lon coordinates
4. 0.5° / 1.0° downsampled grid export for Leaflet map overlays
"""

from __future__ import annotations
import os
import json
import math
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_FILE = DATA_DIR / "satellite_snapshot.json"

# Indian Ocean Bounding Box
LAT_MIN, LAT_MAX = 5.0, 25.0
LON_MIN, LON_MAX = 55.0, 95.0
GRID_STEP = 0.5  # 0.5 degree grid (~55km resolution)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def generate_synthetic_climatology_grid() -> dict:
    """
    Generates a MODELED Indian Ocean surface grid (synthetic offline snapshot) whose spatial
    structure approximates published NOAA OISST climatology & NASA VIIRS seasonal Chlorophyll-a
    distributions. This is NOT a live satellite retrieval — it is a deterministic analytical
    field used for offline/demo reliability.

    Includes realistic features:
    - Arabian Sea upwelling high-chlorophyll zones (Oman / Somali / Malabar coast)
    - Bay of Bengal freshwater discharge & chlorophyll plumes (Ganga-Brahmaputra / Godavari)
    - Thermal front gradients across 12°N-20°N
    """
    lats = [round(LAT_MIN + i * GRID_STEP, 2) for i in range(int((LAT_MAX - LAT_MIN) / GRID_STEP) + 1)]
    lons = [round(LON_MIN + i * GRID_STEP, 2) for i in range(int((LON_MAX - LON_MIN) / GRID_STEP) + 1)]
    n_lat, n_lon = len(lats), len(lons)

    # --- Pass 1: build the SST and chlorophyll fields ---
    sst_field = [[0.0] * n_lon for _ in range(n_lat)]
    chl_field = [[0.0] * n_lon for _ in range(n_lat)]
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            # Baseline tropical Indian Ocean SST: 27.5°C to 29.8°C
            # Upwelling zones (West Arabian sea, Malabar) have cooler SST (26.0 - 27.5°C)
            # Bay of Bengal is warmer (28.5 - 30.0°C)
            dist_to_malabar = math.hypot(lat - 11.5, lon - 75.0)
            dist_to_oman = math.hypot(lat - 18.0, lon - 58.0)
            dist_to_mumbai = math.hypot(lat - 18.9, lon - 72.0)
            dist_to_bengal_plume = math.hypot(lat - 20.0, lon - 88.0)

            base_sst = 28.6 - (lat - 15.0) * 0.08 + math.sin(lon * 0.1) * 0.4
            if dist_to_oman < 5.0:
                base_sst -= (5.0 - dist_to_oman) * 0.35  # Upwelling cooling
            if dist_to_malabar < 4.0:
                base_sst -= (4.0 - dist_to_malabar) * 0.25
            sst_field[i][j] = round(max(25.5, min(30.5, base_sst)), 2)

            # Chlorophyll-a (mg/m³): open ocean 0.15-0.40, coastal/upwelling/plumes 0.80-3.50
            base_chl = 0.22 + 0.08 * math.sin(lat * 0.2) + 0.05 * math.cos(lon * 0.15)
            if dist_to_oman < 6.0:
                base_chl += (6.0 - dist_to_oman) * 0.45  # Upwelling nutrient boost
            if dist_to_malabar < 5.0:
                base_chl += (5.0 - dist_to_malabar) * 0.35
            if dist_to_mumbai < 4.0:
                base_chl += (4.0 - dist_to_mumbai) * 0.30
            if dist_to_bengal_plume < 5.0:
                base_chl += (5.0 - dist_to_bengal_plume) * 0.40
            chl_field[i][j] = round(max(0.10, min(5.0, base_chl)), 3)

    # --- Pass 2: REAL neighbour finite-difference chlorophyll gradient magnitude (mg/m³ per degree),
    # then per-pixel front classification. This replaces the earlier latitude-only sin() placeholder
    # so that fronts fall on the true edges of the upwelling/plume features, not on a fixed wave. ---
    grid = []
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            sst = sst_field[i][j]
            chlorophyll = chl_field[i][j]

            # Central difference in the interior, one-sided at the grid edges.
            i0, i1 = max(0, i - 1), min(n_lat - 1, i + 1)
            j0, j1 = max(0, j - 1), min(n_lon - 1, j + 1)
            dlat_deg = lats[i1] - lats[i0]
            dlon_deg = lons[j1] - lons[j0]
            dchl_dlat = (chl_field[i1][j] - chl_field[i0][j]) / dlat_deg if dlat_deg else 0.0
            dchl_dlon = (chl_field[i][j1] - chl_field[i][j0]) / dlon_deg if dlon_deg else 0.0
            gradient = round(math.hypot(dchl_dlat, dchl_dlon), 3)

            is_thermal_front = 27.5 <= sst <= 29.0
            is_chl_front = chlorophyll >= 0.60 or gradient >= 0.08

            # Combined PFZ potential rating for this satellite pixel
            pfz_potential = "Excellent" if (is_chl_front and gradient >= 0.08 and 27.0 <= sst <= 29.2) else \
                            "Good" if (26.5 <= sst <= 29.5 and chlorophyll >= 0.35) else "Moderate"

            grid.append({
                "lat": lat,
                "lon": lon,
                "sst": sst,
                "chlorophyll": chlorophyll,
                "gradient": gradient,
                "thermal_front": is_thermal_front,
                "chlorophyll_front": is_chl_front,
                "pfz_potential": pfz_potential,
            })

    return {
        "metadata": {
            "source": "Modeled Indian Ocean climatology (synthetic offline snapshot — not a live satellite retrieval)",
            "coverage": f"Indian Ocean (Lat {LAT_MIN}°N-{LAT_MAX}°N, Lon {LON_MIN}°E-{LON_MAX}°E)",
            "grid_resolution_deg": GRID_STEP,
            "total_points": len(grid),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "datasets": [
                "Modeled SST climatology (approximating NOAA OISST/MUR spatial structure)",
                "Modeled Chlorophyll-a climatology (approximating VIIRS seasonal distribution)"
            ]
        },
        "points": grid
    }


def save_satellite_snapshot(data: dict) -> None:
    """Save satellite data snapshot to local JSON cache."""
    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[SatelliteClient] Cached snapshot saved ({len(data.get('points', []))} points) to {SNAPSHOT_FILE}")


_cached_snapshot: dict | None = None


def load_satellite_snapshot() -> dict:
    """
    Load the cached satellite snapshot from disk.
    If file doesn't exist, generates and saves the baseline climatology snapshot.
    """
    global _cached_snapshot
    if _cached_snapshot is not None:
        return _cached_snapshot

    if SNAPSHOT_FILE.exists():
        try:
            with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
                _cached_snapshot = json.load(f)
            print(f"[SatelliteClient] Loaded {_cached_snapshot['metadata']['total_points']} points from local snapshot cache.")
            return _cached_snapshot
        except Exception as e:
            print(f"[SatelliteClient] Warning loading snapshot: {e}. Re-generating.")

    # Generate fresh snapshot
    _cached_snapshot = generate_synthetic_climatology_grid()
    save_satellite_snapshot(_cached_snapshot)
    return _cached_snapshot


def get_nearest_satellite_data(lat: float, lon: float) -> dict:
    """
    Find the nearest satellite grid point to the given coordinates (nearest-neighbor lookup).
    Returns continuous SST, Chlorophyll-a concentration, gradient, and contributing data sources.
    """
    snapshot = load_satellite_snapshot()
    points = snapshot.get("points", [])

    if not points:
        return {
            "satellite_sst": 28.5,
            "chlorophyll_mg_m3": 0.45,
            "chlorophyll_gradient": 0.05,
            "thermal_front": True,
            "chlorophyll_front": True,
            "data_confidence": "Modeled climatology (offline fallback)",
            "data_sources": [
                "Modeled SST climatology (offline snapshot)",
                "Modeled Chlorophyll-a climatology (offline snapshot)"
            ]
        }

    best_pt = min(points, key=lambda p: (p["lat"] - lat) ** 2 + (p["lon"] - lon) ** 2)

    return {
        "satellite_sst": best_pt["sst"],
        "chlorophyll_mg_m3": best_pt["chlorophyll"],
        "chlorophyll_gradient": best_pt["gradient"],
        "thermal_front": best_pt["thermal_front"],
        "chlorophyll_front": best_pt["chlorophyll_front"],
        "pfz_potential": best_pt["pfz_potential"],
        "data_confidence": "Modeled climatology (offline snapshot)",
        "data_sources": [
            "Modeled SST climatology (offline snapshot)",
            "Modeled Chlorophyll-a climatology (offline snapshot)"
        ]
    }


def get_satellite_grid(downsample_step: int = 1) -> list[dict]:
    """
    Return downsampled satellite grid for the frontend map heatmap layer.
    """
    snapshot = load_satellite_snapshot()
    points = snapshot.get("points", [])
    if downsample_step <= 1:
        return points
    return points[::downsample_step]


def get_sst_at(lat: float, lon: float) -> Optional[float]:
    """Get continuous SST (°C) at coordinates from cached satellite grid."""
    data = get_nearest_satellite_data(lat, lon)
    return data.get("satellite_sst", 28.5)


def get_chlorophyll_at(lat: float, lon: float) -> Optional[float]:
    """Get continuous Chlorophyll-a (mg/m³) at coordinates from cached satellite grid."""
    data = get_nearest_satellite_data(lat, lon)
    return data.get("chlorophyll_mg_m3", 0.85)

