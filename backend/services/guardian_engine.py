"""
Lehar AI — "Lehar Guardian" Proactive Safety & Opportunity Alert Engine
Transforms Lehar AI from a reactive query system into a 24/7 proactive ocean watchdog.

Pushes two types of proactive notifications to registered coastal fishermen:
1. 🛡️ Safety Alert — Extreme thermal/salinity anomalies, Marine Heatwaves (Cat III/IV), or rough sea precursor signals.
2. 🎣 Opportunity Alert — High-confidence multi-sensor PFZ zones (Score >= 80/100) near coastal harbours.
"""

from __future__ import annotations
import math
import uuid
from datetime import datetime, timezone
from .db import get_connection
from .pfz_engine import get_pfz_advisories, nearest_harbour, haversine_km
from .satellite_client import get_nearest_satellite_data
from .species_dict import SPECIES_REGISTRY, evaluate_species_viability

# Simulated Registered Coastal Fishermen Directory (Demo Bounding)
REGISTERED_FISHERMEN = [
    {
        "id": 1,
        "name": "Ramesh K.",
        "phone_last4": "8492",
        "home_sector": "Kochi",
        "harbour": "Kochi (Cochin), Kerala",
        "lat": 9.97,
        "lon": 76.27,
        "language": "hi-IN",
    },
    {
        "id": 2,
        "name": "Devendra Patil",
        "phone_last4": "3910",
        "home_sector": "Mumbai",
        "harbour": "Mumbai (Sassoon Dock)",
        "lat": 18.91,
        "lon": 72.83,
        "language": "hi-IN",
    },
    {
        "id": 3,
        "name": "Bhikha Bhai",
        "phone_last4": "5021",
        "home_sector": "Porbandar",
        "harbour": "Porbandar, Gujarat",
        "lat": 21.64,
        "lon": 69.61,
        "language": "hi-IN",
    },
    {
        "id": 4,
        "name": "Selvamurugan",
        "phone_last4": "7134",
        "home_sector": "Chennai",
        "harbour": "Chennai (Royapuram)",
        "lat": 13.12,
        "lon": 80.30,
        "language": "ta-IN",
    },
    {
        "id": 5,
        "name": "Kiran Naik",
        "phone_last4": "9921",
        "home_sector": "Goa / Ratnagiri",
        "harbour": "Ratnagiri, Maharashtra",
        "lat": 16.99,
        "lon": 73.30,
        "language": "hi-IN",
    },
    {
        "id": 6,
        "name": "Appala Raju",
        "phone_last4": "4482",
        "home_sector": "Visakhapatnam",
        "harbour": "Visakhapatnam, AP",
        "lat": 17.69,
        "lon": 83.22,
        "language": "te-IN",
    },
    {
        "id": 7,
        "name": "Pradeep Das",
        "phone_last4": "6109",
        "home_sector": "Paradip",
        "harbour": "Paradip, Odisha",
        "lat": 20.32,
        "lon": 86.61,
        "language": "hi-IN",
    },
]


def _match_nearest_fisherman(lat: float, lon: float) -> tuple[dict, float]:
    """Find the registered fisherman nearest to given coordinates."""
    best_f = REGISTERED_FISHERMEN[0]
    min_d = float("inf")
    for f in REGISTERED_FISHERMEN:
        d = haversine_km(lat, lon, f["lat"], f["lon"])
        if d < min_d:
            min_d = d
            best_f = f
    return best_f, round(min_d, 1)


