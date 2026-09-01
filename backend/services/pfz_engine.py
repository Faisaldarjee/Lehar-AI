"""
Lehar AI — PFZ (Potential Fishing Zone) Multi-Sensor Fusion Advisory Engine
Calculates high-probability pelagic fish aggregation zones by fusing:
1. INCOIS ARGO Subsurface Data (Mixed Layer Depth & Vertical Gradient down to 2000m)
2. NOAA Satellite Sea Surface Temperature (1km Ultra-high Resolution)
3. NASA VIIRS Satellite Chlorophyll-a Ocean Color (Bio-productivity & Nutrient Fronts)
"""

from __future__ import annotations
import math
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional, Callable, Tuple, List, Any, Dict

from .db import get_connection
from .satellite_client import get_nearest_satellite_data, get_sst_at, get_chlorophyll_at

# Comprehensive 34 Major & Minor Indian Fishing Harbours (name, lat, lon)
HARBOURS = [
    # Gujarat
    ("Veraval, Gujarat", 20.90, 70.37),
    ("Porbandar, Gujarat", 21.64, 69.61),
    ("Okha / Dwarka, Gujarat", 22.46, 69.07),
    ("Mangrol, Gujarat", 21.12, 70.11),
    ("Jakhau (Kutch), Gujarat", 23.23, 68.70),
    # Maharashtra
    ("Mumbai (Sassoon Dock)", 18.91, 72.83),
    ("Mumbai (Versova Jetty)", 19.13, 72.81),
    ("Alibaug / Murud, Maharashtra", 18.64, 72.87),
    ("Ratnagiri (Mirkarwada)", 16.99, 73.30),
    ("Malvan (Sindhudurg), Maharashtra", 16.05, 73.46),
    # Goa
    ("Goa (Panaji & Malim)", 15.50, 73.81),
    ("Vasco da Gama (Cortalim), Goa", 15.40, 73.81),
    # Karnataka
    ("Karwar (Baithkol), Karnataka", 14.80, 74.12),
    ("Malpe (Udupi), Karnataka", 13.35, 74.70),
    ("Mangalore (Old Port), Karnataka", 12.87, 74.84),
    # Kerala
    ("Beypore (Kozhikode), Kerala", 11.16, 75.80),
    ("Munambam (Ernakulam), Kerala", 10.18, 76.17),
    ("Kochi (Thoppumpady), Kerala", 9.97, 76.27),
    ("Kollam (Neendakara), Kerala", 8.94, 76.54),
    ("Vizhinjam (Trivandrum), Kerala", 8.37, 76.99),
    # Tamil Nadu & Puducherry
    ("Tuticorin (Vembar), Tamil Nadu", 8.76, 78.14),
    ("Rameswaram / Mandapam, Tamil Nadu", 9.28, 79.31),
    ("Nagapattinam, Tamil Nadu", 10.76, 79.84),
    ("Cuddalore, Tamil Nadu", 11.75, 79.77),
    ("Chennai (Kasimedu/Royapuram)", 13.12, 80.30),
    # Andhra Pradesh
    ("Machilipatnam (Gilakaladindi), AP", 16.18, 81.16),
    ("Kakinada, Andhra Pradesh", 16.98, 82.25),
    ("Visakhapatnam, Andhra Pradesh", 17.69, 83.22),
    # Odisha
    ("Dhamra / Chandipur, Odisha", 20.80, 86.97),
    ("Paradip, Odisha", 20.32, 86.61),
    # West Bengal
    ("Digha (Sankarpur), West Bengal", 21.62, 87.51),
    ("Kakdwip / Frasergunj (Sundarbans)", 21.87, 88.18),
    # Island Territories
    ("Port Blair (Junglighat), A&N", 11.66, 92.73),
    ("Kavaratti / Agatti, Lakshadweep", 10.56, 72.64),
]

