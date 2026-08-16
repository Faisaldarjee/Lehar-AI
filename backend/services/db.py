"""
Lehar AI Backend — Database Service
SQLite database for Argo ocean float profiles.
Read-only query execution for safety.
"""

import sqlite3
import os
import re
from contextlib import contextmanager
from typing import Any

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "argo_indian_ocean.db")


def get_db_path() -> str:
    """Get absolute path to the SQLite database file."""
    return os.path.abspath(DB_PATH)


@contextmanager
def get_connection():
    """Context manager for SQLite connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database schema if tables don't exist."""
    os.makedirs(os.path.dirname(get_db_path()), exist_ok=True)

    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS argo_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                float_id TEXT NOT NULL,
                cycle_number INTEGER,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                date TEXT NOT NULL,
                max_depth REAL,
                num_levels INTEGER,
                source TEXT DEFAULT 'argovis'
            );

            CREATE TABLE IF NOT EXISTS argo_measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES argo_profiles(id),
                pressure REAL,
                depth REAL,
                temperature REAL,
                salinity REAL
            );

            CREATE TABLE IF NOT EXISTS anomaly_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                float_id TEXT,
                latitude REAL,
                longitude REAL,
                date TEXT,
                parameter TEXT,
                value REAL,
                threshold REAL,
                severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
                description TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_profiles_float_id ON argo_profiles(float_id);
            CREATE INDEX IF NOT EXISTS idx_profiles_location ON argo_profiles(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_profiles_date ON argo_profiles(date);
            CREATE INDEX IF NOT EXISTS idx_measurements_profile ON argo_measurements(profile_id);
            CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomaly_alerts(date);
        """)
        conn.commit()
    print(f"[DB] Database initialized at {get_db_path()}")


def execute_readonly_sql(sql: str) -> list[dict[str, Any]]:
    """
    Execute a READ-ONLY SQL query against the Argo database.
    Rejects any non-SELECT statements for safety.
    """
    # Security: accept exactly one constrained SELECT statement.
    normalized = sql.strip().upper()
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX"]
    if "--" in sql or "/*" in sql or ";" in sql.rstrip(";"):
        raise ValueError("Only one plain SELECT statement is allowed.")
    for keyword in forbidden:
        if re.search(rf"\b{keyword}\b", normalized):
            raise ValueError(f"Forbidden SQL operation: {keyword}. Only SELECT queries are allowed.")

    if not normalized.startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")

    allowed_tables = {"ARGO_PROFILES", "ARGO_MEASUREMENTS", "ANOMALY_ALERTS"}
    referenced_tables = re.findall(r"\b(?:FROM|JOIN)\s+([A-Z_]+)", normalized)
    if not referenced_tables or any(table not in allowed_tables for table in referenced_tables):
        raise ValueError("The query references a table outside the approved Argo schema.")

    limit_match = re.search(r"\bLIMIT\s+(\d+)", normalized)
    if limit_match and int(limit_match.group(1)) > 200:
        sql = re.sub(r"\bLIMIT\s+\d+", "LIMIT 200", sql, flags=re.IGNORECASE)
    elif not limit_match:
        sql = f"{sql.rstrip(';')} LIMIT 200"

    with get_connection() as conn:
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]


def get_profile_count() -> int:
    """Get total number of profiles in database."""
    with get_connection() as conn:
        cursor = conn.execute("SELECT COUNT(*) as count FROM argo_profiles")
        return cursor.fetchone()["count"]


def get_unique_float_count() -> int:
    """Get number of unique floats."""
    with get_connection() as conn:
        cursor = conn.execute("SELECT COUNT(DISTINCT float_id) as count FROM argo_profiles")
        return cursor.fetchone()["count"]


def get_float_positions() -> list[dict]:
    """Get latest position of each float."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT id AS profile_id, float_id, latitude, longitude, date, max_depth
            FROM argo_profiles
            WHERE id IN (
                SELECT MAX(id) FROM argo_profiles GROUP BY float_id
            )
            ORDER BY date DESC
        """)
        return [dict(row) for row in cursor.fetchall()]


def get_float_trajectory(float_id: str) -> list[dict]:
    """Get all positions for a specific float (trajectory)."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT latitude, longitude, date, cycle_number, max_depth FROM argo_profiles WHERE float_id = ? ORDER BY date",
            (float_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_depth_profile(profile_id: int) -> list[dict]:
    """Get depth measurements for a specific profile."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT depth, pressure, temperature, salinity FROM argo_measurements WHERE profile_id = ? ORDER BY depth",
            (profile_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_profiles_near(lat: float, lon: float, radius_deg: float = 2.0, limit: int = 50) -> list[dict]:
    """Get profiles near a lat/lon point within radius (in degrees)."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT id, float_id, latitude, longitude, date, max_depth, num_levels
            FROM argo_profiles
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            ORDER BY date DESC
            LIMIT ?
        """, (lat - radius_deg, lat + radius_deg, lon - radius_deg, lon + radius_deg, limit))
        return [dict(row) for row in cursor.fetchall()]


def get_anomalies(limit: int = 20) -> list[dict]:
    """Get latest anomaly alerts."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM anomaly_alerts ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_db_schema_text() -> str:
    """Return a text description of the database schema for LLM context."""
    return """
DATABASE SCHEMA (SQLite):

Table: argo_profiles
  - id (INTEGER, PRIMARY KEY)
  - float_id (TEXT) — unique identifier for the Argo float
  - cycle_number (INTEGER) — measurement cycle number
  - latitude (REAL) — latitude in decimal degrees (-90 to 90)
  - longitude (REAL) — longitude in decimal degrees (-180 to 180)
  - date (TEXT) — ISO 8601 date string (e.g., '2026-07-15T12:00:00Z')
  - max_depth (REAL) — maximum depth measured in meters
  - num_levels (INTEGER) — number of depth levels measured
  - source (TEXT) — data source, default 'argovis'

Table: argo_measurements
  - id (INTEGER, PRIMARY KEY)
  - profile_id (INTEGER, FK → argo_profiles.id)
  - pressure (REAL) — pressure in decibars
  - depth (REAL) — depth in meters
  - temperature (REAL) — temperature in °C
  - salinity (REAL) — salinity in PSU

Table: anomaly_alerts
  - id (INTEGER, PRIMARY KEY)
  - float_id (TEXT)
  - latitude (REAL)
  - longitude (REAL)
  - date (TEXT)
  - parameter (TEXT) — 'temperature' or 'salinity'
  - value (REAL) — observed value
  - threshold (REAL) — normal threshold
  - severity (TEXT) — 'low', 'medium', 'high', 'critical'
  - description (TEXT)
  - created_at (TEXT)

GEOGRAPHIC CONTEXT:
- Data covers the Indian Ocean region (lat: -30 to 30, lon: 30 to 120)
- Key areas: Arabian Sea, Bay of Bengal, Indian Ocean
- Key Indian cities on coast: Mumbai (19.08°N, 72.88°E), Chennai (13.08°N, 80.27°E),
  Kochi (9.93°N, 76.26°E), Visakhapatnam (17.69°N, 83.22°E), Kolkata (22.57°N, 88.36°E)
"""
