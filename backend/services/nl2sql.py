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
from .marine_weather import get_live_marine_weather, format_marine_weather_response

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
COASTAL_BOUNDS = {
    "bengal": {
        "lat_min": 11.0, "lat_max": 22.5, "lon_min": 80.0, "lon_max": 91.0,
        "name": "West Bengal & North Bay of Bengal",
        "species_en": "Hilsa (Ilish / Tenualosa ilisha), Bhetki (Barramundi), Silver Pomfret (Chandi), and Tiger Prawns",
        "species_hi": "हिल्सा (इलीश), भेटकी (Barramundi), सिल्वर पापलेट और टाइगर प्रॉन्स",
        "species_mr": "हिल्सा (इलीश), भेटकी, पापलेट आणि कोळंबी",
        "species_bn": "ইলিশ (Hilsa), ভেটকি, পমফ্রেট এবং বাগদা চিংড়ি",
        "depth": "5m - 35m",
        "keywords": ["bengal", "west bengal", "kolkata", "digha", "sundarbans", "hooghly", "baangla", "বাঙলা", "কলকাতা", "দীঘা", "সুন্দরবন", "ইলিশ", "बंगाल", "कोलकाता"]
    },
    "mumbai": {
        "lat_min": 14.0, "lat_max": 20.5, "lon_min": 65.0, "lon_max": 73.8,
        "name": "Mumbai & Konkan Coast",
        "species_en": "Surmai (King Mackerel), Bangda (Indian Mackerel), Bombil (Bombay Duck), and Paplet (Silver Pomfret)",
        "species_hi": "सुरमई (King Mackerel), बांगड़ा (Indian Mackerel), पापलेट (Pomfret) और बोंबिल (Bombay Duck)",
        "species_mr": "सुरमई (King Mackerel), बांगडा (Mackerel), पापलेट (Pomfret) आणि बोंबील (Bombay Duck)",
        "species_bn": "সুরমাই, ভারতীয় ম্যাকেরেল, পমফ্রেট এবং বোম্বে ডাক",
        "depth": "10m - 45m",
        "keywords": ["mumbai", "bombay", "sassoon", "versova", "alibaug", "मुंबई", "मुम्बई", "बॉम्बे", "कोंकण", "konkan"]
    },
    "maharashtra": {
        "lat_min": 14.0, "lat_max": 20.5, "lon_min": 65.0, "lon_max": 73.8,
        "name": "Maharashtra & Konkan Coast",
        "species_en": "Surmai, Bangda, Bombil, Paplet, and Yellowfin Tuna",
        "species_hi": "सुरमई, बांगड़ा, बोंबिल, पापलेट और टूना",
        "species_mr": "सुरमई, बांगडा, बोंबील, पापलेट आणि टुना मासे",
        "species_bn": "সুরমাই, ম্যাকেরেল, পমফ্রেট এবং টুনা",
        "depth": "15m - 50m",
        "keywords": ["maharashtra", "konkan", "ratnagiri", "malvan", "sindhudurg", "महाराष्ट्र", "कोकण", "रत्नागिरी", "मालवण", "मासे", "मच्छी"]
    },
    "kerala": {
        "lat_min": 6.0, "lat_max": 13.5, "lon_min": 71.0, "lon_max": 77.5,
        "name": "Kerala Coast & Malabar",
        "species_en": "Mathi (Oil Sardine), Ayala (Indian Mackerel), Kera (Yellowfin Tuna), and Karimeen",
        "species_hi": "मथी (ऑयल सार्डिन), अयला (मैकेरल), केरा (टूना) और करीमीन",
        "species_mr": "मथी, अयला, केरा (टुना) आणि करीमीन",
        "species_ml": "മത്തി (ചാള), അയല, കേര (ചൂര), കരിമീൻ",
        "depth": "10m - 50m",
        "keywords": ["kerala", "kochi", "cochin", "malabar", "calicut", "trivandrum", "munambam", "കേരളം", "കൊച്ചി", "മത്തി", "അയല", "ചൂര", "कोच्चि", "केरल"]
    },
    "tamil_nadu": {
        "lat_min": 8.0, "lat_max": 15.0, "lon_min": 78.0, "lon_max": 85.0,
        "name": "Tamil Nadu & Coromandel Coast",
        "species_en": "Vanjaram (King Seer Fish), Nethili (Anchovy), Soorai (Tuna), and Sankara (Red Snapper)",
        "species_hi": "वंजारम (सीर फिश), नेथिली, सूराई (टूना) और संकरा",
        "species_mr": "वंजारम, नेथिली, सुराई (टुना)",
        "species_ta": "வஞ்சிரம் (சீலா), நெத்திலி, சூரை (டூனா), சங்கரா மீன்",
        "depth": "15m - 50m",
        "keywords": ["chennai", "tamil nadu", "madras", "tuticorin", "thoothukudi", "rameshwaram", "coromandel", "சென்னை", "தமிழ்நாடு", "தூத்துக்குடி", "வஞ்சிரம்", "நெத்திலி", "चेन्नई", "तमिलनाडु"]
    },
    "andhra": {
        "lat_min": 13.5, "lat_max": 19.5, "lon_min": 80.0, "lon_max": 88.0,
        "name": "Andhra Pradesh Coast",
        "species_en": "Vanjaram (Seer Fish), Pomfret, Ribbonfish, Tuna, and Tiger Prawns",
        "species_hi": "वंजारम, पापलेट, रिबनफिश, टूना और टाइगर प्रॉन्स",
        "species_te": "వంజరం, చందువ (పాంఫ్రెట్), సావళ్లు, సూర చేపలు",
        "depth": "15m - 50m",
        "keywords": ["vizag", "visakhapatnam", "andhra", "kakinada", "machilipatnam", "విశాఖపట్నం", "ఆంధ్ర", "వంజరం", "చేపలు", "विशाखापट्टनम", "वाइज़ैग"]
    },
    "gujarat": {
        "lat_min": 19.0, "lat_max": 23.5, "lon_min": 63.5, "lon_max": 72.5,
        "name": "Gujarat Coast (Veraval / Porbandar)",
        "species_en": "Ribbon Fish, Cuttlefish / Squid, Silver Pomfret, and Ghol (Croaker)",
        "species_hi": "रिबन फिश, कटलफिश/स्क्विड, पापलेट और घोल (Croaker)",
        "species_gu": "રીબન ફિશ, કટલફિશ, પાપલેટ અને ઘોલ માછલી",
        "depth": "15m - 60m",
        "keywords": ["gujarat", "veraval", "porbandar", "saurashtra", "okha", "kutch", "ગુજરાત", "વેરાવળ", "પોરબંદર", "गुजरात", "वेरावल"]
    },
    "odisha": {
        "lat_min": 18.5, "lat_max": 21.8, "lon_min": 84.5, "lon_max": 88.5,
        "name": "Odisha Coast (Paradip / Puri)",
        "species_en": "Hilsa (Ilish), Silver Pomfret, Ribbonfish, and Prawns",
        "species_hi": "हिल्सा, पापलेट, रिबनफिश और झींगा",
        "depth": "10m - 40m",
        "keywords": ["odisha", "paradip", "puri", "chandipur", "gopalpur", "ଓଡ଼ିଶା", "ପାରାଦ୍ୱୀପ", "ओडिशा"]
    }
}


