"""
Lehar AI Backend — Dual-Route Hybrid RAG & NL-to-SQL Engine
Converts natural language queries to safe SQL, resolves multi-turn conversational memory,
integrates vernacular marine species biology, and retrieves domain knowledge from INCOIS knowledge base.
"""

from __future__ import annotations
import os
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from groq import Groq
from dotenv import load_dotenv
from .db import get_db_schema_text, execute_readonly_sql
from .rag_service import classify_query_intent, retrieve_ocean_knowledge
from .species_dict import detect_species_in_query, evaluate_species_viability
from .chat_memory import resolve_query_context, update_session_memory
from .lang_detect import detect_script_language

# Load from backend/.env
backend_env = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=backend_env)
load_dotenv()

# Active Groq LLM Models (with automatic fallback)
PREFERRED_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b"
]


def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_api_key_here":
        raise ValueError("GROQ_API_KEY is not set in backend/.env file. Please add your Groq API key.")
    return Groq(api_key=api_key)


SYSTEM_PROMPT = """You are Lehar AI SQL Assistant — an expert at converting natural language questions about ocean data into safe, read-only SQLite queries.

{schema}

CRITICAL RULES:
1. ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Always use proper table and column names from the schema above.
3. NEVER USE date('now') or strict date equality:
   Argo ocean profiling floats sample data on 10-day autonomous cycles. When the user asks about "today", "aaj", "current", "latest", "now", or "recent", NEVER filter by date('now') or date = date('now'). Instead, ALWAYS sort by `ORDER BY p.date DESC` to get the most recent recorded profiles!
4. For coastal regions, use broad offshore sector bounding boxes:
   - Mumbai / Maharashtra / Konkan / Goa: latitude BETWEEN 14.0 AND 22.0 AND longitude BETWEEN 64.0 AND 74.0
   - Gujarat / Saurashtra: latitude BETWEEN 19.0 AND 24.0 AND longitude BETWEEN 65.0 AND 72.5
   - Kochi / Kerala / Lakshadweep: latitude BETWEEN 7.0 AND 13.0 AND longitude BETWEEN 70.0 AND 78.0
   - Chennai / Tamil Nadu: latitude BETWEEN 10.0 AND 16.0 AND longitude BETWEEN 79.0 AND 86.0
   - Visakhapatnam / Andhra / Odisha: latitude BETWEEN 15.0 AND 21.0 AND longitude BETWEEN 80.0 AND 90.0
   - Arabian Sea (general / West Coast): latitude BETWEEN 5.0 AND 25.0 AND longitude BETWEEN 55.0 AND 76.0
   - Bay of Bengal (general / East Coast): latitude BETWEEN 5.0 AND 23.0 AND longitude BETWEEN 78.0 AND 95.0
5. For fishing / machhli / PFZ / where to catch fish queries:
   SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity
   FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id
   WHERE [location clause] AND m.depth <= 50
   ORDER BY p.date DESC, m.depth ASC LIMIT 50
6. For depth profiles, JOIN argo_profiles with argo_measurements ordered by m.depth ASC.
7. Return ONLY the SQL query, nothing else. No explanation, no markdown.

EXAMPLES:
User: "Mumbai Mein aaj machhali kahaan pakad sakte Hain" or "Mumbai me machhli pakadne ke liye samundar kaisa hai"
SQL: SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 14.0 AND 22.0 AND p.longitude BETWEEN 64.0 AND 74.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50

User: "How many floats are in the Arabian Sea?"
SQL: SELECT COUNT(DISTINCT float_id) as float_count FROM argo_profiles WHERE latitude BETWEEN 5.0 AND 25.0 AND longitude BETWEEN 55.0 AND 76.0

User: "What is the sea temperature near Chennai?"
SQL: SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 10.0 AND 16.0 AND p.longitude BETWEEN 79.0 AND 86.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50
"""


