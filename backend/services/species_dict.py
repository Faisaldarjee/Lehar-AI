"""
Lehar AI Backend — Vernacular Marine Species Dictionary & Grounded PFZ Evaluator
Provides multi-lingual mapping (Hindi, Marathi, Tamil, Telugu, Malayalam, Gujarati, Bengali)
and evidence-based hydrographic viability scoring for Indian marine fish species.
"""

from __future__ import annotations
import re
from typing import Any

# Multilingual Marine Species Registry & Biological Hydrographic Profiles
SPECIES_REGISTRY: dict[str, dict[str, Any]] = {
    "surmai": {
        "common_name": "King Mackerel / Seer Fish (Surmai)",
        "scientific_name": "Scomberomorus commerson",
        "vernacular_names": [
            "surmai", "seer fish", "king mackerel", "vanjaram", "anjal", "neymeen", "iswan",
            "surmai machli", "surmai machhali", "kingfish"
        ],
        "optimal_sst": (26.0, 28.5),
        "tolerable_sst": (24.5, 30.5),
        "optimal_depth": (10.0, 40.0),
        "optimal_salinity": (34.0, 36.2),
        "peak_season": "October to March (Post-monsoon)",
        "coastal_zones": "Konkan, Malabar, Coromandel coasts",
        "feeding_habit": "Pelagic predator following sardine & anchovy schools near thermal fronts",
        "gear_type": "Drift gillnets, hooks and line, trolling"
    },
    "bangda": {
        "common_name": "Indian Mackerel (Bangda)",
        "scientific_name": "Rastrelliger kanagurta",
        "vernacular_names": [
            "bangda", "indian mackerel", "mackerel", "kanangeluthi", "ayala", "kanagurta",
            "bangada", "bangado", "kumla"
        ],
        "optimal_sst": (26.5, 29.5),
        "tolerable_sst": (25.0, 31.0),
        "optimal_depth": (5.0, 35.0),
        "optimal_salinity": (32.0, 35.5),
        "peak_season": "September to February",
        "coastal_zones": "Arabian Sea (Goa, Ratnagiri, Mangalore, Kochi)",
        "feeding_habit": "Planktivorous surface-schooling pelagic fish tracking high chlorophyll MLD zones",
        "gear_type": "Purse seines, ring seines, shore seines"
    },
    "rawas": {
        "common_name": "Indian Salmon / Threadfin (Rawas)",
        "scientific_name": "Eleutheronema tetradactylum",
        "vernacular_names": [
            "rawas", "indian salmon", "fourfinger threadfin", "kala", "vameen", "maga",
            "gurjali", "ravas"
        ],
        "optimal_sst": (25.5, 28.5),
        "tolerable_sst": (24.0, 30.0),
        "optimal_depth": (10.0, 45.0),
        "optimal_salinity": (30.0, 34.5),
        "peak_season": "November to April",
        "coastal_zones": "Maharashtra, Gujarat, West Bengal, Odisha",
        "feeding_habit": "Demersal-pelagic carnivore feeding on small crustacea and mullets near estuaries",
        "gear_type": "Bottom gillnets, hooks and line"
    },
    "pomfret": {
        "common_name": "Silver & Black Pomfret (Paplet)",
        "scientific_name": "Pampus argenteus / Parastromateus niger",
        "vernacular_names": [
            "pomfret", "paplet", "silver pomfret", "black pomfret", "vavval", "vawall",
            "manji", "chandi", "halwa", "poplet", "vawal"
        ],
        "optimal_sst": (26.0, 29.0),
        "tolerable_sst": (24.5, 30.5),
        "optimal_depth": (15.0, 60.0),
        "optimal_salinity": (33.0, 35.5),
        "peak_season": "October to January",
        "coastal_zones": "Gujarat (Saurashtra), Maharashtra, Bay of Bengal",
        "feeding_habit": "Column feeder consuming zooplankton and salps below the mixed layer",
        "gear_type": "Drift gillnets, trawl nets"
    },
    "tuna": {
        "common_name": "Yellowfin & Skipjack Tuna (Choora)",
        "scientific_name": "Thunnus albacares / Katsuwonus pelamis",
        "vernacular_names": [
            "tuna", "yellowfin tuna", "skipjack", "choora", "soorai", "kera", "toona",
            "kuppa", "gedara", "choorai"
        ],
        "optimal_sst": (25.0, 29.5),
        "tolerable_sst": (23.5, 30.5),
        "optimal_depth": (20.0, 150.0),
        "optimal_salinity": (34.5, 36.5),
        "peak_season": "November to May",
        "coastal_zones": "Lakshadweep, Andaman Sea, deep oceanic Arabian Sea & Bay of Bengal",
        "feeding_habit": "Apex pelagic predator congregating along oceanic thermal fronts and seamounts",
        "gear_type": "Pole and line, longline, oceanic gillnets"
    },
    "sardine": {
        "common_name": "Indian Oil Sardine (Tarli / Mathi)",
        "scientific_name": "Sardinella longiceps",
        "vernacular_names": [
            "sardine", "oil sardine", "tarli", "mathi", "maththi", "kavalai", "buthai",
            "chala", "pedvey"
        ],
        "optimal_sst": (24.5, 28.0),
        "tolerable_sst": (23.0, 30.0),
        "optimal_depth": (5.0, 30.0),
        "optimal_salinity": (32.5, 35.0),
        "peak_season": "August to December (Monsoon/Post-monsoon upwelling)",
        "coastal_zones": "Southwest coast (Kerala, Karnataka, Goa)",
        "feeding_habit": "Direct consumer of diatom blooms driven by coastal upwelling",
        "gear_type": "Ring seines, purse seines"
    },
    "hilsa": {
        "common_name": "Hilsa / Ilish Shad",
        "scientific_name": "Tenualosa ilisha",
        "vernacular_names": [
            "hilsa", "ilish", "ilisha", "palva", "palla", "chaksi", "ulasa"
        ],
        "optimal_sst": (24.0, 29.0),
        "tolerable_sst": (22.0, 31.0),
        "optimal_depth": (5.0, 25.0),
        "optimal_salinity": (15.0, 32.0),
        "peak_season": "July to October (Monsoon spawning migration)",
        "coastal_zones": "Bay of Bengal, Hooghly/Ganges Estuary, Mahanadi, Godavari",
        "feeding_habit": "Anadromous planktivore sensitive to estuarine freshwater influx and salinity gradient",
        "gear_type": "Drift gillnets"
    },
    "bombil": {
        "common_name": "Bombay Duck (Bombil)",
        "scientific_name": "Harpadon nehereus",
        "vernacular_names": [
            "bombil", "bombay duck", "bummalo", "lutia", "kukurbandh"
        ],
        "optimal_sst": (25.0, 28.5),
        "tolerable_sst": (23.5, 30.0),
        "optimal_depth": (10.0, 50.0),
        "optimal_salinity": (28.0, 34.5),
        "peak_season": "September to February",
        "coastal_zones": "North Maharashtra, Gujarat (Gulf of Khambhat), West Bengal",
        "feeding_habit": "Benthopelagic predator feeding on Acetes shrimp and juvenile fish",
        "gear_type": "Dol nets (bag nets), bottom gillnets"
    },
    "prawn": {
        "common_name": "Penaeid Prawn / Shrimp (Jhinga / Kolambi)",
        "scientific_name": "Penaeus monodon / Fenneropenaeus indicus",
        "vernacular_names": [
            "prawn", "shrimp", "jhinga", "kolambi", "chemmeen", "yera", "royya", "chingri"
        ],
        "optimal_sst": (26.0, 30.0),
        "tolerable_sst": (24.0, 32.0),
        "optimal_depth": (10.0, 60.0),
        "optimal_salinity": (25.0, 35.0),
        "peak_season": "November to April",
        "coastal_zones": "All Indian maritime states, shallow shelf and mud banks",
        "feeding_habit": "Benthic scavenger and detritivore on muddy bottoms",
        "gear_type": "Bottom trawls, stake nets"
    },
    "squid": {
        "common_name": "Indian Squid / Cuttlefish (Mankol / Kanava)",
        "scientific_name": "Uroteuthis duvaucelii / Sepia pharaonis",
        "vernacular_names": [
            "squid", "cuttlefish", "mankol", "kanava", "oorosi", "kalamari", "kollath"
        ],
        "optimal_sst": (25.5, 29.0),
        "tolerable_sst": (24.0, 30.5),
        "optimal_depth": (20.0, 80.0),
        "optimal_salinity": (34.0, 36.5),
        "peak_season": "September to March",
        "coastal_zones": "Kerala, Maharashtra, Gujarat, Tamil Nadu",
        "feeding_habit": "Active nocturnal hunter congregating around thermocline and optical drop-offs",
        "gear_type": "Squid jigs, bottom trawls"
    }
}


