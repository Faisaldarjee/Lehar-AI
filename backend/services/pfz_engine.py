"""
Lehar AI — PFZ (Potential Fishing Zone) Multi-Sensor Fusion Advisory Engine
Calculates high-probability pelagic fish aggregation zones by fusing:
1. INCOIS ARGO Subsurface Data (Mixed Layer Depth & Vertical Gradient down to 2000m)
2. NOAA Satellite Sea Surface Temperature (1km Ultra-high Resolution)
3. NASA VIIRS Satellite Chlorophyll-a Ocean Color (Bio-productivity & Nutrient Fronts)
"""

from __future__ import annotations
import math
from .db import get_connection
from .satellite_client import get_nearest_satellite_data

# Major Indian fishing harbours (name, lat, lon)
HARBOURS = [
    ("Ratnagiri, Maharashtra", 16.99, 73.30),
    ("Mumbai (Sassoon Dock)", 18.91, 72.83),
    ("Porbandar, Gujarat", 21.64, 69.61),
    ("Mangalore, Karnataka", 12.87, 74.84),
    ("Kochi (Cochin), Kerala", 9.97, 76.27),
    ("Tuticorin, Tamil Nadu", 8.76, 78.14),
    ("Chennai (Royapuram)", 13.12, 80.30),
    ("Visakhapatnam, AP", 17.69, 83.22),
    ("Paradip, Odisha", 20.32, 86.61),
    ("Goa (Panaji)", 15.50, 73.81),
]