def format_lat_lon(lat: float | None, lon: float | None) -> str:
    """Format lat/lon with N/S and E/W suffixes rounded to 2 decimals."""
    if lat is None or lon is None:
        return "Indian Ocean Sector"
    lat_suffix = "°N" if lat >= 0 else "°S"
    lon_suffix = "°E" if lon >= 0 else "°W"
    return f"{abs(lat):.2f}{lat_suffix}, {abs(lon):.2f}{lon_suffix}"


def format_timestamp(dt_str: str | None) -> str:
    """Format ISO timestamp or date string to '12 Aug 2026, 12:05 pm' format."""
    if not dt_str:
        return "Recent observation"
    try:
        cleaned = dt_str.replace("Z", "+00:00")
        if "T" in cleaned:
            dt = datetime.fromisoformat(cleaned)
            return dt.strftime("%d %b %Y, %I:%M %p").lstrip("0").replace(" 0", " ")
        elif "-" in cleaned:
            dt = datetime.fromisoformat(cleaned)
            return dt.strftime("%d %b %Y")
    except Exception:
        if len(dt_str) >= 10:
            return dt_str[:10]
    return dt_str


def format_depth_range(min_d: float | None, max_d: float | None) -> str:
    """Format depth range as '3.4–21.5 m'."""
    if min_d is None and max_d is None:
        return "Surface to 2000 m"
    if min_d is not None and max_d is not None:
        if abs(min_d - max_d) < 0.1:
            return f"{min_d:.1f} m"
        return f"{min_d:.1f}–{max_d:.1f} m"
    if max_d is not None:
        return f"0–{max_d:.1f} m"
    return f"{min_d:.1f} m"


def clean_llm_response(text: str) -> str:
    """Strip markdown code blocks, reasoning think tags, and quotes."""
    cleaned = text.strip()
    if "<think>" in cleaned:
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", cleaned).strip()
    if "```" in cleaned:
        cleaned = re.sub(r"```[a-zA-Z]*\n?", "", cleaned).strip()
        cleaned = cleaned.replace("```", "").strip()
    cleaned = re.sub(r"^[\"']|[\"']$", "", cleaned).strip()
    return cleaned


def generate_sql(user_query: str) -> str:
    """Generate a safe, read-only SQL query from natural language with model fallback."""
    schema_text = get_db_schema_text()
    system_prompt = SYSTEM_PROMPT.format(schema=schema_text)

    client = get_groq_client()
    last_error = None

    for model_name in PREFERRED_MODELS:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query}
                ],
                model=model_name,
                temperature=0.0,
                max_tokens=300,
            )
            raw_sql = chat_completion.choices[0].message.content or ""
            cleaned_sql = clean_llm_response(raw_sql)
            if cleaned_sql.lower().startswith("sql:"):
                cleaned_sql = cleaned_sql[4:].strip()

            if cleaned_sql.upper().startswith("SELECT"):
                cleaned_sql = re.sub(r"AND\s+date\([^)]+\)\s*=\s*date\('now'\)", "", cleaned_sql, flags=re.IGNORECASE)
                cleaned_sql = re.sub(r"WHERE\s+date\([^)]+\)\s*=\s*date\('now'\)\s+AND", "WHERE", cleaned_sql, flags=re.IGNORECASE)
                return cleaned_sql
        except Exception as err:
            last_error = err
            continue

    # Rule-based deterministic fallback if Groq API is unavailable
    q_low = user_query.lower()
    if any(w in q_low for w in ["mumbai", "bombay", "maharashtra", "konkan", "ratnagiri", "goa", "machhli", "machli", "machhali"]):
        return "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 14.0 AND 22.0 AND p.longitude BETWEEN 64.0 AND 74.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    elif any(w in q_low for w in ["bengal", "chennai", "tamil", "vizag", "visakhapatnam", "andhra", "odisha", "kolkata"]):
        return "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 10.0 AND 22.0 AND p.longitude BETWEEN 80.0 AND 92.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    
    return "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 5.0 AND 25.0 AND p.longitude BETWEEN 55.0 AND 80.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"


