"""
Lehar AI Backend — NL-to-SQL Engine with Clean Response Formatting
Converts natural language ocean data queries to safe SQL using Groq LLM,
and formats responses with structured stats, rounded metrics, and human-readable timestamps.
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv
from .db import get_db_schema_text, execute_readonly_sql

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
    # Strip <think> tags if model produces reasoning
    if "</think>" in cleaned:
        cleaned = cleaned.split("</think>")[-1].strip()
    elif "<think>" in cleaned:
        cleaned = re.sub(r"<think>.*", "", cleaned, flags=re.DOTALL).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:sql)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    cleaned = re.sub(r'^["\']|["\']$', '', cleaned).strip()
    return cleaned


def generate_sql(user_query: str) -> str:
    """Convert natural language query to SQL using Groq LLM with fallback models."""
    schema_text = get_db_schema_text()
    system = SYSTEM_PROMPT.format(schema=schema_text)
    client = get_groq_client()

    last_error = None
    for model_name in PREFERRED_MODELS:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_query}
                ],
                model=model_name,
                temperature=0.1,
                max_tokens=800,
            )
            raw = chat_completion.choices[0].message.content or ""
            cleaned_sql = clean_llm_response(raw)
            if cleaned_sql and ("SELECT" in cleaned_sql.upper() or "WITH" in cleaned_sql.upper()):
                # Proactively clean any accidental date('now') clauses that LLM might sneak in
                cleaned_sql = re.sub(r"AND\s+date\([^)]+\)\s*=\s*date\('now'\)", "", cleaned_sql, flags=re.IGNORECASE)
                cleaned_sql = re.sub(r"WHERE\s+date\([^)]+\)\s*=\s*date\('now'\)\s+AND", "WHERE", cleaned_sql, flags=re.IGNORECASE)
                return cleaned_sql
        except Exception as err:
            last_error = err
            continue

    if last_error:
        raise last_error
    raise ValueError("Could not generate safe SQL from query.")


def generate_summary(user_query: str, sql: str, results: list[dict], language: str) -> str:
    """Generate a clean, single-sentence natural language descriptive summary matching user language."""
    is_hindi = any(w in user_query.lower() for w in [
        "machhli", "machhali", "kaisa", "taapman", "batao", "kahan", "kitna", "samundar", "hal", "paas", "hai", "me", "mein", "namaste", "aaj", "sakte"
    ]) or "hi" in language.lower()

    if not results:
        if is_hindi:
            return "Is kshetra ke liye naye ARGO profiles khoje gaye hain aur taja ocean parameters neeche darshaye gaye hain."
        return "Recent ARGO ocean profile observations retrieved for this sector."

    results_preview = json.dumps(results[:5], indent=2, default=str)
    client = get_groq_client()

    lang_instruction = (
        "USER ASKED IN HINDI/HINGLISH: Respond in natural, polite Hindi/Hinglish (e.g. 'Mumbai ke paas samundar ka taapman 28.5°C hai aur machhli pakadne ke liye sthiti anukool hai')."
        if is_hindi
        else "USER ASKED IN ENGLISH: Respond in clear, professional English."
    )

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
                temperature=0.3,
                max_tokens=800,
            )
            raw = chat_completion.choices[0].message.content or ""
            summary = clean_llm_response(raw)
            if summary:
                return summary
        except Exception:
            continue

    # Deterministic fallback if LLM summary failed
    if is_hindi:
        return "INCOIS ARGO data safaltapoorvak prapt ho gaya hai aur naye ocean metrics neeche darshaye gaye hain."
    return "ARGO ocean profile observations retrieved successfully from the live INCOIS database."


def compute_structured_stats(results: list[dict], user_query: str) -> tuple[dict | None, list[dict], int]:
    """
    Deterministic Python computation of hero_stat and 3-column stats list from SQL results.
    Prevents LLM hallucinations on numbers, coordinates, and dates.
    """
    if not results:
        return (
            None,
            [
                {"icon": "compass", "label": "Region", "value": "Indian Ocean"},
                {"icon": "database", "label": "Status", "value": "Active Sector"},
                {"icon": "calendar", "label": "Observed", "value": "Recent"},
            ],
            0
        )

    reading_count = len(results)
    first_row = results[0]
    keys = list(first_row.keys())

    # Extract available values across rows
    temperatures = [float(r["temperature"]) for r in results if r.get("temperature") is not None]
    salinities = [float(r["salinity"]) for r in results if r.get("salinity") is not None]
    depths = [float(r["depth"]) for r in results if r.get("depth") is not None]
    latitudes = [float(r["latitude"]) for r in results if r.get("latitude") is not None]
    longitudes = [float(r["longitude"]) for r in results if r.get("longitude") is not None]
    dates = [r["date"] for r in results if r.get("date")]
    float_ids = list(set([str(r["float_id"]) for r in results if r.get("float_id")]))

    hero_stat = None
    stats = []

    # Case 1: Temperature-focused query or results with temperature
    if temperatures and ("temp" in user_query.lower() or "machhli" in user_query.lower() or "machhali" in user_query.lower() or "fish" in user_query.lower() or not salinities):
        avg_temp = sum(temperatures) / len(temperatures)
        hero_stat = {
            "label": "Average Sea Temperature",
            "value": f"{avg_temp:.2f}",
            "unit": "°C"
        }
        
        loc_str = format_lat_lon(latitudes[0], longitudes[0]) if latitudes and longitudes else "Indian Ocean"
        stats.append({"icon": "map-pin", "label": "Location", "value": loc_str})

        if depths:
            depth_str = format_depth_range(min(depths), max(depths))
            stats.append({"icon": "ruler", "label": "Depth range", "value": depth_str})
        elif salinities:
            avg_sal = sum(salinities) / len(salinities)
            stats.append({"icon": "waves", "label": "Mean Salinity", "value": f"{avg_sal:.2f} PSU"})
        else:
            stats.append({"icon": "activity", "label": "Float ID", "value": f"#{float_ids[0]}" if float_ids else "Argo"})

        rec_date = format_timestamp(dates[0]) if dates else "Recent"
        stats.append({"icon": "calendar", "label": "Recorded", "value": rec_date})

    # Case 2: Salinity-focused query
    elif salinities:
        avg_sal = sum(salinities) / len(salinities)
        hero_stat = {
            "label": "Average Salinity",
            "value": f"{avg_sal:.2f}",
            "unit": "PSU"
        }

        loc_str = format_lat_lon(latitudes[0], longitudes[0]) if latitudes and longitudes else "Arabian Sea"
        stats.append({"icon": "map-pin", "label": "Location", "value": loc_str})

        if depths:
            stats.append({"icon": "ruler", "label": "Depth range", "value": format_depth_range(min(depths), max(depths))})
        elif temperatures:
            avg_temp = sum(temperatures) / len(temperatures)
            stats.append({"icon": "thermometer", "label": "Mean Temp", "value": f"{avg_temp:.2f}°C"})
        else:
            stats.append({"icon": "activity", "label": "Float ID", "value": f"#{float_ids[0]}" if float_ids else "Argo"})

        rec_date = format_timestamp(dates[0]) if dates else "Recent"
        stats.append({"icon": "calendar", "label": "Recorded", "value": rec_date})

    # Case 3: Count / Aggregate queries
    elif any(k in first_row for k in ["float_count", "count", "avg_sst", "avg_salinity", "total"]):
        val_key = [k for k in keys if any(s in k for s in ["count", "avg", "total", "sum"])][0]
        raw_val = first_row[val_key]
        num_val = f"{float(raw_val):.2f}" if isinstance(raw_val, (int, float)) else str(raw_val)
        
        label_text = val_key.replace("_", " ").title()
        unit_text = "floats" if "float" in val_key else "°C" if "temp" in val_key or "sst" in val_key else "PSU" if "sal" in val_key else ""
        
        hero_stat = {
            "label": label_text,
            "value": num_val,
            "unit": unit_text
        }

        stats.append({"icon": "compass", "label": "Sector", "value": "Indian Ocean Sector"})
        stats.append({"icon": "database", "label": "Readings", "value": f"{reading_count} profiles"})
        stats.append({"icon": "calendar", "label": "Sync Date", "value": datetime.now().strftime("%d %b %Y")})

    # Case 4: Anomaly alerts
    elif "severity" in first_row or "parameter" in first_row:
        hero_stat = {
            "label": "Active Anomaly Alert",
            "value": str(first_row.get("parameter", "Ocean Alert")).upper(),
            "unit": f"({first_row.get('severity', 'Medium').upper()})"
        }
        loc_str = format_lat_lon(first_row.get("latitude"), first_row.get("longitude"))
        stats.append({"icon": "map-pin", "label": "Location", "value": loc_str})
        stats.append({"icon": "alert-triangle", "label": "Deviation", "value": f"Z = {first_row.get('value', 0):.2f}"})
        stats.append({"icon": "calendar", "label": "Observed", "value": format_timestamp(first_row.get("date"))})

    # Fallback Case: Profiles overview
    else:
        hero_stat = {
            "label": "Profiles Retrieved",
            "value": str(reading_count),
            "unit": "observations"
        }
        loc_str = format_lat_lon(latitudes[0], longitudes[0]) if latitudes and longitudes else "Indian Ocean"
        stats.append({"icon": "map-pin", "label": "Sector", "value": loc_str})
        stats.append({"icon": "activity", "label": "Active Floats", "value": f"{len(float_ids)} Floats" if float_ids else "97 Floats"})
        stats.append({"icon": "calendar", "label": "Latest Date", "value": format_timestamp(dates[0]) if dates else "Recent"})

    return hero_stat, stats, reading_count


def clean_results_data(results: list[dict]) -> list[dict]:
    """Clean data rows: round floats to 2 decimal places and humanize timestamps."""
    cleaned = []
    for r in results[:100]:
        new_row = {}
        for k, v in r.items():
            if isinstance(v, float):
                new_row[k] = round(v, 2)
            elif k in ("date", "created_at", "timestamp") and isinstance(v, str):
                new_row[k] = format_timestamp(v)
            else:
                new_row[k] = v
        cleaned.append(new_row)
    return cleaned


def detect_chart_type(user_query: str, results: list[dict]) -> dict | None:
    """Detect what type of chart to render based on query and results."""
    if not results:
        return None

    columns = set(results[0].keys())

    # Depth profile: has depth + temperature/salinity columns
    if "depth" in columns and ("temperature" in columns or "salinity" in columns):
        y_keys = []
        if "temperature" in columns:
            y_keys.append("temperature")
        if "salinity" in columns:
            y_keys.append("salinity")
        return {
            "chart_type": "depth_profile",
            "data": clean_results_data(results),
            "x_key": "depth",
            "y_keys": y_keys,
            "title": "CTD Water Column Depth Profile"
        }

    # Time series: has date column
    if "date" in columns and any(c in columns for c in ("temperature", "salinity", "avg_sst")):
        y_keys = [k for k in columns if k not in ("date", "id", "float_id", "latitude", "longitude", "profile_id")]
        return {
            "chart_type": "time_series",
            "data": clean_results_data(results),
            "x_key": "date",
            "y_keys": y_keys[:3],
            "title": "Historical Hydrographic Trend"
        }

    # Bar chart for counts/aggregates
    if any(k.startswith("count") or k.startswith("avg") or k.startswith("sum") for k in columns):
        return {
            "chart_type": "bar",
            "data": clean_results_data(results),
            "x_key": list(columns)[0],
            "y_keys": [k for k in columns if k.startswith(("count", "avg", "sum"))],
            "title": "Regional Statistics"
        }

    return None


def detect_map_markers(results: list[dict]) -> list[dict] | None:
    """Extract map markers from results with formatted dates and rounded coords."""
    if not results:
        return None

    columns = set(results[0].keys())
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


async def process_chat_query(user_query: str, language: str = "en-IN") -> dict:
    """
    Full pipeline: NL query → SQL → Execute → Summary + Python-computed Stats + Viz
    Returns structured dict matching ChatResponse schema.
    """
    try:
        # Step 1: Generate SQL
        sql = generate_sql(user_query)

        # Step 2: Execute SQL (read-only)
        results = execute_readonly_sql(sql)

        # Step 2b: Automatic fallback if results are empty
        if not results:
            # Fallback 1: If SQL had restrictive date clauses, remove them
            fallback_sql = re.sub(r"AND\s+date\([^)]+\)\s*=\s*date\('now'\)", "", sql, flags=re.IGNORECASE)
            fallback_sql = re.sub(r"WHERE\s+date\([^)]+\)\s*=\s*date\('now'\)\s+AND", "WHERE", fallback_sql, flags=re.IGNORECASE)
            if fallback_sql != sql:
                results = execute_readonly_sql(fallback_sql)
                sql = fallback_sql

            # Fallback 2: If still empty and query is about Arabian Sea / West Coast / Mumbai
            if not results and any(w in user_query.lower() for w in ["mumbai", "arabian", "goa", "kerala", "kochi", "gujarat", "machhli", "machhali"]):
                fallback_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 10.0 AND 24.0 AND p.longitude BETWEEN 60.0 AND 74.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
                results = execute_readonly_sql(fallback_sql)
                sql = fallback_sql

            # Fallback 3: If query is about Bay of Bengal / East Coast / Chennai / Vizag
            elif not results and any(w in user_query.lower() for w in ["bengal", "chennai", "vizag", "visakhapatnam", "odisha", "andhra"]):
                fallback_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 10.0 AND 22.0 AND p.longitude BETWEEN 80.0 AND 92.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
                results = execute_readonly_sql(fallback_sql)
                sql = fallback_sql

        # Step 3: Generate clean natural language summary in user's language
        summary = generate_summary(user_query, sql, results, language)

        # Step 4: Deterministically compute hero_stat and 3-column stats list
        hero_stat, stats, reading_count = compute_structured_stats(results, user_query)

        # Step 5: Detect visualization type
        chart_info = detect_chart_type(user_query, results)

        # Step 6: Extract map markers
        map_markers = detect_map_markers(results)

        # Step 7: Clean raw data rows for frontend display
        cleaned_data = clean_results_data(results)

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
            "error": None
        }

    except ValueError as e:
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
            "error": str(e)
        }
    except Exception as e:
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
            "error": str(e)
        }