def detect_coastal_sector(query: str, lang_code: str = "en") -> dict | None:
    """Detects target coastal geographical sector from query tokens or language defaults."""
    q_low = query.lower()
    for key, sector in COASTAL_BOUNDS.items():
        if any(kw.lower() in q_low for kw in sector["keywords"]):
            return sector

    # Regional language defaults if no explicit city/state name mentioned
    if lang_code == "mr":
        return COASTAL_BOUNDS["maharashtra"]
    elif lang_code == "ta":
        return COASTAL_BOUNDS["tamil_nadu"]
    elif lang_code == "te":
        return COASTAL_BOUNDS["andhra"]
    elif lang_code == "bn":
        return COASTAL_BOUNDS["bengal"]
    elif lang_code == "gu":
        return COASTAL_BOUNDS["gujarat"]
    elif lang_code == "ml":
        return COASTAL_BOUNDS["kerala"]

    return None


SYSTEM_PROMPT = """You are Lehar AI SQL Assistant — an expert at converting natural language questions about ocean data into safe, read-only SQLite queries.

{schema}

CRITICAL RULES:
1. ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Always use proper table and column names from the schema above.
3. NEVER USE date('now') or strict date equality. Always sort by `ORDER BY p.date DESC` to get the most recent recorded profiles.
4. Return ONLY the raw SQL query, nothing else. No explanation, no markdown code blocks.
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
        cleaned = re.sub(r"<think>[\s\S]*?(?:</think>|$)", "", cleaned).strip()
    if "```" in cleaned:
        cleaned = re.sub(r"```[a-zA-Z]*\n?", "", cleaned).strip()
        cleaned = cleaned.replace("```", "").strip()
    cleaned = re.sub(r"^[\"']|[\"']$", "", cleaned).strip()
    return cleaned


def generate_sql(user_query: str) -> str:
    """Generate a safe, read-only SQL query from natural language with model fallback and exact coastal bounds."""
    lang_info = detect_script_language(user_query)
    sector = detect_coastal_sector(user_query, lang_info.get("code", "en"))

    # Direct high-precision sector binding if sector identified
    if sector:
        lat_min, lat_max = sector["lat_min"], sector["lat_max"]
        lon_min, lon_max = sector["lon_min"], sector["lon_max"]
        return f"SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN {lat_min} AND {lat_max} AND p.longitude BETWEEN {lon_min} AND {lon_max} AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"

    schema_text = get_db_schema_text()
    system_prompt = SYSTEM_PROMPT.format(schema=schema_text)
    client = get_groq_client()

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
        except Exception:
            continue

    return "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 5.0 AND 25.0 AND p.longitude BETWEEN 55.0 AND 80.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"


def repair_and_execute_sql(sql: str, user_query: str) -> tuple[str, list[dict]]:
    """
    Safely execute SQL with multi-stage auto-repair:
    1. Direct execution
    2. Retry with fallback sector query if 0 rows returned
    """
    try:
        results = execute_readonly_sql(sql)
        if results and len(results) > 0:
            return sql, results
    except Exception:
        pass

    # If original query returned 0 rows, use detected coastal sector fallback query
    lang_info = detect_script_language(user_query)
    sector = detect_coastal_sector(user_query, lang_info.get("code", "en"))
    if sector:
        lat_min, lat_max = sector["lat_min"], sector["lat_max"]
        lon_min, lon_max = sector["lon_min"], sector["lon_max"]
        fallback_sql = f"SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN {lat_min} AND {lat_max} AND p.longitude BETWEEN {lon_min} AND {lon_max} AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
        try:
            fb_results = execute_readonly_sql(fallback_sql)
            if fb_results:
                return fallback_sql, fb_results
        except Exception:
            pass

    # Global basin fallback
    global_sql = "SELECT p.id, p.float_id, p.latitude, p.longitude, p.date, m.depth, m.temperature, m.salinity FROM argo_profiles p JOIN argo_measurements m ON p.id = m.profile_id WHERE p.latitude BETWEEN 5.0 AND 25.0 AND p.longitude BETWEEN 55.0 AND 85.0 AND m.depth <= 50 ORDER BY p.date DESC, m.depth ASC LIMIT 50"
    return global_sql, execute_readonly_sql(global_sql)


def generate_summary(user_query: str, sql: str, results: list[dict], language: str = "en") -> str:
    """Format raw SQL results into a rich, species-specific answer in the user's native language."""
    return format_answer(user_query, results, language)