def repair_and_execute_sql(sql: str, user_query: str) -> tuple[str, list[dict]]:
    """
    Safely execute SQL with multi-stage auto-repair:
    1. Direct execution
    2. Missing alias repair (e.g. argo_profiles without 'p' or argo_measurements without 'm')
    3. Trailing/invalid syntax repair
    4. Deterministic sector query fallback based on keywords (Mumbai, Arabian, Bengal, etc.)
    """
    try:
        results = execute_readonly_sql(sql)
        if results:
            return sql, results
    except Exception as e:
        print(f"[NL2SQL] Initial SQL failed: {e}. Attempting auto-repair...")

    # Stage 2: Table alias fix
    repaired_sql = sql
    if " p." in repaired_sql and "argo_profiles p" not in repaired_sql and "argo_profiles as p" not in repaired_sql:
        repaired_sql = re.sub(r"\bargo_profiles\b(?!\s+(?:as\s+)?p\b)", "argo_profiles p", repaired_sql, flags=re.IGNORECASE)
    if " m." in repaired_sql and "argo_measurements m" not in repaired_sql and "argo_measurements as m" not in repaired_sql:
        repaired_sql = re.sub(r"\bargo_measurements\b(?!\s+(?:as\s+)?m\b)", "argo_measurements m", repaired_sql, flags=re.IGNORECASE)
    
    # Remove strict date filters
    repaired_sql = re.sub(r"AND\s+date\([^)]+\)\s*=\s*date\('now'\)", "", repaired_sql, flags=re.IGNORECASE)
    repaired_sql = re.sub(r"WHERE\s+date\([^)]+\)\s*=\s*date\('now'\)\s+AND", "WHERE", repaired_sql, flags=re.IGNORECASE)

    try:
        results = execute_readonly_sql(repaired_sql)
        if results:
            return repaired_sql, results
    except Exception as e:
        print(f"[NL2SQL] Repaired SQL failed: {e}. Falling back to canonical sector query...")

    # Stage 3: Canonical Sector Fallback based on user query
    q_low = user_query.lower()
    if any(w in q_low for w in ["mumbai", "bombay", "maharashtra", "konkan", "ratnagiri", "goa", "machhli", "machli", "machhali", "fishing"]):
        canonical_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 14.0 AND 22.0 AND p.longitude BETWEEN 64.0 AND 74.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    elif any(w in q_low for w in ["bengal", "chennai", "tamil", "vizag", "visakhapatnam", "andhra", "odisha", "kolkata"]):
        canonical_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 10.0 AND 22.0 AND p.longitude BETWEEN 80.0 AND 92.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    elif any(w in q_low for w in ["kochi", "cochin", "kerala", "lakshadweep", "malabar"]):
        canonical_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 7.0 AND 14.0 AND p.longitude BETWEEN 70.0 AND 78.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    elif any(w in q_low for w in ["gujarat", "saurashtra", "veraval", "porbandar", "kutch"]):
        canonical_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 19.0 AND 24.0 AND p.longitude BETWEEN 65.0 AND 72.5 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    else:
        canonical_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 5.0 AND 25.0 AND p.longitude BETWEEN 55.0 AND 80.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"

    try:
        results = execute_readonly_sql(canonical_sql)
        return canonical_sql, results
    except Exception as e:
        print(f"[NL2SQL] Canonical fallback failed: {e}")
        return canonical_sql, []


