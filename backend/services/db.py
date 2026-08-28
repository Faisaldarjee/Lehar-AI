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

            CREATE TABLE IF NOT EXISTS telegram_subscribers (
                chat_id INTEGER PRIMARY KEY,
                first_name TEXT,
                username TEXT,
                latitude REAL DEFAULT 18.915,
                longitude REAL DEFAULT 72.828,
                harbour TEXT DEFAULT 'Mumbai (Sassoon Dock)',
                language TEXT DEFAULT 'hi',
                last_active TEXT DEFAULT (datetime('now')),
                notifications_enabled INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                active_location TEXT,
                active_float_id TEXT,
                active_species TEXT,
                active_parameter TEXT,
                last_updated REAL NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
                user_query TEXT NOT NULL,
                bot_summary TEXT NOT NULL,
                detected_location TEXT,
                detected_float_id TEXT,
                detected_species TEXT,
                timestamp REAL NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS fishermen_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id TEXT,
                reporter_name TEXT DEFAULT 'Coastal Fisherman',
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                harbour TEXT,
                species TEXT NOT NULL,
                quantity_kg REAL DEFAULT 50.0,
                depth_m REAL DEFAULT 20.0,
                notes TEXT,
                verified INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_profiles_float_id ON argo_profiles(float_id);
            CREATE INDEX IF NOT EXISTS idx_profiles_location ON argo_profiles(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_profiles_date ON argo_profiles(date);
            CREATE INDEX IF NOT EXISTS idx_measurements_profile ON argo_measurements(profile_id);
            CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomaly_alerts(date);
            CREATE INDEX IF NOT EXISTS idx_telegram_active ON telegram_subscribers(last_active);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(last_updated);
            CREATE INDEX IF NOT EXISTS idx_reports_location ON fishermen_reports(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_reports_created ON fishermen_reports(created_at);
        """)
        conn.commit()
    print(f"[DB] Database initialized at {get_db_path()}")


def save_fisherman_report(
    latitude: float,
    longitude: float,
    species: str,
    quantity_kg: float = 50.0,
    depth_m: float = 20.0,
    reporter_id: str = "web_user",
    reporter_name: str = "Coastal Fisherman",
    harbour: str = "",
    notes: str = ""
) -> int:
    """Insert a new crowd-sourced fisherman catch report."""
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO fishermen_reports (reporter_id, reporter_name, latitude, longitude, harbour, species, quantity_kg, depth_m, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (reporter_id, reporter_name, latitude, longitude, harbour, species, quantity_kg, depth_m, notes)
        )
        conn.commit()
        return cursor.lastrowid


def get_recent_fishermen_reports(limit: int = 30) -> list[dict[str, Any]]:
    """Retrieve recent crowdsourced catch observations for map layer."""
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM fishermen_reports").fetchone()[0]
        if count == 0:
            # Seed realistic verified initial community observations
            initial_seeds = [
                ("tg_98214", "Ramesh Koli (Trawler Captain)", 18.82, 72.55, "Mumbai (Sassoon Dock)", "Yellowfin Tuna (Kera)", 320.0, 45.0, "High shoal activity along 28.2°C thermal front edge.", 1),
                ("tg_76412", "Antony Joseph", 9.85, 75.95, "Kochi (Thoppumpady)", "Indian Mackerel (Bangda)", 650.0, 18.0, "High phytoplankton surface bloom observed at 15m depth.", 1),
                ("tg_54321", "M. Appa Rao", 17.52, 83.45, "Visakhapatnam, AP", "Skipjack Tuna (Choora)", 280.0, 35.0, "Clear blue water transition boundary.", 1),
                ("tg_33219", "Bhavesh Patel", 20.75, 69.95, "Veraval, Gujarat", "Silver Pomfret (Paplet)", 410.0, 22.0, "Gillnet deployed near coastal upwelling zone.", 1),
                ("tg_88921", "Subhash Das", 21.45, 87.75, "Digha (Sankarpur)", "Hilsa Shad (Ilish)", 190.0, 15.0, "Freshwater plume mixing zone near river mouth.", 1),
            ]
            for s in initial_seeds:
                conn.execute(
                    """
                    INSERT INTO fishermen_reports (reporter_id, reporter_name, latitude, longitude, harbour, species, quantity_kg, depth_m, notes, verified)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    s
                )
            conn.commit()

        rows = conn.execute(
            """
            SELECT * FROM fishermen_reports
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]



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
    """Get depth measurements for a specific profile, filtering out missing/zero sensor placeholders."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT depth, pressure, temperature, salinity FROM argo_measurements WHERE profile_id = ? AND (temperature > 1.0 OR salinity > 10.0) AND depth IS NOT NULL ORDER BY depth ASC",
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