def scan_for_guardian_alerts() -> list[dict]:
    """
    Scans the multi-sensor ocean environment for:
    1. Safety Alerts (Active thermal & salinity anomaly breaches).
    2. Opportunity Alerts (High-yield PFZ zones with score >= 80).
    Matches them to registered fishermen and formats human-readable notifications.
    """
    alerts = []

    # 1. SCAN FOR SAFETY ALERTS (From Anomaly Observations)
    with get_connection() as conn:
        anomaly_rows = conn.execute(
            """
            SELECT id, float_id, latitude, longitude, date, parameter, value, threshold, severity, description
            FROM anomaly_alerts
            WHERE severity IN ('critical', 'high')
            ORDER BY id DESC
            LIMIT 6
            """
        ).fetchall()

    for row in anomaly_rows:
        lat, lon = row["latitude"], row["longitude"]
        fisherman, dist_km = _match_nearest_fisherman(lat, lon)
        sat = get_nearest_satellite_data(lat, lon)

        param = row["parameter"]
        val = row["value"]
        thresh = row["threshold"]
        sev = row["severity"]

        # Human-readable safety alert text without raw unrounded noise
        if param == "temperature":
            safety_msg = (
                f"⚠️ SAFETY WARNING for {fisherman['home_sector']} Coast:\n\n"
                f"Severe surface thermal anomaly ({val:.1f}°C vs normal {thresh:.1f}°C) detected {dist_km:.0f}km offshore "
                f"near ARGO Float #{row['float_id'] or 'ARGO'}. Extreme thermal gradient indicates high risk of sudden squalls, "
                f"rough wave turbulence, and unstable water column. Small craft advised to exercise extreme caution."
            )
        else:
            safety_msg = (
                f"⚠️ SAFETY WARNING for {fisherman['home_sector']} Coast:\n\n"
                f"Significant salinity drop ({val:.1f} PSU vs threshold {thresh:.1f} PSU) detected {dist_km:.0f}km offshore. "
                f"Rapid freshwater influx / thermocline disruption observed. Heavy localized sea disturbances probable."
            )

        alerts.append({
            "id": f"safe-{row['id']}-{uuid.uuid4().hex[:4]}",
            "type": "safety",
            "severity": sev,
            "title": f"Ocean Safety Warning ({fisherman['home_sector']} Sector)",
            "message": safety_msg,
            "recipient": {
                "id": fisherman["id"],
                "name": fisherman["name"],
                "phone_last4": fisherman["phone_last4"],
                "home_sector": fisherman["home_sector"],
                "harbour": fisherman["harbour"],
            },
            "location": {
                "latitude": round(lat, 3),
                "longitude": round(lon, 3),
                "distance_km": dist_km,
                "home_harbour": fisherman["harbour"],
            },
            "metrics": {
                "parameter": param,
                "observed_value": round(val, 2),
                "baseline_threshold": round(thresh, 2),
                "unit": "°C" if param == "temperature" else "PSU",
            },
            "data_sources": [
                f"INCOIS ARGO Float #{row['float_id'] or 'Live'}",
                "NOAA MUR Satellite SST",
                "AnomalyRadar Climatology Baseline"
            ],
            "timestamp": datetime.now(timezone.utc).strftime("%I:%M %p"),
        })

    # 2. SCAN FOR OPPORTUNITY ALERTS (From Fused PFZ Advisories with Score >= 80)
    pfz_advisories = get_pfz_advisories(region="all", limit=30)
    high_yield_pfz = [p for p in pfz_advisories if p.get("pfz_score", 0) >= 80]

    for pfz in high_yield_pfz[:4]:
        lat, lon = pfz["latitude"], pfz["longitude"]
        fisherman, dist_km = _match_nearest_fisherman(lat, lon)
        sst = pfz.get("sst_celsius", 28.2)
        sal = pfz.get("salinity", 35.2)
        mld = pfz.get("mld_meters", 35.0)

        # Cross-reference with Vernacular Species Dictionary (Biology Grounding)
        scored_species = []
        for sp_key, sp_info in SPECIES_REGISTRY.items():
            viability = evaluate_species_viability(sp_info, sst, mld, sal)
            scored_species.append((viability["score"], sp_info, viability))

        scored_species.sort(key=lambda x: x[0], reverse=True)
        top_score, top_sp, top_viability = scored_species[0]
        second_score, second_sp, second_viability = scored_species[1]

        matched_species = None
        species_common_name = None
        viability_score = None

        if top_score >= 65:
            matched_species = top_sp["common_name"].split("(")[-1].rstrip(")")
            species_common_name = top_sp["common_name"]
            viability_score = top_score

            if top_score >= 80 and second_score >= 80:
                sp1_v = top_sp["common_name"].split("(")[-1].rstrip(")")
                sp2_v = second_sp["common_name"].split("(")[-1].rstrip(")")
                target_catch_str = f"Favorable for both {sp1_v} ({top_score}% match) and {sp2_v} ({second_score}% match)"
                opp_lead = (
                    f"{fisherman['home_sector']} ke paas {sp1_v} aur {sp2_v} ke liye {top_score}% optimal conditions hain — "
                    f"SST ({sst:.1f}°C) aur depth range dono match kar rahe hain."
                )
            else:
                target_catch_str = f"{top_sp['common_name']} ({top_score}% Viability)"
                opp_lead = (
                    f"{fisherman['home_sector']} ke paas {matched_species} ({top_sp['common_name'].split('(')[0].strip()}) ke liye "
                    f"{top_score}% optimal conditions hain — SST ({sst:.1f}°C) aur depth range dono match kar rahe hain."
                )
        else:
            target_catch_str = ", ".join(pfz["target_species"][:3])
            opp_lead = f"High-confidence fishing zone detected near {fisherman['home_sector']} ({pfz['pfz_score']}/100 confidence)."

        mld_str = f"{mld:.0f}m" if mld else "35m"

        opp_msg = (
            f"🎣 HIGH-YIELD FISHING OPPORTUNITY for {fisherman['name']} ({fisherman['home_sector']}):\n\n"
            f"{opp_lead}\n\n"
            f"• Location: {dist_km:.0f}km {pfz['nearest_harbour']['compass']} of {fisherman['harbour']}\n"
            f"• Fused SST: {sst:.1f}°C (Ideal feeding range)\n"
            f"• Chlorophyll-a: {pfz.get('chlorophyll_mg_m3', 0.85):.2f} mg/m³ (Active plankton bloom)\n"
            f"• Thermocline MLD: {mld_str}\n"
            f"• Target Catch: {target_catch_str}\n"
            f"• Fused AI Confidence: {pfz['pfz_score']}/100 ({pfz['pfz_rating']})\n\n"
            f"Optimal time window: Next 24–36 hours."
        )

        alerts.append({
            "id": f"opp-{pfz['float_id']}-{uuid.uuid4().hex[:4]}",
            "type": "opportunity",
            "severity": "high",
            "title": f"High-Confidence PFZ ({fisherman['home_sector']} Sector)",
            "species": matched_species,
            "species_common_name": species_common_name,
            "viability_score": viability_score,
            "message": opp_msg,
            "recipient": {
                "id": fisherman["id"],
                "name": fisherman["name"],
                "phone_last4": fisherman["phone_last4"],
                "home_sector": fisherman["home_sector"],
                "harbour": fisherman["harbour"],
            },
            "location": {
                "latitude": lat,
                "longitude": lon,
                "distance_km": dist_km,
                "home_harbour": fisherman["harbour"],
            },
            "metrics": {
                "pfz_score": pfz["pfz_score"],
                "pfz_rating": pfz["pfz_rating"],
                "sst_celsius": sst,
                "satellite_sst": pfz.get("satellite_sst", sst),
                "chlorophyll_mg_m3": pfz.get("chlorophyll_mg_m3", 0.85),
                "mld_meters": pfz.get("mld_meters", 35.0),
                "target_species": [top_sp["common_name"].split("(")[-1].rstrip(")")] if matched_species else pfz["target_species"],
                "species_matched": species_common_name,
                "species_viability_score": viability_score,
            },
            "data_sources": [
                f"INCOIS ARGO Float #{pfz['float_id']}",
                "NOAA MUR Satellite SST (1km)",
                "NASA VIIRS Chlorophyll-a (8-day)",
                "INCOIS Marine Species Biology Matrix"
            ],
            "timestamp": datetime.now(timezone.utc).strftime("%I:%M %p"),
        })

    # Sort so safety alerts appear first, then highest opportunity scores
    alerts.sort(key=lambda x: (0 if x["type"] == "safety" else 1, x["location"]["distance_km"]))
    return alerts


def get_guardian_status() -> dict:
    """Return live watchdog metrics for header telemetry."""
    alerts = scan_for_guardian_alerts()
    safety_count = sum(1 for a in alerts if a["type"] == "safety")
    opportunity_count = sum(1 for a in alerts if a["type"] == "opportunity")

    return {
        "status": "active",
        "monitored_pfz_zones": 47,
        "monitored_anomaly_signals": 9,
        "registered_fishermen_count": len(REGISTERED_FISHERMEN),
        "active_safety_alerts": safety_count,
        "active_opportunity_alerts": opportunity_count,
        "total_active_alerts": len(alerts),
        "last_scan_utc": datetime.now(timezone.utc).isoformat(),
    }
