"""
Unit tests for Crowdsourced Fisherman Catch Reporting & SQLite Persistence.
"""

import pytest
from backend.services.db import (
    init_db,
    save_fisherman_report,
    get_recent_fishermen_reports,
    get_connection,
)


def test_save_and_retrieve_fisherman_report():
    """Verify that a fisherman catch report persists in SQLite and can be retrieved."""
    init_db()
    
    report_id = save_fisherman_report(
        latitude=18.91,
        longitude=72.82,
        species="Yellowfin Tuna",
        quantity_kg=350.0,
        depth_m=40.0,
        reporter_id="tg_12345",
        reporter_name="Captain Koli",
        harbour="Mumbai (Sassoon Dock)",
        notes="High surface feeding near thermal front"
    )
    
    assert report_id > 0
    
    reports = get_recent_fishermen_reports(limit=10)
    assert len(reports) > 0
    
    latest = reports[0]
    assert latest["id"] == report_id
    assert latest["species"] == "Yellowfin Tuna"
    assert latest["quantity_kg"] == 350.0
    assert latest["depth_m"] == 40.0
    assert latest["reporter_name"] == "Captain Koli"
