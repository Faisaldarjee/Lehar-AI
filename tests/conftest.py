"""
Pytest Fixtures and Environment Configuration for Lehar AI Test Suite.
"""

import sys
from pathlib import Path
import pytest

# Ensure root workspace is on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.services.db import init_db, get_connection

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database schema is initialized before running tests."""
    init_db()
    with get_connection() as conn:
        profile_count = conn.execute("SELECT COUNT(*) FROM argo_profiles").fetchone()[0]
        assert profile_count > 0, "Test database must contain ingested Argo profiles"
    yield