def format_answer(user_query: str, results: list[dict], language: str = "en") -> str:
    """Format query results into rich, species-specific, practical answer in the user's exact native language."""
    if not results:
        return "No hydrographic data available for this query sector."

    lang_info = detect_script_language(user_query)
    code = lang_info.get("code", "en")
    sector = detect_coastal_sector(user_query, code)

    # Compute observed SST and salinity
    temps = [float(r["temperature"]) for r in results if r.get("temperature") is not None]
    sals = [float(r["salinity"]) for r in results if r.get("salinity") is not None]
    avg_sst = (sum(temps) / len(temps)) if temps else 28.5
    avg_sal = (sum(sals) / len(sals)) if sals else 35.0
    sst_str = f"{avg_sst:.1f}°C"
    sal_str = f"{avg_sal:.1f} PSU"

    sector_name = sector["name"] if sector else "Indian Coastal Waters"
    species_text = sector["species_en"] if sector else "Surmai, Bangda, Pomfret, and Tuna"
    gear_depth = sector["depth"] if sector else "10m - 45m"

    if code == "hi":
        species_text = sector.get("species_hi", species_text) if sector else "सुरमई, बांगड़ा, पापलेट और टूना"
    elif code == "mr":
        species_text = sector.get("species_mr", species_text) if sector else "सुरमई, बांगडा, पापलेट आणि बोंबील"
    elif code == "bn":
        species_text = sector.get("species_bn", species_text) if sector else "ইলিশ, ভেটকি, পমফ্রেট এবং বাগদা চিংড়ি"
    elif code == "ta":
        species_text = sector.get("species_ta", species_text) if sector else "வஞ்சிரம், நெத்திலி, சூரை மற்றும் சங்கரா"
    elif code == "te":
        species_text = sector.get("species_te", species_text) if sector else "వంజరం, చందువ, సావళ్లు మరియు సూర చేపలు"
    elif code == "gu":
        species_text = sector.get("species_gu", species_text) if sector else "રીબન ફિશ, કટલફિશ, પાપલેટ અને ઘોલ"

    results_preview = json.dumps(results[:5], indent=2, default=str)

    try:
        client = get_groq_client()
        lang_instruction = lang_info["system_instruction"]

        prompt_context = f"""You are Lehar AI — India's premier Conversational Marine Intelligence Assistant developed for INCOIS & Ministry of Earth Sciences (SIH26040).

USER QUESTION: {user_query}
TARGET COASTAL SECTOR: {sector_name}
PRIMARY COMMERCIAL SPECIES IN THIS SECTOR: {species_text}
RECOMMENDED FISHING DEPTH: {gear_depth}
OBSERVED IN-SITU DATA: Sea Surface Temperature = {sst_str}, Salinity = {sal_str}

CRITICAL RULES:
1. {lang_instruction}
2. DIRECTLY answer the user's specific practical question! If they ask what fish are found or where to fish, explicitly name the local species ({species_text}), the sea temperature ({sst_str}), and the gear depth ({gear_depth}).
3. Keep it punchy, practical, and highly informative (2 to 3 natural sentences).
4. Output ONLY the response in the user's requested language/script. No quotes, no markdown headers."""

        for model_name in PREFERRED_MODELS:
            try:
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": prompt_context},
                        {"role": "user", "content": f"Answer the user query concisely based on this in-situ data:\n{results_preview}"}
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

    # High-fidelity native offline fallback templates for each coastal language
    if code == "hi":
        return f"{sector_name} क्षेत्र में समुद्र की सतह का तापमान {sst_str} और लवणता {sal_str} है। यहाँ {species_text} {gear_depth} गहराई में पकड़ने के लिए सबसे अनुकूल स्थिति है।"
    elif code == "mr":
        return f"{sector_name} किनारपट्टी भागात समुद्राचे तापमान {sst_str} असून {species_text} पकडण्यासाठी {gear_depth} खोलीवर उत्तम अनुकूल परिस्थिती आहे."
    elif code == "bn":
        return f"{sector_name} উপকূলীয় অঞ্চলে সমুদ্রের তাপমাত্রা {sst_str} এবং {species_text} ধরার জন্য {gear_depth} গভীরতায় চমৎকার অনুকূল পরিবেশ রয়েছে।"
    elif code == "ta":
        return f"{sector_name} பகுதியில் கடல் மேற்பரப்பு வெப்பநிலை {sst_str} ஆக உள்ளது. இங்கு {species_text} பிடிக்க {gear_depth} ஆழத்தில் மிகவும் சாதகமான சூழல் நிலவுகிறது."
    elif code == "te":
        return f"{sector_name} తీర ప్రాంతంలో సముద్ర ఉష్ణోగ్రత {sst_str} గా ఉంది. ఇక్కడ {species_text} వేటకు {gear_depth} లోతులో అత్యంత అనుకూలమైన పరిస్థితులు ఉన్నాయి."
    elif code == "gu":
        return f"{sector_name} દરિયાકાંઠાના વિસ્તારમાં સપાટીનું તાપમાન {sst_str} છે અને {species_text} પકડવા માટે {gear_depth} ઊંડાઈએ ઉત્તમ અનુકૂળ સ્થિતિ છે."
    elif code == "ml":
        return f"{sector_name} തീരദേശ മേഖലയിലെ സമുദ്രോപരിതല താപനില {sst_str} കൂടാതെ {species_text} പിടിക്കാൻ {gear_depth} ആഴത്തിൽ അനുകൂല സാഹചര്യമാണ്."
    elif code == "kn":
        return f"{sector_name} ಕರಾವಳಿ ಪ್ರದೇಶದಲ್ಲಿ ಸಮುದ್ರದ ತಾಪಮಾನ {sst_str} ಮತ್ತು {species_text} ಹಿಡಿಯಲು {gear_depth} ಆಳದಲ್ಲಿ ಉತ್ತಮ ಪರಿಸ್ಥಿತಿ ಇದೆ."
    
    return f"In {sector_name}, the sea surface temperature is {sst_str} with optimal conditions for {species_text} at depths of {gear_depth}."


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
    code = lang_info.get("code", "en")

    common_short = species["common_name"].split("(")[0].strip()
    vernacular_short = species["common_name"].split("(")[-1].rstrip(")")
    score = viability["score"]
    rating = viability["rating"]
    opt_sst = viability["optimal_sst"]
    obs_sst = viability.get("observed_sst")

    obs_sst_str = f"{obs_sst:.1f}°C" if obs_sst is not None else "28.5°C"

    if code == "ta":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} அருகில் கடல் வெப்பநிலை {obs_sst_str} ஆக உள்ளது; இது {vernacular_short} மீன்பிடிக்க {rating} ({score}% சாதகமான சூழல்) ஆகும்."
        return f"{location_str} அருகில் வெப்பநிலை {obs_sst_str} ஆக உள்ளது; {vernacular_short} உகந்த வெப்பநிலையானது {opt_sst} ஆகும்."
    elif code == "te":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} వద్ద సముద్ర ఉష్ణోగ్రత {obs_sst_str} గా ఉంది; ఇది {vernacular_short} చేపల వేటకు {rating} ({score}% స్కోరు) అనుకూలమైనది."
        return f"{location_str} వద్ద ఉష్ణోగ్రత {obs_sst_str} గా ఉంది; {vernacular_short} కోసం సరైన ఉష్ణోగ్రత {opt_sst}."
    elif code == "hi":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} के पास समुद्र का तापमान {obs_sst_str} है, जो {vernacular_short} मछली के लिए {rating} ({score}% स्कोर) अनुकूल स्थिति दर्शाता है।"
        return f"{location_str} के पास तापमान {obs_sst_str} है; {vernacular_short} के लिए अनुकूल तापमान ({opt_sst}) है।"
    elif code == "hi-latin":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} ke paas samundar ka taapman {obs_sst_str} hai, jo {vernacular_short} machhli ke liye {rating} ({score}% score) anukool sthiti darshata hai."
        return f"{location_str} ke paas taapman {obs_sst_str} hai; {vernacular_short} ke anukool taapman ({opt_sst}) se thoda alag hai."
    elif code == "mr":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} जवळ समुद्राचे तापमान {obs_sst_str} असून, ते {vernacular_short} मासेमारीसाठी {rating} ({score}% अनुकूल) आहे."
        return f"{location_str} जवळ तापमान {obs_sst_str} असून, {vernacular_short} साठी अनुकूल तापमान {opt_sst} आहे."
    elif code == "gu":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} પાસે દરિયાઈ તાપમાન {obs_sst_str} છે, જે {vernacular_short} માછીમારી માટે {rating} ({score}% અનુકૂળ) છે."
        return f"{location_str} પાસે તાપમાન {obs_sst_str} છે; {vernacular_short} માટે અનુકૂળ તાપમાન {opt_sst} છે."
    elif code == "bn":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str}-এর কাছে সমুদ্রের তাপমাত্রা {obs_sst_str}, যা {vernacular_short} মাছ ধরার জন্য {rating} ({score}% অনুকূল)।"
        return f"{location_str}-এর কাছে তাপমাত্রা {obs_sst_str}; {vernacular_short}-এর জন্য আদর্শ তাপমাত্রা {opt_sst}।"
    elif code == "ml":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} സമീപം സമുദ്ര താപനില {obs_sst_str} ആണ്; ഇത് {vernacular_short} മത്സ്യബന്ധനത്തിന് {rating} ({score}% അനുകൂലം) ആണ്."
        return f"{location_str} സമീപം താപനില {obs_sst_str} ആണ്; {vernacular_short} അനുയോജ്യമായ താപനില {opt_sst} ആണ്."
    elif code == "kn":
        if rating in ["Highly Optimal", "Favorable"]:
            return f"{location_str} ಬಳಿ ಸಮುದ್ರದ ತಾಪಮಾನ {obs_sst_str} ಆಗಿದೆ; ಇದು {vernacular_short} ಮೀನುಗಾರಿಕೆಗೆ {rating} ({score}% ಸೂಕ್ತ) ಆಗಿದೆ."
        return f"{location_str} ಬಳಿ ತಾಪಮಾನ {obs_sst_str} ಆಗಿದೆ; {vernacular_short} ಸೂಕ್ತ ತಾಪಮಾನ {opt_sst} ಆಗಿದೆ."
    
    if rating in ["Highly Optimal", "Favorable"]:
        return f"Sea conditions near {location_str} (SST: {obs_sst_str}) are {rating} ({score}% score) for {common_short} ({vernacular_short}) fishing."
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
        # ROUTE 0: LIVE MARINE WEATHER, HYDRODYNAMICS & SAFETY DECISION ENGINE
        # =========================================================================
        if intent == "marine_weather_safety":
            sector = detect_coastal_sector(resolved_query, lang_meta.get("code", "en"))
            sector_name = sector["name"] if sector else "Indian Coastal Waters"
            lat = (sector["lat_min"] + sector["lat_max"]) / 2.0 if sector else 18.9
            lon = (sector["lon_min"] + sector["lon_max"]) / 2.0 if sector else 72.8

            weather = get_live_marine_weather(lat, lon)
            resp_data = format_marine_weather_response(
                weather=weather,
                sector_name=sector_name,
                user_query=resolved_query,
                lang_code=lang_meta.get("code", "en")
            )

            map_markers = [{
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "float_id": "METEO-BUOY",
                "date": "Live Wave Dynamics",
                "label": f"{sector_name} Marine State: {weather['wave_height_m']}m Waves ({weather['safety_status']})"
            }]

            update_session_memory(
                session_id=session_id,
                user_query=user_query,
                bot_summary=resp_data["answer"]
            )

            return {
                "summary": resp_data["summary"],
                "answer": resp_data["answer"],
                "hero_stat": resp_data["hero_stat"],
                "stats": resp_data["stats"],
                "reading_count": 1,
                "sql": None,
                "data": [weather],
                "chart": None,
                "map_markers": map_markers,
                "query_route": "marine_weather_safety",
                "species_detected": None,
                "knowledge_sources": ["INCOIS Ocean State Forecast", "Open-Meteo High-Res ECMWF Waves"],
                "detected_language": lang_meta,
                "data_sources": ["Open-Meteo Marine API", "INCOIS Wave Climatology", "IMD Coastal Safety"],
                "error": None
            }

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