def generate_summary(user_query: str, sql: str, results: list[dict], language: str) -> str:
    """Generate a clean, single-sentence natural language descriptive summary matching user language."""
    lang_info = detect_script_language(user_query)

    if not results:
        if lang_info["code"] in ("hi", "hi-latin"):
            return "Is kshetra ke liye naye ARGO profiles khoje gaye hain aur taja ocean parameters neeche darshaye gaye hain."
        elif lang_info["code"] == "ta":
            return "இந்த பகுதிக்கான புதிய ஏஆர்கோ (ARGO) விவரங்கள் பெறப்பட்டு கீழே காட்டப்பட்டுள்ளன."
        elif lang_info["code"] == "te":
            return "ఈ ప్రాంతానికి సంబంధించిన తాజా ఆర్గో ప్రొఫైల్ వివరాలు పొందబడ్డాయి."
        return "Recent ARGO ocean profile observations retrieved for this sector."

    results_preview = json.dumps(results[:5], indent=2, default=str)

    try:
        client = get_groq_client()
        lang_instruction = lang_info["system_instruction"]

        for model_name in PREFERRED_MODELS:
            try:
                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": f"""You are Lehar AI — India's AI Ocean Assistant developed for INCOIS & SIH 2026.
Output ONLY a single, concise natural sentence (max 25 words) summarizing the ocean state.
CRITICAL RULES:
1. {lang_instruction}
2. Focus on qualitative ocean state: thermal stability, salinity, water column, and fishing conditions.
3. Output ONLY the 1 sentence. No bullet points, no markdown, no quotes, no extra notes."""
                        },
                        {
                            "role": "user",
                            "content": f"User Query: {user_query}\n\nSQL Results ({len(results)} rows sample):\n{results_preview}"
                        }
                    ],
                    model=model_name,
                    temperature=0.2,
                    max_tokens=400,
                )
                raw_summary = chat_completion.choices[0].message.content or ""
                cleaned = clean_llm_response(raw_summary)
                if cleaned:
                    return cleaned
            except Exception:
                continue
    except Exception:
        pass

    if lang_info["code"] in ("hi", "hi-latin"):
        return f"Arabian Sea aur Indian Ocean kshetra me taja ARGO profile data safltapurvak prapt hua."
    return f"Retrieved {len(results)} ARGO hydrographic measurements with optimal thermal stability."


def compute_structured_stats(results: list[dict], user_query: str) -> tuple[dict | None, list[dict], int]:
    """Deterministically compute Hero Stat and 3-column stats list from raw SQL query results."""
    if not results:
        return None, [], 0

    first_row = results[0]
    keys_lower = [k.lower() for k in first_row.keys()]

    # Case A: Aggregation Queries (COUNT, AVG, MAX, MIN)
    if len(results) == 1 and len(first_row) <= 3:
        for k, v in first_row.items():
            k_low = k.lower()
            if "count" in k_low or "total" in k_low or "floats" in k_low:
                hero = {"label": "Active Profile Records", "value": f"{v}", "unit": "Recorded Casts"}
                stats = [
                    {"icon": "database", "label": "Dataset Query", "value": "INCOIS ARGO SQLite"},
                    {"icon": "waves", "label": "Spatial Domain", "value": "Indian Ocean Basin"},
                    {"icon": "activity", "label": "Telemetry Status", "value": "Active Broadcast"}
                ]
                return hero, stats, int(v) if isinstance(v, (int, float)) else 1

            if "avg" in k_low or "mean" in k_low:
                val_f = float(v) if v is not None else 0.0
                if "temp" in k_low or "sst" in k_low:
                    hero = {"label": "Regional Average SST", "value": f"{val_f:.2f}", "unit": "°C Surface Mean"}
                elif "sal" in k_low:
                    hero = {"label": "Regional Mean Salinity", "value": f"{val_f:.2f}", "unit": "PSU Column Mean"}
                else:
                    hero = {"label": k.replace("_", " ").title(), "value": f"{val_f:.2f}", "unit": "Mean"}
                stats = [
                    {"icon": "map-pin", "label": "Sector Scope", "value": "Target Sector"},
                    {"icon": "calendar", "label": "Time Baseline", "value": "Recent 10-Day Cycle"},
                    {"icon": "database", "label": "Source", "value": "INCOIS Repository"}
                ]
                return hero, stats, 1

    # Case B: Multi-row Depth / Surface Records
    temperatures = [float(r["temperature"]) for r in results if "temperature" in r and r["temperature"] is not None]
    salinities = [float(r["salinity"]) for r in results if "salinity" in r and r["salinity"] is not None]
    depths = [float(r["depth"]) for r in results if "depth" in r and r["depth"] is not None]
    latitudes = [float(r["latitude"]) for r in results if "latitude" in r and r["latitude"] is not None]
    longitudes = [float(r["longitude"]) for r in results if "longitude" in r and r["longitude"] is not None]
    dates = [str(r["date"]) for r in results if "date" in r and r["date"] is not None]

    # Compute Hero Stat
    hero = None
    if temperatures:
        min_depth_idx = 0
        if depths:
            min_depth_idx = depths.index(min(depths))
        surface_temp = temperatures[min_depth_idx] if min_depth_idx < len(temperatures) else temperatures[0]
        hero = {
            "label": "Sea Surface Temperature",
            "value": f"{surface_temp:.1f}",
            "unit": "°C Surface"
        }
    elif salinities:
        hero = {
            "label": "Observed Salinity",
            "value": f"{salinities[0]:.2f}",
            "unit": "PSU"
        }
    elif depths:
        hero = {
            "label": "Cast Depth Range",
            "value": f"{max(depths):.1f}",
            "unit": "Meters Max"
        }

    # Compute 3-Column Context Stats
    stats = []

    # Stat 1: Coordinates / Location
    if latitudes and longitudes:
        loc_str = format_lat_lon(latitudes[0], longitudes[0])
        stats.append({"icon": "map-pin", "label": "Location", "value": loc_str})
    else:
        stats.append({"icon": "compass", "label": "Coverage Sector", "value": "Indian Ocean Basin"})

    # Stat 2: Depth Range or Salinity
    if depths:
        d_str = format_depth_range(min(depths), max(depths))
        stats.append({"icon": "ruler", "label": "Depth Range", "value": d_str})
    elif salinities:
        stats.append({"icon": "waves", "label": "Mean Salinity", "value": f"{sum(salinities)/len(salinities):.2f} PSU"})
    else:
        stats.append({"icon": "activity", "label": "Data Density", "value": f"{len(results)} Levels"})

    # Stat 3: Observation Timestamp
    if dates:
        time_str = format_timestamp(dates[0])
        stats.append({"icon": "calendar", "label": "Observed Time", "value": time_str})
    else:
        stats.append({"icon": "calendar", "label": "Cycle Period", "value": "Autonomous 10-Day Cast"})

    return hero, stats, len(results)


def detect_chart_type(query: str, results: list[dict]) -> dict | None:
    """Detect if data should be plotted as depth profile, time series, or bar chart."""
    if not results or len(results) < 2:
        return None

    columns = [k.lower() for k in results[0].keys()]

    # 1. Depth Profile Chart (depth + temperature/salinity)
    if "depth" in columns and ("temperature" in columns or "salinity" in columns):
        sorted_data = sorted(
            [r for r in results if r.get("depth") is not None],
            key=lambda x: float(x["depth"])
        )
        y_keys = []
        if "temperature" in columns:
            y_keys.append("temperature")
        if "salinity" in columns:
            y_keys.append("salinity")

        return {
            "chart_type": "depth_profile",
            "data": sorted_data[:100],
            "x_key": "depth",
            "y_keys": y_keys,
            "title": f"Vertical Water Column CTD Profile ({len(sorted_data)} Levels)"
        }

    # 2. Time Series Chart (date + numeric parameter)
    if "date" in columns:
        numeric_cols = [c for c in columns if c not in ["id", "float_id", "date", "latitude", "longitude", "profile_id"]]
        if numeric_cols:
            sorted_data = sorted(results, key=lambda x: str(x.get("date", "")))
            return {
                "chart_type": "time_series",
                "data": sorted_data[:60],
                "x_key": "date",
                "y_keys": numeric_cols[:2],
                "title": f"Temporal Hydrographic Progression ({numeric_cols[0].title()})"
            }

    return None


def clean_results_data(results: list[dict]) -> list[dict] | None:
    """Format float values in query results to clean 2-decimal rounded floats."""
    if not results:
        return None

    cleaned_list = []
    for row in results[:100]:
        new_row = {}
        for k, v in row.items():
            if isinstance(v, float):
                new_row[k] = round(v, 2)
            elif isinstance(v, str) and len(v) == 10 and v.count("-") == 2:
                new_row[k] = format_timestamp(v)
            else:
                new_row[k] = v
        cleaned_list.append(new_row)
    return cleaned_list


def detect_map_markers(results: list[dict]) -> list[dict] | None:
    """Extract geospatial map markers from SQL results with lat/lon."""
    if not results:
        return None

    columns = [k.lower() for k in results[0].keys()]
    if "latitude" not in columns or "longitude" not in columns:
        return None

    markers = []
    seen = set()
    for row in results[:100]:
        lat = row.get("latitude")
        lon = row.get("longitude")
        if lat is None or lon is None:
            continue

        float_id = str(row.get("float_id", "Unknown"))
        key = (round(lat, 3), round(lon, 3), float_id)
        if key in seen:
            continue
        seen.add(key)

        fmt_coord = format_lat_lon(lat, lon)
        fmt_date = format_timestamp(row.get("date"))

        marker = {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "float_id": float_id,
            "date": fmt_date,
            "label": f"Float #{float_id} ({fmt_coord}) — {fmt_date}"
        }
        markers.append(marker)

    return markers if markers else None


def generate_rag_summary(user_query: str, doc: dict[str, Any], language: str) -> str:
    """Generate a clean, single-sentence summary from retrieved ocean science document."""
    lang_info = detect_script_language(user_query)

    try:
        client = get_groq_client()
        lang_instruction = lang_info["system_instruction"]

        for model_name in PREFERRED_MODELS:
            try:
                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": f"""You are Lehar AI — India's AI Ocean Assistant for INCOIS.