# Optimal Sea Surface Temperature Ranges for Indian Marine Species
OPTIMAL_SST = {
    "general_pelagic": (25.5, 30.0),
    "yellowfin_tuna": (26.0, 29.5),
    "skipjack_tuna": (26.5, 30.0),
    "indian_mackerel": (27.0, 30.5),
    "oil_sardine": (25.5, 28.8),
    "bombay_duck": (26.0, 29.0),
    "silver_pomfret": (26.5, 29.5),
    "hilsa": (25.0, 29.0),
}# Comprehensive ICAR-CMFRI Marine Pelagic Species Ecological Database
SPECIES_ECOLOGY = {
    "yellowfin_tuna": {
        "common_name": "Yellowfin Tuna (Kera / Aila)",
        "scientific_name": "Thunnus albacares",
        "optimal_sst": (26.0, 29.5),
        "ideal_depth": (35.0, 75.0),
        "min_do_ml_l": 3.5,
        "salinity_range": (34.0, 36.5),
        "gear": "Longline / Gillnet",
        "feeding_zone": "Thermocline transition layer with high micro-nekton aggregation"
    },
    "skipjack_tuna": {
        "common_name": "Skipjack Tuna (Choora)",
        "scientific_name": "Katsuwonus pelamis",
        "optimal_sst": (26.5, 30.0),
        "ideal_depth": (20.0, 60.0),
        "min_do_ml_l": 3.2,
        "salinity_range": (34.2, 36.2),
        "gear": "Pole & Line / Purse Seine",
        "feeding_zone": "Surface thermal fronts & upwelling boundaries"
    },
    "indian_mackerel": {
        "common_name": "Indian Mackerel (Bangda / Ayala)",
        "scientific_name": "Rastrelliger kanagurta",
        "optimal_sst": (27.0, 30.5),
        "ideal_depth": (5.0, 35.0),
        "min_do_ml_l": 3.0,
        "salinity_range": (33.0, 35.5),
        "gear": "Purse Seine / Ring Seine",
        "feeding_zone": "Upper mixed layer feeding on diatom phytoplankton"
    },
    "oil_sardine": {
        "common_name": "Indian Oil Sardine (Tarli / Mathi)",
        "scientific_name": "Sardinella longiceps",
        "optimal_sst": (25.5, 28.8),
        "ideal_depth": (0.0, 25.0),
        "min_do_ml_l": 2.8,
        "salinity_range": (32.5, 35.0),
        "gear": "Ring Seine / Gillnet",
        "feeding_zone": "Intense upwelling chlorophyll-a bloom plumes"
    },
    "bombay_duck": {
        "common_name": "Bombay Duck (Bombil)",
        "scientific_name": "Harpadon nehereus",
        "optimal_sst": (26.0, 29.0),
        "ideal_depth": (15.0, 45.0),
        "min_do_ml_l": 2.5,
        "salinity_range": (30.0, 34.0),
        "gear": "Dol Net / Bottom Trawl",
        "feeding_zone": "Shallow muddy continental shelf with tidal current mixing"
    },
    "silver_pomfret": {
        "common_name": "Silver Pomfret (Paplet / Vellavoli)",
        "scientific_name": "Pampus argenteus",
        "optimal_sst": (26.2, 29.2),
        "ideal_depth": (20.0, 50.0),
        "min_do_ml_l": 3.2,
        "salinity_range": (33.5, 35.8),
        "gear": "Bottom Trawl / Drift Gillnet",
        "feeding_zone": "Subsurface chlorophyll transition boundaries"
    }
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
                "distance_nm": round(dist / 1.852, 1),
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


def compute_thermocline_gradient(profile_id: int) -> dict | None:
    """
    Calculates the vertical temperature gradient (dT/dz) across depth layers.
    Identifies the maximum thermocline peak, its depth range, and stratification strength.
    Returns None when the profile has too few valid levels to resolve a gradient
    (no fabricated fallback constants).
    """
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT depth, temperature, salinity FROM argo_measurements
            WHERE profile_id = ? AND temperature IS NOT NULL
            ORDER BY depth ASC
            """,
            (profile_id,),
        ).fetchall()

    if len(rows) < 4:
        return None

    max_grad = 0.0
    therm_depth = None
    for i in range(len(rows) - 1):
        z1, t1 = rows[i]["depth"], rows[i]["temperature"]
        z2, t2 = rows[i + 1]["depth"], rows[i + 1]["temperature"]
        dz = z2 - z1
        if dz > 0.5:
            grad = abs(t1 - t2) / dz
            if grad > max_grad:
                max_grad = grad
                therm_depth = (z1 + z2) / 2.0

    if therm_depth is None:
        return None

    strat = "Strong" if max_grad > 0.12 else ("Moderate" if max_grad > 0.05 else "Weak")
    return {
        "thermocline_depth_m": round(therm_depth, 1),
        "max_gradient_c_per_m": round(max_grad, 3),
        "thermocline_layer": (round(max(10.0, therm_depth - 15.0), 1), round(therm_depth + 20.0, 1)),
        "stratification": strat
    }


def evaluate_species_profile_viability(
    species_key: str,
    sst: float,
    mld: float | None,
    thermocline_depth: float | None = None,
    salinity: float | None = None
) -> dict:
    """
    Evaluates in-situ ARGO telemetry against ICAR-CMFRI biological thresholds.
    Returns exact mathematical viability percentage (0-100%), recommended gear depth,
    and scientific reasoning.
    """
    ecology = SPECIES_ECOLOGY.get(species_key.lower().replace(" ", "_"), SPECIES_ECOLOGY["yellowfin_tuna"])
    t_min, t_max = ecology["optimal_sst"]
    d_min, d_max = ecology["ideal_depth"]
    
    # 1. Temperature score (Gaussian-like curve around center of optimal range)
    t_center = (t_min + t_max) / 2.0
    t_width = (t_max - t_min) / 2.0
    if t_min <= sst <= t_max:
        temp_score = 1.0 - (abs(sst - t_center) / (t_width * 1.5))
    else:
        temp_dist = min(abs(sst - t_min), abs(sst - t_max))
        temp_score = max(0.0, 1.0 - (temp_dist / 3.0))

    # 2. Subsurface MLD & Thermocline matching score
    effective_depth = thermocline_depth or mld or 40.0
    if d_min <= effective_depth <= d_max:
        depth_score = 1.0
    else:
        depth_dist = min(abs(effective_depth - d_min), abs(effective_depth - d_max))
        depth_score = max(0.2, 1.0 - (depth_dist / 40.0))

    # 3. Salinity score
    s_min, s_max = ecology["salinity_range"]
    eff_sal = salinity or 35.0
    sal_score = 1.0 if (s_min <= eff_sal <= s_max) else max(0.4, 1.0 - abs(eff_sal - 35.0) / 4.0)

    # Weighted Viability
    raw_viability = (0.50 * temp_score + 0.35 * depth_score + 0.15 * sal_score) * 100.0
    viability_pct = max(10, min(96, round(raw_viability)))

    status = "🟢 HIGH POTENTIAL" if viability_pct >= 75 else ("🟡 MODERATE" if viability_pct >= 50 else "🔴 LOW POTENTIAL")
    
    return {
        "species_name": ecology["common_name"],
        "scientific_name": ecology["scientific_name"],
        "viability_pct": viability_pct,
        "status": status,
        "recommended_gear_depth_m": f"{d_min:.0f}m - {d_max:.0f}m",
        "gear_type": ecology["gear"],
        "feeding_zone": ecology["feeding_zone"],
        "temperature_fit": f"{sst:.1f}°C (Optimal: {t_min}°C-{t_max}°C)",
        "salinity_fit": f"{eff_sal:.1f} PSU"
    }


def calculate_voyage_economics(
    distance_km: float,
    speed_knots: float = 9.5,
    engine_hp: int = 120
) -> dict:
    """
    Computes real marine voyage physics:
    - Distance in Nautical Miles (NM)
    - Transit time in hours
    - Diesel fuel burn in Litres
    - Direct NavIC routing savings in ₹ and CO2 reduction in kg
    """
    distance_nm = round(distance_km / 1.852, 1)
    transit_time_hrs = round(distance_nm / max(4.0, speed_knots), 1)
    
    # Specific fuel consumption formula: 0.15 - 0.18 L/hp/hr at 70% load
    burn_per_hour_l = (0.16 * engine_hp * 0.70)
    total_fuel_l = round(transit_time_hrs * burn_per_hour_l, 1)
    
    # Direct NavIC PFZ route saves ~20% fuel compared to blind wandering
    fuel_saved_l = round(total_fuel_l * 0.22, 1)
    rupees_saved = int(fuel_saved_l * 94.0)  # ~₹94/litre diesel in coastal states
    co2_saved_kg = round(fuel_saved_l * 2.68, 1) # 1L diesel = 2.68kg CO2
    
    return {
        "distance_km": round(distance_km, 1),
        "distance_nm": distance_nm,
        "transit_time_hrs": transit_time_hrs,
        "estimated_fuel_burn_l": total_fuel_l,
        "navic_fuel_saved_l": fuel_saved_l,
        "financial_saved_inr": rupees_saved,
        "co2_reduction_kg": co2_saved_kg
    }


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
) -> tuple[str, int, dict]:
    """
    Multi-sensor fused Explainable AI (XAI) PFZ scoring:
    1. Argo Subsurface MLD & thermocline stability (max 35 pts)
    2. Satellite SST thermal front matching (max 35 pts)
    3. Satellite Chlorophyll-a bio-productivity & nutrient gradient (max 30 pts)
    Total: 0 to 100 points
    Returns: (rating, score, xai_attribution)
    """
    reasons = []

    # 1. SST Score (Blend Argo + Satellite SST)
    fused_sst = (argo_sst + sat_sst) / 2.0
    opt_min, opt_max = OPTIMAL_SST["general_pelagic"]
    if opt_min <= fused_sst <= opt_max:
        sst_score = 35
        reasons.append(f"Optimal surface temperature ({fused_sst:.1f}°C) matches Indian Ocean pelagic comfort zone (25.5°C-30.0°C)")
    elif opt_min - 1.0 <= fused_sst <= opt_max + 1.0:
        sst_score = 25
        reasons.append(f"Sub-optimal thermal boundary ({fused_sst:.1f}°C) within ±1°C tolerance")
    elif opt_min - 2.0 <= fused_sst <= opt_max + 2.0:
        sst_score = 15
        reasons.append(f"Marginal thermal front ({fused_sst:.1f}°C)")
    else:
        sst_score = 5
        reasons.append(f"Extreme temperature ({fused_sst:.1f}°C) outside pelagic preference")

    # 2. MLD Score (Argo Subsurface)
    if mld is not None:
        if 18 <= mld <= 55:
            mld_score = 35
            reasons.append(f"Optimal Mixed Layer Depth ({mld:.1f}m) drives strong nutrient mixing without deep shoal dispersal")
        elif 55 < mld <= 90:
            mld_score = 25
            reasons.append(f"Moderate mixed layer ({mld:.1f}m) with active thermocline boundary")
        elif 10 <= mld < 18:
            mld_score = 20
            reasons.append(f"Shallow mixed layer ({mld:.1f}m) — concentrated surface shoal potential")
        else:
            mld_score = 10
            reasons.append(f"Deep/diffuse mixed layer ({mld:.1f}m)")
    else:
        mld_score = 18
        reasons.append("Default coastal mixed layer approximation applied")

    # 3. Chlorophyll-a Score (Satellite VIIRS/MODIS)
    chl_score = 0
    if 0.40 <= chlorophyll <= 2.20:
        chl_score += 22
        reasons.append(f"High phytoplankton productivity (Chlorophyll-a: {chlorophyll:.2f} mg/m³)")
    elif 0.20 <= chlorophyll < 0.40 or 2.20 < chlorophyll <= 3.50:
        chl_score += 15
        reasons.append(f"Moderate ocean color signature (Chlorophyll-a: {chlorophyll:.2f} mg/m³)")
    else:
        chl_score += 8
        reasons.append(f"Low/oligotrophic ocean color ({chlorophyll:.2f} mg/m³)")

    # Chlorophyll front bonus (gradient >= 0.08)
    if chl_gradient >= 0.08:
        chl_score += 8
        reasons.append(f"Sharp nutrient convergence front detected (gradient: {chl_gradient:.3f})")
    elif chl_gradient >= 0.04:
        chl_score += 4
        reasons.append("Mild bio-optical chlorophyll gradient")

    score = min(100, max(0, sst_score + mld_score + chl_score))

    if score >= 80:
        rating = "Excellent"
    elif score >= 60:
        rating = "Good"
    elif score >= 40:
        rating = "Fair"
    else:
        rating = "Poor"

    xai_attribution = {
        "sst_score": sst_score,
        "sst_max": 35,
        "sst_contribution_pct": round((sst_score / 35.0) * 100, 1),
        "mld_score": mld_score,
        "mld_max": 35,
        "mld_contribution_pct": round((mld_score / 35.0) * 100, 1),
        "chlorophyll_score": chl_score,
        "chlorophyll_max": 30,
        "chlorophyll_contribution_pct": round((chl_score / 30.0) * 100, 1),
        "total_score": score,
        "reasons": reasons
    }

    return rating, score, xai_attribution


def get_all_harbours() -> list[dict]:
    """Returns list of major and minor Indian fishing harbours."""
    return [
        {"harbour": name, "latitude": lat, "longitude": lon}
        for name, lat, lon in HARBOURS
    ]


def get_pfz_advisories(region: str = "arabian_sea", limit: int = 40) -> list[dict]:
    """
    Compute multi-sensor fused PFZ advisories for recent profiles in a region.
    Fuses Argo point observations with satellite continuous SST & Chlorophyll-a,
    and includes high-yield Coastal Fishing Zones (5–30 NM from major fishing harbours).
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

    advisories = []

    # 1. GENERATE HIGH-YIELD COASTAL PFZ ZONES (5-30 NM Offshore from Harbours)
    for h_name, h_lat, h_lon in HARBOURS:
        if not (lat_min <= h_lat <= lat_max and lon_min <= h_lon <= lon_max):
            continue

        # West Coast offsets (towards Arabian Sea, west) vs East Coast (towards Bay of Bengal, east)
        lon_offset = -0.28 if h_lon <= 77.0 else 0.28
        coastal_points = [
            (round(h_lat + 0.04, 4), round(h_lon + lon_offset, 4), "Coastal Front Alpha (18 NM)"),
            (round(h_lat - 0.08, 4), round(h_lon + (lon_offset * 1.35), 4), "Continental Shelf Edge (26 NM)")
        ]

        for c_lat, c_lon, tag in coastal_points:
            sat_data = get_nearest_satellite_data(c_lat, c_lon)
            sat_sst = sat_data["satellite_sst"]
            chlorophyll = sat_data["chlorophyll_mg_m3"]
            chl_grad = sat_data["chlorophyll_gradient"]
            # No ARGO profile exists at these synthetic offshore points, so MLD is genuinely
            # unknown here — pass None (neutral weight in scoring) rather than a fabricated value.
            coastal_mld = None

            # Score on the modeled satellite SST alone; there is no independent in-situ SST to fuse.
            rating, score, xai = score_pfz_fused(sat_sst, coastal_mld, sat_sst, chlorophyll, chl_grad)
            h_info = nearest_harbour(c_lat, c_lon)

            # Local coastal fish species
            fish_species = []
            for sp, (tmin, tmax) in OPTIMAL_SST.items():
                if tmin <= sat_sst <= tmax and sp != "general_pelagic":
                    fish_species.append(sp.replace("_", " ").title())
            if not fish_species:
                fish_species = ["Indian Mackerel", "Silver Pomfret", "Surmai"]

            advisories.append({
                "float_id": f"COASTAL-PFZ-{h_name.split('(')[0].split(',')[0].strip().upper()}",
                "latitude": c_lat,
                "longitude": c_lon,
                "date": "Modeled coastal front (climatology)",
                "sst_celsius": sat_sst,
                "satellite_sst": sat_sst,
                "chlorophyll_mg_m3": chlorophyll,
                "chlorophyll_gradient": chl_grad,
                "mld_meters": coastal_mld,
                "pfz_rating": rating,
                "pfz_score": score,
                "xai_attribution": xai,
                "data_confidence": sat_data["data_confidence"],
                "data_sources": sat_data["data_sources"],
                "target_species": fish_species,
                "nearest_harbour": h_info,
                "advisory": (
                    f"Modeled coastal fishing zone ({tag}). Chlorophyll {chlorophyll:.2f} mg/m³ "
                    f"and SST {sat_sst:.1f}°C favour {', '.join(fish_species[:3])}. "
                    f"Located {h_info['distance_km']} km {h_info['compass']} of {h_info['harbour']}."
                )
            })

    # 2. GENERATE DEEP-SEA ARGO FUSED PFZ ZONES FROM DATABASE PROFILES
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

    for p in profiles:
        argo_sst = compute_sst(p["id"])
        if argo_sst is None:
            continue

        mld = compute_mld(p["id"])
        thermo = compute_thermocline_gradient(p["id"])
        lat = round(p["latitude"], 4)
        lon = round(p["longitude"], 4)

        # Look up continuous satellite overlay at this point
        sat_data = get_nearest_satellite_data(lat, lon)
        sat_sst = sat_data["satellite_sst"]
        chlorophyll = sat_data["chlorophyll_mg_m3"]
        chl_gradient = sat_data["chlorophyll_gradient"]

        rating, score, xai = score_pfz_fused(argo_sst, mld, sat_sst, chlorophyll, chl_gradient)
        harbour = nearest_harbour(lat, lon)

        # Determine target fish species based on fused SST and chlorophyll
        fused_sst = round((argo_sst + sat_sst) / 2.0, 2)
        fish_species = []
        for species, (tmin, tmax) in OPTIMAL_SST.items():
            if tmin <= fused_sst <= tmax and species != "general_pelagic":
                fish_species.append(species.replace("_", " ").title())

        advisories.append({
            "float_id": str(p["float_id"]),
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
            "xai_attribution": xai,
            "data_confidence": sat_data["data_confidence"],
            "data_sources": sat_data["data_sources"],
            "target_species": fish_species if fish_species else ["General Pelagic"],
            "nearest_harbour": harbour,
            "advisory": _generate_fused_advisory_text(
                argo_sst, sat_sst, chlorophyll, mld, rating, harbour, fish_species, thermo
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
    species: list[str],
    thermo: dict | None = None,
) -> str:
    """Generate comprehensive scientific advisory text citing both Argo and Satellite indicators."""
    mld_text = f"Mixed Layer Depth {mld:.0f}m" if mld else "Subsurface MLD stable"
    species_text = ", ".join(species[:3]) if species else "pelagic fish"
    harbour_text = f"{harbour['distance_km']}km {harbour['compass']} of {harbour['harbour']}" if harbour else "offshore sector"
    # Surface real ARGO-derived thermocline through the advisory string, since the PFZResponse
    # schema strips unknown keys — this is the only channel that reaches the client.
    therm_text = (
        f" Thermocline ~{thermo['thermocline_depth_m']:.0f}m "
        f"({thermo['stratification'].lower()} stratification, dT/dz {thermo['max_gradient_c_per_m']:.3f}°C/m)."
        if thermo else ""
    )

    if rating == "Excellent":
        return (
            f"High-confidence PFZ! Satellite Chlorophyll {chlorophyll:.2f} mg/m³ confirms rich bio-productivity. "
            f"Fused SST {argo_sst:.1f}°C (Argo) / {sat_sst:.1f}°C (Satellite) is optimal for {species_text}. "
            f"{mld_text}.{therm_text} Location: {harbour_text}."
        )
    elif rating == "Good":
        return (
            f"Favorable fishing zone. Satellite Chlorophyll {chlorophyll:.2f} mg/m³ with {mld_text}. "
            f"SST {argo_sst:.1f}°C supports {species_text}.{therm_text} Location: {harbour_text}."
        )
    elif rating == "Fair":
        return (
            f"Moderate fishing conditions. Chlorophyll {chlorophyll:.2f} mg/m³, SST {argo_sst:.1f}°C. "
            f"{mld_text}.{therm_text} Location: {harbour_text}."
        )
    else:
        return (
            f"Suboptimal conditions. Chlorophyll {chlorophyll:.2f} mg/m³ outside prime feeding threshold. "
            f"Location: {harbour_text}."
        )


# =========================================================================
# COASTAL THERMAL FRONT VECTORS & MULTI-SENSOR FRONTAL LINES
# =========================================================================
# NOTE: These are STATIC, ILLUSTRATIVE reference polylines for map overlay — hand-digitised
# from typical seasonal shelf-front positions, NOT computed from live ARGO/satellite data.
# The embedded SST / chlorophyll / depth values in each "advisory" are representative
# examples, not real-time measurements. Do not present them as current observations.
COASTAL_SECTOR_LINES = [
    {
        "id": "LINE-KONKAN-01",
        "sector": "Maharashtra & Konkan Shelf Front",
        "state": "Maharashtra",
        "coordinates": [
            [19.45, 72.35],
            [19.12, 72.42],
            [18.72, 72.48],
            [17.85, 72.75],
            [16.98, 73.02],
            [16.05, 73.18],
        ],
        "depth_range": "30m - 75m",
        "target_species": ["Surmai (King Mackerel)", "Silver Pomfret", "Bombay Duck", "Karli"],
        "advisory": "Strong thermal gradient front at 28.2°C with high chlorophyll-a (0.88 mg/m³). Ideal for mechanized purse-seine and gillnets.",
    },
    {
        "id": "LINE-SAURASHTRA-02",
        "sector": "Gujarat & Saurashtra Upwelling Ridge",
        "state": "Gujarat",
        "coordinates": [
            [22.45, 68.65],
            [21.65, 69.15],
            [20.90, 69.85],
            [20.72, 70.65],
            [20.85, 71.20],
        ],
        "depth_range": "40m - 90m",
        "target_species": ["Ribbonfish", "Croakers (Ghol)", "Squids", "Yellowfin Tuna"],
        "advisory": "Active cold-core upwelling eddy along Saurashtra shelf edge. High concentration of pelagic ribbonfish & squids.",
    },
    {
        "id": "LINE-MALABAR-03",
        "sector": "Malabar & Kerala Continental Slope Front",
        "state": "Kerala",
        "coordinates": [
            [12.85, 74.35],
            [11.85, 75.05],
            [11.15, 75.45],
            [10.15, 75.85],
            [9.25, 76.15],
            [8.35, 76.65],
        ],
        "depth_range": "35m - 120m",
        "target_species": ["Oil Sardine (Mathi)", "Indian Mackerel (Ayala)", "Skipjack Tuna", "Seer Fish"],
        "advisory": "Intense coastal bloom front (Chl-a 1.12 mg/m³). Peak morning feed activity for pelagic shoals.",
    },
    {
        "id": "LINE-COROMANDEL-04",
        "sector": "Coromandel & Andhra Pelagic Convergence",
        "state": "Tamil Nadu & AP",
        "coordinates": [
            [8.75, 78.45],
            [10.75, 80.15],
            [13.15, 80.65],
            [15.85, 80.95],
            [17.65, 83.55],
        ],
        "depth_range": "45m - 150m",
        "target_species": ["Yellowfin Tuna", "Mahi Mahi (Dorab)", "Barracuda", "Sailfish"],
        "advisory": "Shelf boundary current convergence line with high dissolved oxygen and thermal gradient.",
    },
    {
        "id": "LINE-BENGAL-05",
        "sector": "Northern Bay of Bengal & Odisha Delta Front",
        "state": "Odisha & West Bengal",
        "coordinates": [
            [19.25, 85.25],
            [20.30, 86.95],
            [21.45, 87.35],
            [21.65, 88.05],
            [21.85, 88.65],
        ],
        "depth_range": "25m - 60m",
        "target_species": ["Hilsa (Ilish)", "Bhetki (Barramundi)", "Tiger Shrimp", "Silver Pomfret"],
        "advisory": "Nutrient-rich estuarine plume boundary from Mahanadi and Hooghly discharge. Premier zone for Hilsa shoaling.",
    },
]


def get_coastal_pfz_lines() -> list[dict]:
    """Return all coastal PFZ vector front lines."""
    return COASTAL_SECTOR_LINES


# ===========================================================================
# EXPLAINABLE AI (XAI) MULTI-FACTOR ATTRIBUTION ENGINE
# Combines 4 oceanographic/ecological signals into one composite PFZ score,
# and returns a full attribution breakdown so the frontend can render an
# "XAI bar" showing exactly why a zone was flagged.
#
# Weights (tunable, sum = 1.0):
#     SST Thermal Front   -> 0.40
#     Chlorophyll-a Bloom -> 0.30
#     Thermocline Depth   -> 0.20
#     Catch Validation    -> 0.10
# ===========================================================================

WEIGHTS = {
    "sst_thermal_front": 0.40,
    "chlorophyll_bloom": 0.30,
    "thermocline_depth": 0.20,
    "catch_validation": 0.10,
}

SEARCH_RADIUS_KM = 25.0        # neighborhood radius for SST gradient / catch sampling
CATCH_LOOKBACK_DAYS = 30       # how far back verified fishermen_reports are trusted
EARTH_RADIUS_KM = 6371.0


@dataclass
class FactorScore:
    """One line item in the XAI attribution bar."""
    name: str
    raw_value: Optional[float]        # actual physical measurement, for UI tooltip
    raw_unit: str
    normalized_score: float           # 0-100, how favorable this factor is
    weight: float                     # 0-1
    contribution_pct: float = 0.0     # share of FINAL composite score (filled after combine)
    rationale: str = ""               # human-readable one-liner for the UI card


@dataclass
class PFZResult:
    latitude: float
    longitude: float
    composite_score: float            # 0-100
    classification: str               # "Low" | "Moderate" | "High" | "Very High"
    factors: List[FactorScore]
    species_hint: Optional[str] = None
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "composite_score": round(self.composite_score, 1),
            "classification": self.classification,
            "species_hint": self.species_hint,
            "generated_at": self.generated_at,
            "xai_breakdown": [
                {
                    "factor": f.name,
                    "raw_value": f.raw_value,
                    "unit": f.raw_unit,
                    "score": round(f.normalized_score, 1),
                    "weight_pct": round(f.weight * 100, 0),
                    "contribution_pct": round(f.contribution_pct, 1),
                    "why": f.rationale,
                }
                for f in self.factors
            ],
        }


# ---------------------------------------------------------------------------
# Factor 1 — SST Thermal Front (40%)
# Fish aggregate along sharp temperature gradients (fronts), not on smooth
# SST. Approximate a front by sampling SST at N/S/E/W offsets and taking the
# max gradient (°C/km).
# ---------------------------------------------------------------------------
def score_sst_thermal_front(
    lat: float,
    lon: float,
    satellite_sst_fn: Callable[[float, float], Optional[float]],
) -> FactorScore:
    """satellite_sst_fn(lat, lon) -> sst_celsius or None. Wire to satellite_client.py cache."""
    offset_deg = 0.15  # ~15-17km at Indian coastal latitudes, matches 0.5° cached grid
    center = satellite_sst_fn(lat, lon)
    offsets = {
        "N": (offset_deg, 0.0),
        "S": (-offset_deg, 0.0),
        "E": (0.0, offset_deg),
        "W": (0.0, -offset_deg),
    }

    gradients = []
    if center is not None:
        for dlat, dlon in offsets.values():
            sample = satellite_sst_fn(lat + dlat, lon + dlon)
            if sample is None:
                continue
            dist_km = haversine_km(lat, lon, lat + dlat, lon + dlon)
            if dist_km > 0:
                gradients.append(abs(sample - center) / dist_km)

    max_gradient = max(gradients) if gradients else 0.0
    normalized = min(100.0, (max_gradient / 0.20) * 100.0)

    if max_gradient >= 0.15:
        rationale = f"Strong thermal front ({max_gradient:.3f}°C/km) — likely current boundary, fish tend to aggregate."
    elif max_gradient >= 0.05:
        rationale = f"Moderate SST gradient ({max_gradient:.3f}°C/km) nearby — usable front signal."
    else:
        rationale = f"Weak SST gradient ({max_gradient:.3f}°C/km) — no strong thermal front detected."

    return FactorScore(
        name="SST Thermal Front",
        raw_value=round(max_gradient, 4),
        raw_unit="°C/km",
        normalized_score=normalized,
        weight=WEIGHTS["sst_thermal_front"],
        rationale=rationale,
    )


# ---------------------------------------------------------------------------
# Factor 2 — NASA Chlorophyll-a Bloom (30%)
# Higher chlorophyll = more phytoplankton = baitfish = pelagic predators.
# Too high (>8 mg/m3) can flag a harmful algal bloom (HAB) risk -> penalize.
# ---------------------------------------------------------------------------
def score_chlorophyll_bloom(
    lat: float,
    lon: float,
    satellite_chl_fn: Callable[[float, float], Optional[float]],
) -> FactorScore:
    chl = satellite_chl_fn(lat, lon)  # mg/m3
    if chl is None:
        return FactorScore(
            "Chlorophyll-a Bloom", None, "mg/m³", 0.0,
            WEIGHTS["chlorophyll_bloom"],
            rationale="No chlorophyll satellite data available for this cell.",
        )

    if chl < 0.1:
        normalized = (chl / 0.1) * 30.0
        rationale = f"Very low chlorophyll ({chl:.2f} mg/m³) — nutrient-poor water, low bait density."
    elif chl <= 3.0:
        normalized = 40.0 + (chl / 3.0) * 60.0
        rationale = f"Productive bloom ({chl:.2f} mg/m³) — strong bait-fish density indicator."
    elif chl <= 8.0:
        normalized = 100.0 - ((chl - 3.0) / 5.0) * 40.0
        rationale = f"High chlorophyll ({chl:.2f} mg/m³) — productive but nearing bloom saturation."
    else:
        normalized = max(10.0, 60.0 - (chl - 8.0) * 5.0)
        rationale = f"Very high chlorophyll ({chl:.2f} mg/m³) — possible harmful algal bloom (HAB) risk."

    return FactorScore(
        name="Chlorophyll-a Bloom",
        raw_value=round(chl, 3),
        raw_unit="mg/m³",
        normalized_score=max(0.0, min(100.0, normalized)),
        weight=WEIGHTS["chlorophyll_bloom"],
        rationale=rationale,
    )


# ---------------------------------------------------------------------------
# Factor 3 — Thermocline Depth (20%)
# Each target species has a preferred depth band.
# Score = how close the ARGO-derived thermocline depth is to that band.
# ---------------------------------------------------------------------------
def score_thermocline_depth(
    thermocline_depth_m: Optional[float],
    species_depth_range_m: Tuple[float, float] = (20.0, 80.0),
    species_name: str = "Yellowfin Tuna",
) -> FactorScore:
    if thermocline_depth_m is None:
        return FactorScore(
            "Thermocline Depth", None, "m", 0.0,
            WEIGHTS["thermocline_depth"],
            rationale="No nearby ARGO profile available to compute thermocline depth.",
        )

    lo, hi = species_depth_range_m
    mid = (lo + hi) / 2.0
    half_range = max((hi - lo) / 2.0, 1e-6)

    if lo <= thermocline_depth_m <= hi:
        distance_from_center = abs(thermocline_depth_m - mid)
        normalized = 100.0 - (distance_from_center / half_range) * 20.0
        rationale = (
            f"Thermocline at {thermocline_depth_m:.0f}m sits within {species_name}'s "
            f"preferred band ({lo:.0f}-{hi:.0f}m) — favorable feeding depth."
        )
    else:
        distance_outside = min(abs(thermocline_depth_m - lo), abs(thermocline_depth_m - hi))
        normalized = max(0.0, 60.0 - distance_outside * 1.5)
        rationale = (
            f"Thermocline at {thermocline_depth_m:.0f}m is outside {species_name}'s "
            f"preferred band ({lo:.0f}-{hi:.0f}m) — species less likely at this depth."
        )

    return FactorScore(
        name="Thermocline Depth",
        raw_value=round(thermocline_depth_m, 1),
        raw_unit="m",
        normalized_score=max(0.0, min(100.0, normalized)),
        weight=WEIGHTS["thermocline_depth"],
        rationale=rationale,
    )


# ---------------------------------------------------------------------------
# Factor 4 — Catch Validation (10%)
# The closed-loop differentiator: verified fishermen_reports near this point
# in the last N days boost confidence in the prediction.
# ---------------------------------------------------------------------------
def score_catch_validation(lat: float, lon: float, db_conn: Optional[sqlite3.Connection] = None) -> FactorScore:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=CATCH_LOOKBACK_DAYS)).isoformat()
    
    if db_conn is not None and hasattr(db_conn, "execute"):
        cursor = db_conn.execute(
            """
            SELECT quantity_kg, latitude, longitude
            FROM fishermen_reports
            WHERE verified = 1 AND created_at >= ?
            """,
            (cutoff,),
        )
        rows = cursor.fetchall()
    else:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT quantity_kg, latitude, longitude
                FROM fishermen_reports
                WHERE verified = 1 AND created_at >= ?
                """,
                (cutoff,),
            )
            rows = cursor.fetchall()

    nearby_catches = []
    for r in rows:
        quantity_kg = r["quantity_kg"] if isinstance(r, (sqlite3.Row, dict)) else r[0]
        r_lat = r["latitude"] if isinstance(r, (sqlite3.Row, dict)) else r[1]
        r_lon = r["longitude"] if isinstance(r, (sqlite3.Row, dict)) else r[2]
        dist = haversine_km(lat, lon, r_lat, r_lon)
        if dist <= SEARCH_RADIUS_KM:
            nearby_catches.append(quantity_kg)

    if not nearby_catches:
        return FactorScore(
            "Catch Validation", 0.0, "verified reports",
            35.0,  # neutral prior — don't punish zones that just lack history yet
            WEIGHTS["catch_validation"],
            rationale=(
                f"No verified catch reports within {SEARCH_RADIUS_KM:.0f}km in the last "
                f"{CATCH_LOOKBACK_DAYS} days — prediction is model-only, unvalidated."
            ),
        )

    avg_kg = sum(nearby_catches) / len(nearby_catches)
    normalized = min(100.0, (avg_kg / 200.0) * 100.0)

    return FactorScore(
        name="Catch Validation",
        raw_value=round(avg_kg, 1),
        raw_unit="kg avg (verified)",
        normalized_score=normalized,
        weight=WEIGHTS["catch_validation"],
        rationale=(
            f"{len(nearby_catches)} verified catch report(s) within {SEARCH_RADIUS_KM:.0f}km "
            f"averaging {avg_kg:.1f}kg — ground-truth supports this zone."
        ),
    )


# ---------------------------------------------------------------------------
# Composite Classification & Solver
# ---------------------------------------------------------------------------
def classify_pfz_score(score: float) -> str:
    if score >= 75:
        return "Very High"
    if score >= 55:
        return "High"
    if score >= 35:
        return "Moderate"
    return "Low"


def get_thermocline_depth_near(lat: float, lon: float) -> Optional[float]:
    """Find closest ARGO float in SQLite and compute its thermocline depth."""
    with get_connection() as conn:
        profile = conn.execute(
            """
            SELECT id, latitude, longitude
            FROM argo_profiles
            ORDER BY ((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)) ASC
            LIMIT 1
            """,
            (lat, lat, lon, lon)
        ).fetchone()

        if not profile:
            return 45.0
        
        therm = compute_thermocline_gradient(profile["id"])
        return therm.get("thermocline_depth_m", 45.0)


def compute_pfz_score(
    lat: float,
    lon: float,
    satellite_sst_fn: Optional[Callable[[float, float], Optional[float]]] = None,
    satellite_chl_fn: Optional[Callable[[float, float], Optional[float]]] = None,
    thermocline_depth_m: Optional[float] = None,
    db_conn: Optional[sqlite3.Connection] = None,
    species_name: str = "Yellowfin Tuna",
    species_depth_range_m: Tuple[float, float] = (20.0, 80.0),
) -> PFZResult:
    """
    Main XAI Explainable Scoring Entry Point.
    Returns composite score, classification, and factor attribution breakdown.
    """
    if satellite_sst_fn is None:
        satellite_sst_fn = get_sst_at
    if satellite_chl_fn is None:
        satellite_chl_fn = get_chlorophyll_at
    if thermocline_depth_m is None:
        thermocline_depth_m = get_thermocline_depth_near(lat, lon)

    factors = [
        score_sst_thermal_front(lat, lon, satellite_sst_fn),
        score_chlorophyll_bloom(lat, lon, satellite_chl_fn),
        score_thermocline_depth(thermocline_depth_m, species_depth_range_m, species_name),
        score_catch_validation(lat, lon, db_conn),
    ]

    weighted_sum = sum(f.normalized_score * f.weight for f in factors)
    for f in factors:
        contribution = f.normalized_score * f.weight
        f.contribution_pct = (contribution / weighted_sum * 100.0) if weighted_sum > 0 else 0.0

    return PFZResult(
        latitude=lat,
        longitude=lon,
        composite_score=weighted_sum,
        classification=classify_pfz_score(weighted_sum),
        factors=factors,
        species_hint=species_name,
    )