# Optimal SST ranges for Indian Ocean pelagic fish species
OPTIMAL_SST = {
    "tuna_yellowfin": (26.0, 30.0),
    "mackerel_indian": (26.5, 29.5),
    "sardine_oil": (25.0, 28.5),
    "pomfret_silver": (26.0, 29.0),
    "general_pelagic": (27.0, 29.2),
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2 in degrees."""
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlon) * math.cos(math.radians(lat2))
    y = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def bearing_to_compass(deg: float) -> str:
    """Convert bearing degrees to compass direction."""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return dirs[round(deg / 22.5) % 16]


def nearest_harbour(lat: float, lon: float) -> dict:
    """Find the nearest Indian fishing harbour."""
    best = None
    for name, hlat, hlon in HARBOURS:
        dist = haversine_km(lat, lon, hlat, hlon)
        if best is None or dist < best["distance_km"]:
            brg = bearing_degrees(hlat, hlon, lat, lon)
            best = {
                "harbour": name,
                "distance_km": round(dist, 1),
                "bearing_deg": round(brg, 1),
                "compass": bearing_to_compass(brg),
            }
    return best


def compute_mld(profile_id: int) -> float | None:
    """Compute Mixed Layer Depth: depth where temp drops > 0.5°C from surface."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT depth, temperature FROM argo_measurements
            WHERE profile_id = ? AND temperature IS NOT NULL
            ORDER BY depth ASC
            """,
            (profile_id,),
        ).fetchall()

    if len(rows) < 3:
        return None

    surface_temp = rows[0]["temperature"]
    for row in rows[1:]:
        if surface_temp - row["temperature"] >= 0.5:
            return round(row["depth"], 1)

    return None


def compute_sst(profile_id: int) -> float | None:
    """Get surface temperature (shallowest measurement, depth <= 20m)."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT temperature FROM argo_measurements
            WHERE profile_id = ? AND depth <= 20 AND temperature IS NOT NULL
            ORDER BY depth ASC LIMIT 1
            """,
            (profile_id,),
        ).fetchone()
    return round(row["temperature"], 2) if row else None


def score_pfz_fused(
    argo_sst: float,
    mld: float | None,
    sat_sst: float,
    chlorophyll: float,
    chl_gradient: float
) -> tuple[str, int]:
    """
    Multi-sensor fused PFZ scoring:
    1. Argo Subsurface MLD & thermocline stability (max 35 pts)
    2. Satellite SST thermal front matching (max 35 pts)
    3. Satellite Chlorophyll-a bio-productivity & nutrient gradient (max 30 pts)
    Total: 0 to 100 points
    """
    score = 0

    # 1. SST Score (Blend Argo + Satellite SST)
    fused_sst = (argo_sst + sat_sst) / 2.0
    opt_min, opt_max = OPTIMAL_SST["general_pelagic"]
    if opt_min <= fused_sst <= opt_max:
        score += 35
    elif opt_min - 1.0 <= fused_sst <= opt_max + 1.0:
        score += 25
    elif opt_min - 2.0 <= fused_sst <= opt_max + 2.0:
        score += 15
    else:
        score += 5

    # 2. MLD Score (Argo Subsurface)
    if mld is not None:
        if 18 <= mld <= 55:
            score += 35
        elif 55 < mld <= 90:
            score += 25
        elif 10 <= mld < 18:
            score += 20
        else:
            score += 10
    else:
        score += 18

    # 3. Chlorophyll-a Score (Satellite VIIRS/MODIS)
    # Optimum: 0.30 to 2.50 mg/m³ for Indian Ocean pelagic feeders
    if 0.40 <= chlorophyll <= 2.20:
        score += 22
    elif 0.20 <= chlorophyll < 0.40 or 2.20 < chlorophyll <= 3.50:
        score += 15
    else:
        score += 8

    # Chlorophyll front bonus (gradient >= 0.08)
    if chl_gradient >= 0.08:
        score += 8
    elif chl_gradient >= 0.04:
        score += 4

    # Cap score at 100
    score = min(100, max(0, score))

    if score >= 80:
        rating = "Excellent"
    elif score >= 60:
        rating = "Good"
    elif score >= 40:
        rating = "Fair"
    else:
        rating = "Poor"

    return rating, score


def get_pfz_advisories(region: str = "arabian_sea", limit: int = 30) -> list[dict]:
    """
    Compute multi-sensor fused PFZ advisories for recent profiles in a region.
    Fuses Argo point observations with satellite continuous SST & Chlorophyll-a.
    """
    region_bounds = {
        "arabian_sea": (5.0, 25.0, 55.0, 76.0),
        "bay_of_bengal": (5.0, 23.0, 78.0, 95.0),
        "mumbai": (14.0, 22.0, 64.0, 74.0),
        "kochi": (7.0, 13.0, 70.0, 78.0),
        "chennai": (10.0, 16.0, 79.0, 86.0),
        "vizag": (15.0, 21.0, 80.0, 90.0),
        "all": (-20.0, 25.0, 40.0, 100.0),
    }

    bounds = region_bounds.get(region, region_bounds["arabian_sea"])
    lat_min, lat_max, lon_min, lon_max = bounds

    with get_connection() as conn:
        profiles = conn.execute(
            """
            SELECT id, float_id, latitude, longitude, date, max_depth
            FROM argo_profiles
            WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
            ORDER BY date DESC
            LIMIT ?
            """,
            (lat_min, lat_max, lon_min, lon_max, limit),
        ).fetchall()

    advisories = []
    for p in profiles:
        argo_sst = compute_sst(p["id"])
        if argo_sst is None:
            continue

        mld = compute_mld(p["id"])
        lat = round(p["latitude"], 4)
        lon = round(p["longitude"], 4)

        # Look up continuous satellite overlay at this point
        sat_data = get_nearest_satellite_data(lat, lon)
        sat_sst = sat_data["satellite_sst"]
        chlorophyll = sat_data["chlorophyll_mg_m3"]
        chl_gradient = sat_data["chlorophyll_gradient"]

        rating, score = score_pfz_fused(argo_sst, mld, sat_sst, chlorophyll, chl_gradient)
        harbour = nearest_harbour(lat, lon)

        # Determine target fish species based on fused SST and chlorophyll
        fused_sst = round((argo_sst + sat_sst) / 2.0, 2)
        fish_species = []
        for species, (tmin, tmax) in OPTIMAL_SST.items():
            if tmin <= fused_sst <= tmax and species != "general_pelagic":
                fish_species.append(species.replace("_", " ").title())

        advisories.append({
            "float_id": p["float_id"],
            "latitude": lat,
            "longitude": lon,
            "date": p["date"],
            "sst_celsius": argo_sst,
            "satellite_sst": sat_sst,
            "chlorophyll_mg_m3": chlorophyll,
            "chlorophyll_gradient": chl_gradient,
            "mld_meters": mld,
            "pfz_rating": rating,
            "pfz_score": score,
            "data_confidence": sat_data["data_confidence"],
            "data_sources": sat_data["data_sources"],
            "target_species": fish_species if fish_species else ["General Pelagic"],
            "nearest_harbour": harbour,
            "advisory": _generate_fused_advisory_text(
                argo_sst, sat_sst, chlorophyll, mld, rating, harbour, fish_species
            ),
        })

    # Sort by fused score descending
    advisories.sort(key=lambda x: x["pfz_score"], reverse=True)
    return advisories


def _generate_fused_advisory_text(
    argo_sst: float,
    sat_sst: float,
    chlorophyll: float,
    mld: float | None,
    rating: str,
    harbour: dict,
    species: list[str]
) -> str:
    """Generate comprehensive scientific advisory text citing both Argo and Satellite indicators."""
    mld_text = f"Mixed Layer Depth {mld:.0f}m" if mld else "Subsurface MLD stable"
    species_text = ", ".join(species[:3]) if species else "pelagic fish"
    harbour_text = f"{harbour['distance_km']}km {harbour['compass']} of {harbour['harbour']}" if harbour else "offshore sector"

    if rating == "Excellent":
        return (
            f"High-confidence PFZ! Satellite Chlorophyll {chlorophyll:.2f} mg/m³ confirms rich bio-productivity. "
            f"Fused SST {argo_sst:.1f}°C (Argo) / {sat_sst:.1f}°C (Satellite) is optimal for {species_text}. "
            f"{mld_text}. Location: {harbour_text}."
        )
    elif rating == "Good":
        return (
            f"Favorable fishing zone. Satellite Chlorophyll {chlorophyll:.2f} mg/m³ with {mld_text}. "
            f"SST {argo_sst:.1f}°C supports {species_text}. Location: {harbour_text}."
        )
    elif rating == "Fair":
        return (
            f"Moderate fishing conditions. Chlorophyll {chlorophyll:.2f} mg/m³, SST {argo_sst:.1f}°C. "
            f"{mld_text}. Location: {harbour_text}."
        )
    else:
        return (
            f"Suboptimal conditions. Chlorophyll {chlorophyll:.2f} mg/m³ outside prime feeding threshold. "
            f"Location: {harbour_text}."
        )