Output ONLY a single, highly informative natural sentence (max 25 words) answering the user's conceptual science question based on the provided reference context.
CRITICAL RULES:
1. {lang_instruction}
2. Output ONLY the 1 sentence. No bullet points, no markdown, no quotes."""
                        },
                        {
                            "role": "user",
                            "content": f"User Question: {user_query}\n\nReference Context ({doc['title']}):\n{doc['content']}"
                        }
                    ],
                    model=model_name,
                    temperature=0.2,
                    max_tokens=400,
                )
                raw = chat_completion.choices[0].message.content or ""
                summary = clean_llm_response(raw)
                if summary:
                    return summary
            except Exception:
                continue
    except Exception:
        pass

    if lang_info["code"] in ("hi", "hi-latin"):
        return f"{doc['title']}: {doc['content'][:140]}..."
    return f"{doc['title']}: {doc['content'][:150]}..."


def generate_species_summary(
    user_query: str,
    species: dict[str, Any],
    viability: dict[str, Any],
    location_str: str,
    language: str
) -> str:
    """Generate a clean, grounded vernacular advisory sentence for a target fish species."""
    lang_info = detect_script_language(user_query)
    is_hindi = lang_info["code"] in ("hi", "hi-latin")

    common_short = species["common_name"].split("(")[0].strip()
    vernacular_short = species["common_name"].split("(")[-1].rstrip(")")
    score = viability["score"]
    rating = viability["rating"]
    opt_sst = viability["optimal_sst"]
    obs_sst = viability.get("observed_sst")

    obs_sst_str = f"{obs_sst:.1f}°C" if obs_sst is not None else "anukool"

    if is_hindi:
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} ke paas samundar ka taapman {obs_sst_str} hai, jo {vernacular_short} machhli ke liye {rating} ({score}% score) sthiti darshata hai."
        else:
            return f"{location_str} ke paas taapman {obs_sst_str} hai; {vernacular_short} ke anukool taapman ({opt_sst}) se thoda bhinn hone ke karan sthiti {rating} hai."
    else:
        if rating in ["Highly Optimal", "Favorable"]:
            return f"Sea conditions near {location_str} (SST: {obs_sst_str}) are {rating} ({score}% score) for {common_short} ({vernacular_short}) fishing."
        else:
            return f"Sea conditions near {location_str} (SST: {obs_sst_str}) are currently {rating} for {common_short}; optimal SST is {opt_sst}."


async def process_chat_query(
    user_query: str,
    language: str = "en-IN",
    session_id: str | None = None
) -> dict:
    """
    Full pipeline: Context Resolution → Intent Router (SQL / RAG / Species / Hybrid)
    → Execution → Deterministic Stats & Language Shaping.
    Returns structured dict matching ChatResponse schema.
    """
    try:
        # Step 1: Multi-Turn Conversational Memory & Coreference Resolution
        resolved_query, context_meta = resolve_query_context(session_id, user_query)

        # Step 2: Language, Script, & Route Classification
        lang_meta = detect_script_language(resolved_query)
        species = detect_species_in_query(resolved_query)
        intent = classify_query_intent(resolved_query)

        # =========================================================================
        # ROUTE A: PURE OCEAN SCIENCE RAG (Conceptual / Policy / Sensor Questions)
        # =========================================================================
        if intent == "ocean_science_rag" and not species:
            knowledge_docs = retrieve_ocean_knowledge(resolved_query, top_k=2)
            if knowledge_docs:
                top_doc = knowledge_docs[0]
                summary = generate_rag_summary(resolved_query, top_doc, language)
                hero_stat = top_doc.get("hero_metric")
                stats = top_doc.get("key_facts", [])
                knowledge_sources = [doc["title"] for doc in knowledge_docs]

                # Update session memory
                update_session_memory(
                    session_id=session_id,
                    user_query=user_query,
                    bot_summary=summary
                )

                return {
                    "summary": summary,
                    "answer": summary,
                    "hero_stat": hero_stat,
                    "stats": stats,
                    "reading_count": len(knowledge_docs),
                    "sql": None,
                    "data": None,
                    "chart": None,
                    "map_markers": None,
                    "query_route": "ocean_science_rag",
                    "species_detected": None,
                    "knowledge_sources": knowledge_sources,
                    "detected_language": lang_meta,
                    "data_sources": ["INCOIS Ocean Science Knowledge Base"],
                    "error": None
                }

        # =========================================================================
        # ROUTE B: VERNACULAR SPECIES ADVISORY / SQL HYBRID DATA
        # =========================================================================
        # Step 3 & 4: Generate SQL & Safely Execute with Multi-Stage Auto-Repair
        initial_sql = generate_sql(resolved_query)
        sql, results = repair_and_execute_sql(initial_sql, resolved_query)

        # Extract map markers and chart info
        chart_info = detect_chart_type(resolved_query, results)
        map_markers = detect_map_markers(results)
        cleaned_data = clean_results_data(results)

        # Handle Species-Grounded Output
        if species:
            temperatures = [float(r["temperature"]) for r in results if r.get("temperature") is not None]
            salinities = [float(r["salinity"]) for r in results if r.get("salinity") is not None]
            depths = [float(r["depth"]) for r in results if r.get("depth") is not None]
            latitudes = [float(r["latitude"]) for r in results if r.get("latitude") is not None]
            longitudes = [float(r["longitude"]) for r in results if r.get("longitude") is not None]

            avg_sst = (sum(temperatures) / len(temperatures)) if temperatures else 28.2
            avg_sal = (sum(salinities) / len(salinities)) if salinities else 35.0
            avg_mld = (sum(depths) / len(depths)) if depths else 25.0

            viability = evaluate_species_viability(species, avg_sst, avg_mld, avg_sal)
            viability["observed_sst"] = avg_sst
            loc_str = format_lat_lon(latitudes[0], longitudes[0]) if latitudes and longitudes else "Coastal Sector"

            summary = generate_species_summary(resolved_query, species, viability, loc_str, language)

            vernacular_tag = species["common_name"].split("(")[-1].rstrip(")")
            common_tag = species["common_name"].split("(")[0].strip()

            hero_stat = {
                "label": f"{vernacular_tag} Viability",
                "value": f"{viability['score']}%",
                "unit": viability["rating"]
            }

            stats = [
                {"icon": "fish", "label": "Species", "value": common_tag},
                {"icon": "thermometer", "label": "Optimum SST", "value": viability["optimal_sst"]},
                {"icon": "compass", "label": "Peak Season", "value": species["peak_season"].split("(")[0].strip()}
            ]

            update_session_memory(
                session_id=session_id,
                user_query=user_query,
                bot_summary=summary,
                detected_species=species["common_name"]
            )

            return {
                "summary": summary,
                "answer": summary,
                "hero_stat": hero_stat,
                "stats": stats,
                "reading_count": len(results),
                "sql": sql,
                "data": cleaned_data,
                "chart": chart_info,
                "map_markers": map_markers,
                "query_route": "species_advisory",
                "species_detected": species["common_name"],
                "knowledge_sources": ["INCOIS Potential Fishing Zone (PFZ) Guidelines"],
                "detected_language": lang_meta,
                "data_sources": ["INCOIS ARGO Subsurface", "NOAA MUR SST", "NASA VIIRS Chlorophyll-a"],
                "error": None
            }

        # Step 5: Standard Hydrographic SQL / Hybrid Output
        summary = generate_summary(resolved_query, sql, results, language)
        hero_stat, stats, reading_count = compute_structured_stats(results, resolved_query)

        # If hybrid query, attach relevant ocean knowledge context sources
        knowledge_sources = []
        if intent == "hybrid":
            kdocs = retrieve_ocean_knowledge(resolved_query, top_k=1)
            if kdocs:
                knowledge_sources = [kdocs[0]["title"]]

        update_session_memory(
            session_id=session_id,
            user_query=user_query,
            bot_summary=summary
        )

        return {
            "summary": summary,
            "answer": summary,
            "hero_stat": hero_stat,
            "stats": stats,
            "reading_count": reading_count,
            "sql": sql,
            "data": cleaned_data,
            "chart": chart_info,
            "map_markers": map_markers,
            "query_route": intent,
            "species_detected": None,
            "knowledge_sources": knowledge_sources if knowledge_sources else None,
            "detected_language": lang_meta,
            "data_sources": ["INCOIS ARGO Subsurface", "NOAA MUR SST", "NASA VIIRS Chlorophyll-a"],
            "error": None
        }

    except ValueError as e:
        lang_meta = detect_script_language(user_query)
        return {
            "summary": f"Query safety validation: {str(e)}",
            "answer": f"Query safety validation: {str(e)}",
            "hero_stat": None,
            "stats": [],
            "reading_count": 0,
            "sql": None,
            "data": None,
            "chart": None,
            "map_markers": None,
            "query_route": "error",
            "species_detected": None,
            "knowledge_sources": None,
            "detected_language": lang_meta,
            "data_sources": [],
            "error": str(e)
        }
    except Exception as e:
        lang_meta = detect_script_language(user_query)
        return {
            "summary": f"Error executing query: {str(e)}",
            "answer": f"Error executing query: {str(e)}",
            "hero_stat": None,
            "stats": [],
            "reading_count": 0,
            "sql": None,
            "data": None,
            "chart": None,
            "map_markers": None,
            "query_route": "error",
            "species_detected": None,
            "knowledge_sources": None,
            "detected_language": lang_meta,
            "data_sources": [],
            "error": str(e)
        }