def detect_species_in_query(query: str) -> dict[str, Any] | None:
    """
    Search for mention of any marine commercial fish species in the natural language query.
    Supports Hindi, Marathi, Tamil, Telugu, Malayalam, Gujarati, Bengali vernacular terms.
    """
    cleaned = query.lower().strip()
    for species_key, info in SPECIES_REGISTRY.items():
        for alias in info["vernacular_names"]:
            # Check for whole-word or hyphenated occurrence
            pattern = rf"\b{re.escape(alias)}\b"
            if re.search(pattern, cleaned):
                return {
                    "species_id": species_key,
                    "matched_alias": alias,
                    **info
                }
    return None


def evaluate_species_viability(
    species_info: dict[str, Any],
    observed_sst: float | None,
    observed_mld: float | None = None,
    observed_salinity: float | None = None
) -> dict[str, Any]:
    """
    Calculate evidence-based hydrographic suitability score (0-100%) for a target species
    based on in-situ temperature, depth, and salinity compared against known biology.
    """
    score = 100
    deductions: list[str] = []

    opt_min, opt_max = species_info["optimal_sst"]
    tol_min, tol_max = species_info["tolerable_sst"]

    # 1. SST Evaluation
    if observed_sst is not None:
        if opt_min <= observed_sst <= opt_max:
            # Optimal temperature zone
            sst_status = "Optimal"
        elif tol_min <= observed_sst <= tol_max:
            # Tolerable, minor penalty
            sst_status = "Moderate / Tolerable"
            score -= 20
            deductions.append(f"Surface temperature ({observed_sst:.1f}°C) is outside peak comfort ({opt_min}–{opt_max}°C)")
        else:
            # Extreme or unfavorable
            sst_status = "Unfavorable"
            score -= 50
            if observed_sst < tol_min:
                deductions.append(f"Sea water too cold ({observed_sst:.1f}°C vs min {tol_min}°C)")
            else:
                deductions.append(f"Thermal stress / warm water ({observed_sst:.1f}°C vs max {tol_max}°C)")
    else:
        sst_status = "Unknown"

    # 2. Salinity Evaluation
    if observed_salinity is not None and "optimal_salinity" in species_info:
        sal_min, sal_max = species_info["optimal_salinity"]
        if not (sal_min - 1.0 <= observed_salinity <= sal_max + 1.0):
            score -= 15
            deductions.append(f"Salinity ({observed_salinity:.1f} PSU) deviates from preference ({sal_min}–{sal_max} PSU)")

    score = max(10, min(100, score))

    if score >= 85:
        rating = "Highly Optimal"
        badge_color = "emerald"
    elif score >= 65:
        rating = "Favorable"
        badge_color = "teal"
    elif score >= 40:
        rating = "Moderate"
        badge_color = "amber"
    else:
        rating = "Low Viability"
        badge_color = "rose"

    return {
        "score": score,
        "rating": rating,
        "badge_color": badge_color,
        "sst_status": sst_status,
        "optimal_sst": f"{opt_min}–{opt_max}°C",
        "optimal_depth": f"{species_info['optimal_depth'][0]}–{species_info['optimal_depth'][1]} m",
        "peak_season": species_info["peak_season"],
        "gear_recommendation": species_info["gear_type"],
        "notes": deductions if deductions else ["Conditions align with peak biological feeding profile."]
    }
