"""
Mathematical & Biological Validation Tests for PFZ Multi-Sensor Advisory Engine.
"""

import pytest
from backend.services.pfz_engine import (
    haversine_km,
    bearing_degrees,
    bearing_to_compass,
    compute_mld,
    compute_thermocline_gradient,
    evaluate_species_profile_viability,
    calculate_voyage_economics,
    nearest_harbour
)
from backend.services.db import get_connection


def test_haversine_and_bearing():
    """Verify great-circle distance and bearing calculations."""
    # Mumbai to Goa (~410 km South-Southeast)
    dist = haversine_km(18.91, 72.83, 15.50, 73.81)
    brg = bearing_degrees(18.91, 72.83, 15.50, 73.81)
    compass = bearing_to_compass(brg)

    assert 380.0 <= dist <= 430.0
    assert 150.0 <= brg <= 180.0
    assert compass in ("SSE", "S", "SE")


def test_nearest_harbour_lookup():
    """Verify harbor lookup returns closest coastal port."""
    harbour = nearest_harbour(18.95, 72.80)
    assert "Mumbai" in harbour["harbour"] or "Maharashtra" in harbour["harbour"]
    assert harbour["distance_km"] < 25.0


def test_mld_and_thermocline_gradient():
    """Verify MLD and thermocline peak calculus against real ARGO cast in DB."""
    with get_connection() as conn:
        profile = conn.execute("SELECT id FROM argo_profiles ORDER BY id ASC LIMIT 1").fetchone()
        assert profile is not None

        pid = profile["id"]
        mld = compute_mld(pid)
        therm = compute_thermocline_gradient(pid)

        # Physical oceanographic ranges for Indian Ocean
        assert mld is not None
        assert 5.0 <= mld <= 250.0
        assert 10.0 <= therm["thermocline_depth_m"] <= 500.0
        assert therm["max_gradient_c_per_m"] >= 0.0


def test_species_biological_viability():
    """Verify ICAR-CMFRI species temperature-depth-salinity viability scoring."""
    # Optimal conditions for Yellowfin Tuna (SST 28°C, MLD 40m, Thermocline 65m, Salinity 35.5 PSU)
    tuna_good = evaluate_species_profile_viability("yellowfin_tuna", sst=28.0, mld=40.0, thermocline_depth=65.0, salinity=35.5)
    assert tuna_good["viability_pct"] >= 75
    assert "HIGH POTENTIAL" in tuna_good["status"].upper() or "OPTIMAL" in tuna_good["status"].upper()

    # Incompatible conditions for Yellowfin Tuna (SST 15°C cold water)
    tuna_bad = evaluate_species_profile_viability("yellowfin_tuna", sst=15.0, mld=10.0, thermocline_depth=200.0, salinity=30.0)
    assert tuna_bad["viability_pct"] < 50


def test_voyage_economics():
    """Verify fuel consumption, carbon offset, and financial savings calculus."""
    econ = calculate_voyage_economics(distance_km=100.0)
    assert econ["distance_nm"] == 54.0
    assert econ["estimated_fuel_burn_l"] > 0
    assert econ["financial_saved_inr"] > 0
    assert econ["co2_reduction_kg"] > 0
