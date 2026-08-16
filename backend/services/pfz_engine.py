"""
Lehar AI — PFZ (Potential Fishing Zone) Advisory Engine
Calculates high-probability pelagic fish aggregation zones using
INCOIS-standard thermal front detection and mixed layer depth (MLD) analysis.
"""

from __future__ import annotations
import math
from .db import get_connection

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
    "tuna_skipjack": (26.0, 30.0),
    "mackerel_indian": (26.5, 29.5),
    "sardine_oil": (25.0, 28.5),
    "pomfret": (26.0, 29.0),
    "general_pelagic": (27.0, 29.0),
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


def score_pfz(sst: float, mld: float | None) -> tuple[str, int]:
    """
    Score PFZ quality based on SST and MLD.
    Returns (rating, score_0_to_100).
    """
    score = 0

    # SST scoring (max 60 points)
    opt_min, opt_max = OPTIMAL_SST["general_pelagic"]
    if opt_min <= sst <= opt_max:
        score += 60
    elif opt_min - 1 <= sst <= opt_max + 1:
        score += 40
    elif opt_min - 2 <= sst <= opt_max + 2:
        score += 20
    else:
        score += 5

    # MLD scoring (max 40 points) — shallower MLD (20-60m) = better fish aggregation
    if mld is not None:
        if 20 <= mld <= 60:
            score += 40
        elif 60 < mld <= 100:
            score += 30
        elif 10 <= mld < 20:
            score += 25
        elif mld > 100:
            score += 15
        else:
            score += 10
    else:
        score += 15  # unknown

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
    Compute PFZ advisories for recent profiles in a region.
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
        sst = compute_sst(p["id"])
        if sst is None:
            continue

        mld = compute_mld(p["id"])
        rating, score = score_pfz(sst, mld)
        harbour = nearest_harbour(p["latitude"], p["longitude"])

        # Determine target fish species based on SST
        fish_species = []
        for species, (tmin, tmax) in OPTIMAL_SST.items():
            if tmin <= sst <= tmax and species != "general_pelagic":
                fish_species.append(species.replace("_", " ").title())

        advisories.append({
            "float_id": p["float_id"],
            "latitude": round(p["latitude"], 4),
            "longitude": round(p["longitude"], 4),
            "date": p["date"],
            "sst_celsius": sst,
            "mld_meters": mld,
            "pfz_rating": rating,
            "pfz_score": score,
            "target_species": fish_species if fish_species else ["General Pelagic"],
            "nearest_harbour": harbour,
            "advisory": _generate_advisory_text(sst, mld, rating, harbour, fish_species),
        })

    # Sort by score descending
    advisories.sort(key=lambda x: x["pfz_score"], reverse=True)
    return advisories


def _generate_advisory_text(sst: float, mld: float | None, rating: str, harbour: dict, species: list[str]) -> str:
    """Generate human-readable fishing advisory text."""
    mld_text = f"Mixed Layer Depth {mld:.0f}m" if mld else "MLD data unavailable"
    species_text = ", ".join(species[:3]) if species else "general pelagic fish"
    harbour_text = f"{harbour['distance_km']}km {harbour['compass']} of {harbour['harbour']}" if harbour else "location unknown"

    if rating == "Excellent":
        return f"Excellent fishing conditions! SST {sst:.1f}degC is ideal for {species_text}. {mld_text} indicates strong thermocline. Location: {harbour_text}."
    elif rating == "Good":
        return f"Good fishing conditions. SST {sst:.1f}degC supports {species_text}. {mld_text}. Located {harbour_text}."
    elif rating == "Fair":
        return f"Fair conditions. SST {sst:.1f}degC is outside optimal range for most species. {mld_text}. Located {harbour_text}."
    else:
        return f"Poor fishing conditions. SST {sst:.1f}degC not suitable. {mld_text}. Located {harbour_text}."
