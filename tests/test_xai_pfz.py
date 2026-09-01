"""
Unit & Mathematical Validation Tests for Explainable AI (XAI) PFZ Factor Attribution.
"""

import pytest
from backend.services.pfz_engine import score_pfz_fused, get_pfz_advisories


def test_score_pfz_fused_xai_structure():
    """Verify that score_pfz_fused returns a 3-tuple with detailed XAI attribution."""
    rating, score, xai = score_pfz_fused(
        argo_sst=28.4,
        mld=35.0,
        sat_sst=28.2,
        chlorophyll=1.2,
        chl_gradient=0.09
    )
    
    assert rating in ["Excellent", "Good", "Fair", "Poor"]
    assert 0 <= score <= 100
    assert isinstance(xai, dict)
    
    # Check required XAI keys
    assert "sst_score" in xai
    assert "mld_score" in xai
    assert "chlorophyll_score" in xai
    assert "sst_contribution_pct" in xai
    assert "mld_contribution_pct" in xai
    assert "chlorophyll_contribution_pct" in xai
    assert "total_score" in xai
    assert "reasons" in xai
    
    # Sum of component scores equals total score
    assert xai["sst_score"] + xai["mld_score"] + xai["chlorophyll_score"] == score
    assert 0 <= xai["sst_contribution_pct"] <= 100
    assert 0 <= xai["mld_contribution_pct"] <= 100
    assert 0 <= xai["chlorophyll_contribution_pct"] <= 100
    assert len(xai["reasons"]) > 0


def test_score_pfz_fused_xai_optimal_conditions():
    """Verify max scores for perfectly aligned pelagic environmental conditions."""
    rating, score, xai = score_pfz_fused(
        argo_sst=27.5,
        mld=30.0,
        sat_sst=27.5,
        chlorophyll=1.0,
        chl_gradient=0.10
    )
    
    assert rating == "Excellent"
    assert score == 100
    assert xai["sst_score"] == 35
    assert xai["mld_score"] == 35
    assert xai["chlorophyll_score"] == 30
    assert xai["sst_contribution_pct"] == 100.0
    assert xai["mld_contribution_pct"] == 100.0
    assert xai["chlorophyll_contribution_pct"] == 100.0


def test_get_pfz_advisories_attaches_xai():
    """Verify that get_pfz_advisories attaches valid XAI factor breakdown to each advisory."""
    advisories = get_pfz_advisories("arabian_sea", limit=10)
    assert len(advisories) > 0
    for adv in advisories:
        assert "xai_attribution" in adv
        assert "total_score" in adv["xai_attribution"]
        assert adv["xai_attribution"]["total_score"] == adv["pfz_score"]


def test_compute_pfz_score_xai_breakdown():
    """Verify compute_pfz_score full 4-factor XAI breakdown matching Claude's engine."""
    from backend.services.pfz_engine import compute_pfz_score
    result = compute_pfz_score(lat=18.915, lon=72.828, species_name="Yellowfin Tuna")
    d = result.to_dict()
    
    assert "composite_score" in d
    assert "classification" in d
    assert "xai_breakdown" in d
    assert len(d["xai_breakdown"]) == 4
    
    factors = [f["factor"] for f in d["xai_breakdown"]]
    assert "SST Thermal Front" in factors
    assert "Chlorophyll-a Bloom" in factors
    assert "Thermocline Depth" in factors
    assert "Catch Validation" in factors
    
    for f in d["xai_breakdown"]:
        assert "score" in f
        assert "weight_pct" in f
        assert "contribution_pct" in f
        assert "why" in f
        assert len(f["why"]) > 0

