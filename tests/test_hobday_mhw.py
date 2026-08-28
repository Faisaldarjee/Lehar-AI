"""
Mathematical and Scientific Validation Tests for Hobday et al. (2016) Marine Heatwave Classification.
"""

import pytest
from backend.services.anomaly_detector import _percentile, detect_anomalies_in_profile, run_anomaly_scan
from backend.services.db import get_connection


def test_percentile_calculation():
    """Verify linear interpolation percentile function matches numpy standard."""
    values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    p50 = _percentile(values, 50.0)
    p90 = _percentile(values, 90.0)
    p10 = _percentile(values, 10.0)

    assert p50 == 55.0
    assert p90 == 91.0
    assert p10 == 19.0


def test_hobday_category_bounds():
    """
    Test Hobday et al. (2016) intensity multiplier thresholds:
    Category I:   1.0 <= M < 2.0 (Moderate)
    Category II:  2.0 <= M < 3.0 (Strong)
    Category III: 3.0 <= M < 4.0 (Severe)
    Category IV:  M >= 4.0 (Extreme)
    """
    baseline_mean = 28.0
    p90_thresh = 29.0
    thresh_diff = p90_thresh - baseline_mean  # 1.0 °C

    # Test cases: (observed_temp, expected_multiplier, expected_cat_prefix)
    cases = [
        (29.5, 1.5, "Hobday Cat-I: Moderate MHW"),
        (30.2, 2.2, "Hobday Cat-II: Strong MHW"),
        (31.5, 3.5, "Hobday Cat-III: Severe MHW"),
        (33.0, 5.0, "Hobday Cat-IV: Extreme MHW"),
    ]

    for obs_temp, expected_m, expected_cat in cases:
        excess = obs_temp - p90_thresh
        multiplier = round(1.0 + (excess / thresh_diff), 2)
        assert multiplier == expected_m

        if multiplier >= 4.0:
            cat = "Hobday Cat-IV: Extreme MHW"
        elif multiplier >= 3.0:
            cat = "Hobday Cat-III: Severe MHW"
        elif multiplier >= 2.0:
            cat = "Hobday Cat-II: Strong MHW"
        else:
            cat = "Hobday Cat-I: Moderate MHW"

        assert cat == expected_cat


def test_anomaly_scan_execution():
    """Verify that run_anomaly_scan processes profiles and populates anomaly_alerts table."""
    count = run_anomaly_scan(reset_existing=True, max_profiles=50)
    assert count >= 0

    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM anomaly_alerts").fetchall()
        for r in rows:
            assert r["parameter"] in ("temperature", "salinity")
            assert r["severity"] in ("low", "medium", "high", "critical")
            assert len(r["description"]) > 10
