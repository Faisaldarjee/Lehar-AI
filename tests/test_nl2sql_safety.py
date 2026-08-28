"""
Safety and Guardrail Validation Tests for Read-Only SQL Engine.
"""

import pytest
from backend.services.db import execute_readonly_sql
from backend.services.nl2sql import generate_sql, clean_llm_response


def test_sql_injection_defense():
    """Verify that DROP, DELETE, INSERT, UPDATE, ALTER, and PRAGMA commands are strictly blocked."""
    forbidden_queries = [
        "DROP TABLE argo_profiles",
        "DELETE FROM argo_measurements",
        "INSERT INTO argo_profiles (float_id) VALUES ('12345')",
        "UPDATE argo_profiles SET latitude = 0",
        "ALTER TABLE argo_profiles ADD COLUMN hack TEXT",
        "ATTACH DATABASE 'hack.db' AS hack",
        "PRAGMA table_info(argo_profiles)"
    ]

    for fq in forbidden_queries:
        with pytest.raises(ValueError) as excinfo:
            execute_readonly_sql(fq)
        assert "Forbidden SQL statement" in str(excinfo.value) or "Only SELECT" in str(excinfo.value)


def test_table_whitelist_defense():
    """Verify queries cannot read arbitrary non-whitelisted sqlite tables or system schemas."""
    unauthorized_queries = [
        "SELECT * FROM sqlite_master",
        "SELECT * FROM users",
        "SELECT * FROM passwords",
        "SELECT * FROM secret_table"
    ]

    for uq in unauthorized_queries:
        with pytest.raises(ValueError) as excinfo:
            execute_readonly_sql(uq)
        err_msg = str(excinfo.value)
        assert "outside the approved Argo schema" in err_msg or "Forbidden" in err_msg or "Only SELECT" in err_msg


def test_safe_read_only_execution():
    """Verify safe SELECT query runs and returns rows."""
    safe_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude FROM argo_profiles p LIMIT 5"
    results = execute_readonly_sql(safe_sql)
    assert isinstance(results, list)
    assert len(results) > 0
    assert "float_id" in results[0]


def test_clean_llm_response():
    """Verify SQL cleaners strip markdown fences, backticks, and thinking tokens."""
    raw = "<think>Generating SQL</think>```sql\nSELECT * FROM argo_profiles LIMIT 10;\n```"
    cleaned = clean_llm_response(raw)
    assert "<think>" not in cleaned
    assert "```" not in cleaned
    assert cleaned.startswith("SELECT")
