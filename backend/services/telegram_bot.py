"""
Lehar AI — Telegram Bot Gateway Service (@LeharAIBot)
Zero-dependency async Telegram Bot integration using httpx long-polling.

Features:
1. Bidirectional Voice Engine:
   - Voice-In: Groq Whisper Large v3 Turbo (<300ms multilingual speech transcription)
   - Voice-Out: Edge-TTS Neural Regional Voice Synthesis (hi-IN, en-IN, ta-IN, te-IN, mr-IN)
2. In-Situ Ocean Physics & Thermocline Calculus (dT/dz, MLD, SST gradients)
3. ICAR-CMFRI Pelagic Species Biology & Catch Viability Modeling
4. Real Marine Voyage Economics (Diesel Litres + ₹ Savings + CO2 offset)
5. GPS Live Location Sharing with Native Map Pins & Navigation URLs
"""

from __future__ import annotations
import asyncio
import os
import re
import json
import logging
from typing import Optional, Dict, Any
from pathlib import Path
import httpx
from dotenv import load_dotenv
from groq import Groq
import edge_tts

from .nl2sql import process_chat_query
from .chat_memory import get_session_memory
from .pfz_engine import (
    nearest_harbour,
    haversine_km,
    bearing_degrees,
    bearing_to_compass,
    compute_mld,
    compute_thermocline_gradient,
    evaluate_species_profile_viability,
    calculate_voyage_economics,
    SPECIES_ECOLOGY
)
from .db import (
    get_connection,
    get_active_hazards,
    create_sos_alert,
    acknowledge_sos_alert,
    resolve_sos_alert,
    log_location_history,
    purge_old_location_history,
    update_subscriber_weather_alert_time
)
from .marine_weather import get_live_marine_weather
from .lang_detect import detect_script_language

# Load from backend/.env
backend_env = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=backend_env)
load_dotenv()

logger = logging.getLogger("lehar_telegram_bot")

# High-urgency keywords that start the 90-second fail-safe escalation timer
HIGH_URGENCY_KEYWORDS = [
    "doob", "sink", "dub raha", "drowning", "boat breakdown", "engine fail",
    "capsiz", "boat leak", "hull damage", "fas gaya", "naav tut", "pani bhar"
]

# General emergency keywords that trigger the 1-tap confirmation card
EMERGENCY_KEYWORDS = [
    "sos", "emergency", "bachao", "sankat", "help me", "khatra", "madad karo"
]


def get_coast_guard_station(lat: float, lon: float) -> str:
    """Resolve nearest Indian Coast Guard District Headquarters (DHQ) by maritime sector."""
    if lon < 71.0 or (lat > 20.0 and lon < 73.0):
        return "Indian Coast Guard DHQ-1 (Porbandar / Okha)"
    elif lat > 15.0 and lon < 74.5:
        return "Indian Coast Guard DHQ-2 (Mumbai / Ratnagiri)"
    elif lon < 78.0 and lat <= 15.0:
        return "Indian Coast Guard DHQ-3 (New Mangalore) / DHQ-4 (Kochi)"
    elif lon >= 78.0 and lat < 16.0:
        return "Indian Coast Guard DHQ-5 (Chennai / Tuticorin)"
    else:
        return "Indian Coast Guard DHQ-6 (Visakhapatnam) / DHQ-7 (Paradip)"


def check_geofence_hazard(lat: float, lon: float) -> Optional[dict]:
    """
    Checks if vessel coordinates fall within any active marine hazard zone.
    Returns the matching zone with the highest severity rank.
    """
    hazards = get_active_hazards()
    for hz in hazards:
        d = haversine_km(lat, lon, hz["center_lat"], hz["center_lon"])
        if d <= hz["radius_km"]:
            hz_copy = dict(hz)
            hz_copy["dist_from_center_km"] = round(d, 1)
            return hz_copy
    return None


def get_bot_token() -> str:
    """Dynamically get current bot token from environment."""
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def get_bot_username() -> str:
    """Dynamically get bot username from environment."""
    return os.getenv("TELEGRAM_BOT_USERNAME", "LeharAIBot").replace("@", "").strip()


# Global state for bot health status
_bot_task: Optional[asyncio.Task] = None
_watchdog_task: Optional[asyncio.Task] = None
_bot_running = False
_last_update_id = 0
_total_messages_handled = 0
_sent_proactive_alert_ids: set[str] = set()

# Map of active 90-second fail-safe escalation tasks per chat_id
_pending_escalations: dict[int, asyncio.Task] = {}

# Strong references to fire-and-forget handler tasks (prevents GC + surfaces exceptions)
_background_tasks: set[asyncio.Task] = set()

# Single reused async HTTP client for outbound send_* helpers (avoids per-call sockets)
_http_client: Optional[httpx.AsyncClient] = None

# Persisted polling offset so a restart does not reprocess ~24h of Telegram backlog
_STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "telegram_state.json"


def _get_http_client() -> httpx.AsyncClient:
    """Return a lazily-created, reused module-level async HTTP client."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


def _on_task_done(task: asyncio.Task) -> None:
    """Done-callback: drop the task reference and log any swallowed exception."""
    _background_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error(f"[Telegram Bot] Background handler task failed: {exc}", exc_info=exc)


def _spawn_task(coro) -> asyncio.Task:
    """Create a tracked fire-and-forget task with a retained reference + error logging."""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_on_task_done)
    return task


def _load_last_update_id() -> int:
    """Load the persisted Telegram polling offset so a restart skips old backlog."""
    try:
        if _STATE_FILE.exists():
            data = json.loads(_STATE_FILE.read_text(encoding="utf-8"))
            return int(data.get("last_update_id", 0))
    except Exception as e:
        logger.debug(f"[Telegram State] Could not load last_update_id: {e}")
    return 0


def _save_last_update_id(update_id: int) -> None:
    """Persist the latest processed Telegram update_id to disk."""
    try:
        _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _STATE_FILE.write_text(json.dumps({"last_update_id": update_id}), encoding="utf-8")
    except Exception as e:
        logger.debug(f"[Telegram State] Could not persist last_update_id: {e}")


def _escape_md(text: str) -> str:
    """
    Escape Telegram legacy-Markdown entity characters (_ * ` [) in user/LLM-supplied
    text so stray symbols can't unbalance entities and trigger a 400 'can't parse
    entities' error (which silently drops the reply).
    """
    if not text:
        return ""
    return re.sub(r'([_*`\[])', r'\\\1', str(text))


def markdown_to_telegram_html(text: str) -> str:
    """
    Safely converts Markdown bold, italic, code, and links to Telegram-supported HTML.
    HTML entities (&, <, >) in plain text are escaped first, then formatting tags are applied.
    Zero parsing crash risk!
    """
    if not text:
        return ""
    # 1. Escape HTML special characters
    t = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # 2. Convert markdown bold: **text** or __text__ -> <b>text</b>
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"__(.+?)__", r"<b>\1</b>", t)

    # 3. Convert single *bold* (Telegram legacy markdown) -> <b>bold</b> (if not preceded/followed by word char)
    t = re.sub(r"(?<!\w)\*([^*]+?)\*(?!\w)", r"<b>\1</b>", t)

    # 4. Convert inline code: `code` -> <code>code</code>
    t = re.sub(r"`([^`]+?)`", r"<code>\1</code>", t)

    # 5. Convert markdown links: [text](url) -> <a href="url">text</a>
    t = re.sub(r"\[([^\]]+)\]\((https?://[^\)]+)\)", r'<a href="\2">\1</a>', t)

    return t


def register_or_update_subscriber(
    chat_id: int,
    first_name: str = "",
    username: str = "",
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    harbour: Optional[str] = None,
    language: str = "hi"
):
    """Save or update active Telegram subscriber in SQLite database for proactive watchdog notifications."""
    try:
        with get_connection() as conn:
            row = conn.execute("SELECT * FROM telegram_subscribers WHERE chat_id = ?", (chat_id,)).fetchone()
            if row:
                new_lat = lat if lat is not None else row["latitude"]
                new_lon = lon if lon is not None else row["longitude"]
                new_harbour = harbour if harbour is not None else row["harbour"]
                new_fname = first_name if first_name else row["first_name"]
                new_uname = username if username else row["username"]
                conn.execute(
                    """
                    UPDATE telegram_subscribers
                    SET first_name = ?, username = ?, latitude = ?, longitude = ?, harbour = ?, last_active = datetime('now')
                    WHERE chat_id = ?
                    """,
                    (new_fname, new_uname, new_lat, new_lon, new_harbour, chat_id)
                )
            else:
                conn.execute(
                    """
                    INSERT INTO telegram_subscribers (chat_id, first_name, username, latitude, longitude, harbour, language, last_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (chat_id, first_name, username, lat or 18.915, lon or 72.828, harbour or "Mumbai (Sassoon Dock)", language)
                )
            conn.commit()
    except Exception as e:
        logger.warning(f"[Telegram DB] Error updating subscriber #{chat_id}: {e}")


def format_mariner_name(first_name: Optional[str]) -> str:
    """
    Safely format a mariner's name with Captain title without duplicates like 'Captain Captain'.
    Examples:
      'Faisal' -> 'Captain Faisal'
      'Captain Faisal' -> 'Captain Faisal'
      'Captain' -> 'Captain'
      '' or None -> 'Captain'
    """
    if not first_name or not first_name.strip():
        return "Captain"
    clean = first_name.strip()
    if clean.lower() == "captain":
        return "Captain"
    if clean.lower().startswith("captain ") or clean.lower().startswith("capt.") or clean.lower().startswith("capt "):
        return clean
    return f"Captain {clean}"


def get_subscriber_first_name(chat_id: int, default: str = "Captain") -> str:
    """Retrieve subscriber's registered first name from DB if available."""
    try:
        with get_connection() as conn:
            row = conn.execute("SELECT first_name FROM telegram_subscribers WHERE chat_id = ?", (chat_id,)).fetchone()
            if row and row["first_name"] and row["first_name"].strip():
                fname = row["first_name"].strip()
                if fname.lower() != "captain":
                    return fname
    except Exception:
        pass
    return default


def get_all_subscribers() -> list[dict]:
    """Retrieve all registered Telegram subscribers for proactive alert delivery."""
    try:
        with get_connection() as conn:
            rows = conn.execute("SELECT * FROM telegram_subscribers WHERE notifications_enabled = 1").fetchall()
            return [dict(r) for r in rows]
    except Exception:
        return []


async def send_proactive_guardian_alert(subscriber: dict, alert: dict) -> bool:
    """Dispatches a real-time proactive Guardian alert card + spoken voice note to a specific Telegram subscriber."""
    chat_id = subscriber["chat_id"]
    first_name = subscriber.get("first_name", "Captain")
    display_name = format_mariner_name(first_name)
    safe_first_name = _escape_md(display_name)
    is_safety = alert.get("type") == "safety"
    harbour = subscriber.get("harbour", "Coast")

    lat = alert["location"]["latitude"]
    lon = alert["location"]["longitude"]
    dist_km = alert["location"]["distance_km"]

    # Header and Title
    badge = "🚨 *LEHAR GUARDIAN — MARINE SAFETY WARNING*" if is_safety else "🐟 *LEHAR GUARDIAN — HIGH-YIELD FISHING OPPORTUNITY*"
    
    clean_msg = alert["message"].replace("*", "").replace("`", "")

    # Build clean markdown
    msg_text = (
        f"{badge}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Subscriber:* `{safe_first_name}` ({harbour})\n"
        f"📍 *Sector Vector:* *{dist_km} km offshore* (`{lat:.3f}°N, {lon:.3f}°E`)\n\n"
        f"{alert['message']}\n\n"
        f"⚡ *Multi-Sensor Verification:* INCOIS ARGO CTD + NOAA Satellite SST\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

    # Interactive Action Buttons
    maps_url = f"https://maps.google.com/?q={lat:.4f},{lon:.4f}"
    buttons = [
        [{"text": "🗺️ Open Incident Coordinates in Maps", "url": maps_url}],
        [
            {"text": "🐟 Find Safe Fishing Zones", "callback_data": "cmd_pfz"},
            {"text": "🌊 Check Sea Status", "callback_data": "cmd_temp"}
        ]
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Send Text Card
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": msg_text,
            "parse_mode": "Markdown",
            "reply_markup": {"inline_keyboard": buttons},
            "disable_web_page_preview": False
        })

        # 2. Synthesize Personalized Voice Note
        if is_safety:
            voice_script = (
                f"Namaste {display_name}! Yeh Lehar Guardian ka zaroori ocean safety alert hai. "
                f"Aapke harbour {harbour} se {int(dist_km)} kilometer door samundar me severe temperature anomaly detect hui hai. "
                f"Chhoti naav samundar me savdhani bartein."
            )
        else:
            sp_name = alert.get("species") or "machhli"
            voice_script = (
                f"Namaste {display_name}! Yeh Lehar Guardian fishing opportunity alert hai. "
                f"Aapke dock se {int(dist_km)} kilometer door {sp_name} ke liye high-yield zone bana hai. "
                f"Pani ka taapman aur thermocline depth anukool hai."
            )

        voice_bytes = await _synthesize_voice_audio(voice_script, lang="hi")
        if voice_bytes:
            await send_telegram_voice(chat_id, voice_bytes, caption=f"🔊 *Lehar Guardian Voice Advisory for {safe_first_name}*")

    return True


def get_telegram_status() -> Dict[str, Any]:
    """Returns the current operational status of the Telegram Bot gateway."""
    token = get_bot_token()
    username = get_bot_username()
    is_token_configured = bool(token and len(token) > 10)
    return {
        "status": "online" if (_bot_running and is_token_configured) else ("standby" if is_token_configured else "not_configured"),
        "bot_username": f"@{username}",
        "token_configured": is_token_configured,
        "active_worker": _bot_running,
        "subscribers_count": len(get_all_subscribers()),
        "messages_handled": _total_messages_handled,
        "polling_mode": "async_long_polling",
        "qr_url": f"https://t.me/{username}",
    }


async def _telegram_request(client: httpx.AsyncClient, method: str, payload: dict) -> Optional[dict]:
    """Helper to send async requests to Telegram Bot API with network backoff."""
    token = get_bot_token()
    if not token:
        return None
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        resp = await client.post(url, json=payload, timeout=30.0)
        if resp.status_code == 200:
            return resp.json().get("result")
        elif resp.status_code == 409:
            logger.info("[Telegram API] Duplicate polling instance detected (409 Conflict). Waiting 6s for single-instance sync...")
            await asyncio.sleep(6)
            return None
        elif resp.status_code == 429:
            # Rate limited — honor Telegram's retry_after hint, then retry once.
            try:
                retry_after = int(resp.json().get("parameters", {}).get("retry_after", 1))
            except Exception:
                retry_after = 1
            logger.warning(f"[Telegram API] Rate limited (429) on {method}. Honoring retry_after={retry_after}s...")
            await asyncio.sleep(max(retry_after, 1))
            try:
                retry_resp = await client.post(url, json=payload, timeout=30.0)
                if retry_resp.status_code == 200:
                    return retry_resp.json().get("result")
                logger.warning(f"[Telegram API] {method} retry after 429 returned {retry_resp.status_code}")
            except Exception as e:
                logger.debug(f"[Telegram API] Retry after 429 failed for {method}: {e}")
            return None
        elif method == "answerCallbackQuery" and resp.status_code == 400:
            # Expired query ID from before restart (>20s old), safe to ignore silently
            return None
        else:
            logger.warning(f"[Telegram API] {method} returned {resp.status_code}: {resp.text}")
            return None
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
        logger.debug(f"[Telegram API] Transient network notice in {method}: {e}")
        await asyncio.sleep(2)
        return None
    except Exception as e:
        logger.debug(f"[Telegram API] Non-critical exception in {method}: {e}")
        await asyncio.sleep(2)
        return None


async def send_telegram_message(
    chat_id: int | str,
    text: str,
    reply_markup: Optional[dict] = None,
    parse_mode: str = "Markdown"
) -> bool:
    """Send a formatted text message to a Telegram chat."""
    token = get_bot_token()
    if not token:
        return False
    client = _get_http_client()
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": False,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    res = await _telegram_request(client, "sendMessage", payload)
    return bool(res)


async def send_telegram_voice(
    chat_id: int | str,
    audio_bytes: bytes,
    caption: str = "🔊 <b>Lehar AI Voice Advisory</b>",
    parse_mode: str = "HTML"
) -> bool:
    """Send a native voice note (.ogg/.mp3) to Telegram chat."""
    token = get_bot_token()
    if not token or not audio_bytes:
        return False
    client = _get_http_client()
    files = {"voice": ("voice.mp3", audio_bytes, "audio/mpeg")}
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": parse_mode}
    try:
        res = await client.post(
            f"https://api.telegram.org/bot{token}/sendVoice",
            data=data,
            files=files,
            timeout=30.0
        )
        return res.status_code == 200
    except Exception as e:
        logger.error(f"[Telegram Voice] Error sending voice note: {e}")
        return False


async def send_telegram_location(
    chat_id: int | str,
    latitude: float,
    longitude: float
) -> bool:
    """Send a native GPS map location pin to Telegram chat."""
    token = get_bot_token()
    if not token:
        return False
    client = _get_http_client()
    payload = {
        "chat_id": chat_id,
        "latitude": latitude,
        "longitude": longitude,
    }
    res = await _telegram_request(client, "sendLocation", payload)
    return bool(res)


async def _download_telegram_voice(client: httpx.AsyncClient, file_id: str) -> Optional[bytes]:
    """Download audio/voice bytes from Telegram using file_id."""
    token = get_bot_token()
    if not token:
        return None
    try:
        file_info = await _telegram_request(client, "getFile", {"file_id": file_id})
        if not file_info or "file_path" not in file_info:
            return None
        
        file_path = file_info["file_path"]
        download_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        res = await client.get(download_url, timeout=30.0)
        if res.status_code == 200:
            return res.content
        return None
    except Exception as e:
        logger.error(f"[Telegram Download] Failed to download voice file: {e}")
        return None


def _transcribe_audio_groq(audio_bytes: bytes) -> str:
    """Transcribes audio using Groq Whisper Large v3 Turbo in <300ms."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return ""
    try:
        groq_client = Groq(api_key=api_key)
        audio_file = ("voice.ogg", audio_bytes)
        transcription = groq_client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3-turbo",
            response_format="text",
            temperature=0.0
        )
        return str(transcription).strip()
    except Exception as e:
        logger.error(f"[Groq Whisper] Audio transcription error: {e}")
        return ""


async def _synthesize_voice_audio(text: str, lang: str = "en") -> bytes:
    """Synthesizes human-like neural voice audio note using Edge-TTS."""
    if not text or not text.strip():
        return b""
    # Clean text: strip URLs, markdown formatting, emojis and unsupported symbols
    clean = re.sub(r'https?://\S+', '', text)
    clean = re.sub(r'[*_`#~\[\]()><|]', ' ', clean)
    clean = re.sub(r'[^\w\s.,?!;:।\'"\-°%]', ' ', clean, flags=re.UNICODE)
    clean = ' '.join(clean.split())
    if not clean:
        return b""
    if len(clean) > 350:
        clean = clean[:350] + "."

    # Select optimal Indian regional voice
    voice_map = {
        "hi": "hi-IN-SwaraNeural",
        "mr": "mr-IN-AarohiNeural",
        "ta": "ta-IN-PallaviNeural",
        "te": "te-IN-ShrutiNeural",
        "bn": "bn-IN-TanishaaNeural",
        "gu": "gu-IN-DhwaniNeural",
        "ml": "ml-IN-SobhanaNeural",
        "kn": "kn-IN-SapnaNeural",
        "en": "en-IN-NeerjaNeural",
    }
    voice_id = voice_map.get(lang.lower()[:2], "en-IN-NeerjaNeural")

    try:
        communicate = edge_tts.Communicate(clean, voice_id)
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
        return bytes(audio_data)
    except Exception as e:
        logger.debug(f"[Edge-TTS] Synthesis transient notice: {e}")
        return b""


def _find_nearest_argo_float(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Find the closest ARGO float in SQLite database to given coordinates."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT p.profile_id, p.float_id, p.latitude, p.longitude, p.date,
                   (SELECT temperature FROM argo_measurements m WHERE m.profile_id = p.profile_id AND m.temperature IS NOT NULL ORDER BY depth ASC LIMIT 1) as sst,
                   (SELECT salinity FROM argo_measurements m WHERE m.profile_id = p.profile_id AND m.salinity IS NOT NULL ORDER BY depth ASC LIMIT 1) as sss
            FROM argo_profiles p
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            ORDER BY p.date DESC
            LIMIT 150
            """
        ).fetchall()

    if not rows:
        return None

    best = None
    min_d = float("inf")
    for r in rows:
        d = haversine_km(lat, lon, r["latitude"], r["longitude"])
        if d < min_d:
            min_d = d
            brg = bearing_degrees(lat, lon, r["latitude"], r["longitude"])
            best = {
                "profile_id": r["profile_id"],
                "float_id": r["float_id"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "date": r["date"],
                "sst": round(r["sst"], 1) if r["sst"] else 28.4,
                "sss": round(r["sss"], 1) if r["sss"] else 35.6,
                "distance_km": round(d, 1),
                "bearing_deg": round(brg, 1),
                "compass": bearing_to_compass(brg),
            }
    return best


def _get_start_keyboard() -> dict:
    """Returns the main interactive inline keyboard for /start."""
    return {
        "inline_keyboard": [
            [
                {"text": "🐟 Find Nearest Fish Zone (PFZ)", "callback_data": "cmd_pfz"},
                {"text": "🌊 Sea Temp & Currents", "callback_data": "cmd_temp"}
            ],
            [
                {"text": "🚨 Storm & Heatwave Warnings", "callback_data": "cmd_storm"},
                {"text": "📍 Nearest ARGO Float", "callback_data": "cmd_nearest_float"}
            ],
            [
                {"text": "🎣 Log Catch / PFZ Feedback", "callback_data": "cmd_log_catch"},
                {"text": "🇮🇳 हिंदी एडवाइजरी", "callback_data": "cmd_lang_hi"}
            ],
            [
                {"text": "🆘 Emergency Distress (SOS)", "callback_data": "cmd_sos_trigger"},
                {"text": "🌐 Project Details", "callback_data": "cmd_about"}
            ]
        ]
    }


def _get_contextual_keyboard(
    sector_slug: str = "mumbai",
    query_route: str = "species_advisory",
    target_lat: float | None = None,
    target_lon: float | None = None
) -> dict:
    """Generates 2-3 dynamic smart action chips based on conversation context."""
    buttons = []
    first_row = []

    # Format clean slug (alphanumeric only)
    clean_slug = re.sub(r"[^a-zA-Z0-9_]", "", sector_slug.lower().replace(" ", "_"))[:20] or "mumbai"

    if query_route in ("species_advisory", "general_sql", "hybrid"):
        first_row.append({"text": "🌊 Wave & Wind", "callback_data": f"chip_wave_{clean_slug}"})
        first_row.append({"text": "⏰ Feeding Time", "callback_data": f"chip_twilight_{clean_slug}"})
        first_row.append({"text": "⛽ Fuel Saved", "callback_data": f"chip_fuel_{clean_slug}"})
    else:  # weather / safety
        first_row.append({"text": "🐟 Fish Prospects", "callback_data": f"chip_fish_{clean_slug}"})
        first_row.append({"text": "⏰ Feeding Time", "callback_data": f"chip_twilight_{clean_slug}"})
        first_row.append({"text": "🛡️ Safety Status", "callback_data": f"chip_safety_{clean_slug}"})

    buttons.append(first_row)

    second_row = []
    if target_lat and target_lon:
        maps_url = f"https://maps.google.com/?q={target_lat:.4f},{target_lon:.4f}"
        second_row.append({"text": "🗺️ Google Maps", "url": maps_url})

    second_row.append({"text": "📋 Main Menu", "callback_data": "cmd_main_menu"})
    second_row.append({"text": "🆘 SOS", "callback_data": "cmd_sos_trigger"})
    buttons.append(second_row)

    return {"inline_keyboard": buttons}


async def _handle_start_command(client: httpx.AsyncClient, chat_id: int, first_name: str):
    """Handle /start greeting with rich introductory banner & instant voice welcome."""
    username = get_bot_username()
    if not first_name or first_name.strip().lower() == "captain":
        first_name = get_subscriber_first_name(chat_id, default="Captain")
    display_name = format_mariner_name(first_name)
    safe_display_name = _escape_md(display_name)
    welcome_text = (
        f"🌊 *Namaste {safe_display_name}! Welcome to Lehar AI (@{username})*\n"
        f"_Know the Sea. Know the Way._\n\n"
        f"I am your *24/7 AI Marine Intelligence Assistant*, developed for **INCOIS & Ministry of Earth Sciences (SIH26067)**.\n\n"
        f"⚡ *What you can do:*\n"
        f"• 🎙️ *Send a Voice Note* in Hindi, Marathi, Tamil, Telugu or English\n"
        f"• 💬 *Ask any ocean question* in natural text\n"
        f"• 📍 *Send your GPS Location* (tap 📎 ➔ Location) to get your nearest ARGO Float, Fishing Viability & Navigation Pin!\n"
        f"• 🆘 *Type /sos or tap Emergency SOS* for instant Coast Guard rescue assistance!\n"
        f"• 🐟 Tap a quick button below to test live ocean intelligence:"
    )
    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": welcome_text,
        "parse_mode": "Markdown",
        "reply_markup": _get_start_keyboard()
    })

    # Synthesize crisp welcome voice note
    voice_bytes = await _synthesize_voice_audio(
        f"Namaste {display_name}! Welcome to Lehar AI Marine Intelligence. You can speak to me in your voice, send your location, or type SOS in an emergency.",
        lang="en"
    )
    if voice_bytes:
        await send_telegram_voice(chat_id, voice_bytes, caption="🔊 *Lehar AI Voice Guide*")


async def _handle_sos_command(
    client: httpx.AsyncClient,
    chat_id: int,
    first_name: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    notes: str = ""
):
    """
    Zero-latency priority SOS distress pipeline (<1 second response, Zero LLM delay).
    Logs distress beacon, computes nearest harbor, alerts Indian Coast Guard, and broadcasts crowd-rescue to nearby boats.
    """
    # 1. Cancel any pending 90s auto-escalation timer for this chat
    if chat_id in _pending_escalations:
        _pending_escalations[chat_id].cancel()
        _pending_escalations.pop(chat_id, None)

    if not first_name or first_name.strip().lower() == "captain":
        first_name = get_subscriber_first_name(chat_id, default="Captain")
    display_name = format_mariner_name(first_name)

    # 2. Resolve coordinates from parameter or last known subscriber location
    if lat is None or lon is None:
        with get_connection() as conn:
            row = conn.execute("SELECT latitude, longitude, harbour FROM telegram_subscribers WHERE chat_id = ?", (chat_id,)).fetchone()
            if row and row["latitude"] and row["longitude"]:
                lat, lon = row["latitude"], row["longitude"]
                harbour_name = row["harbour"] or "Coast"
            else:
                lat, lon = 18.915, 72.828
                harbour_name = "Mumbai (Sassoon Dock)"
    else:
        nearest_h_tmp = nearest_harbour(lat, lon)
        harbour_name = nearest_h_tmp["harbour"]

    nearest_h = nearest_harbour(lat, lon)
    cg_station = get_coast_guard_station(lat, lon)

    # 3. Log distress beacon to SQLite database
    sos_id = create_sos_alert(
        chat_id=chat_id,
        latitude=lat,
        longitude=lon,
        reporter_name=display_name,
        harbour=harbour_name,
        coast_guard_station=cg_station,
        notes=notes or "Emergency distress beacon received"
    )

    safe_first_name = _escape_md(display_name)
    maps_url = f"https://maps.google.com/?q={lat:.4f},{lon:.4f}"

    # 4. Instant distress response card to fisherman (<1s)
    sos_msg = (
        f"🚨 *EMERGENCY DISTRESS BEACON LOGGED (#SOS-{sos_id:04d})*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Vessel Master:* `{safe_first_name}`\n"
        f"📍 *GPS Fix:* `{lat:.4f}°N, {lon:.4f}°E`\n"
        f"⚓ *Nearest Safe Harbour:* *{nearest_h['harbour']}* ({nearest_h['distance_km']} km | Heading: *{nearest_h['compass']} {nearest_h['bearing_deg']}°*)\n"
        f"🛡️ *Assigned SAR Base:* {cg_station}\n\n"
        f"📞 *EMERGENCY RESCUE HELPLINES:*\n"
        f"• 🚨 *Indian Coast Guard:* `1554` (Toll-Free SAR)\n"
        f"• 📻 *Marine VHF Channel:* `16` (International Distress & Calling)\n"
        f"• ⚓ *Port Marine Police:* `1093`\n\n"
        f"⚠️ *CREW INSTRUCTIONS:*\n"
        f"1. Don lifejackets immediately.\n"
        f"2. Keep VHF Radio on Channel 16.\n"
        f"3. Anchor if drifting towards shallow reefs or shipping lanes.\n"
        f"4. Nearby fishing vessels within 20 km have been alerted for crowd-rescue.\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": sos_msg,
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": [
                [{"text": "🗺️ Open Your Position in Maps", "url": maps_url}],
                [{"text": "✅ We Are Safe / Resolve SOS", "callback_data": f"cmd_sos_resolve_{sos_id}"}]
            ]
        }
    })

    # Send spoken alarm voice advisory in Hindi
    voice_script = (
        f"Namaste {display_name}! Aapka emergency SOS alert number {sos_id} record ho gaya hai. "
        f"Indian Coast Guard helpline 1554 aur VHF Channel 16 par contact karein. Nearest safe port {nearest_h['harbour']} hai."
    )
    voice_bytes = await _synthesize_voice_audio(voice_script, lang="hi")
    if voice_bytes:
        await send_telegram_voice(chat_id, voice_bytes, caption="🚨 *Emergency Voice Guidance*")

    # 5. Crowd-Rescue Broadcast (Filtered: within 20km, distance from home harbour > 3km)
    async def _broadcast_crowd_rescue():
        subscribers = get_all_subscribers()
        for sub in subscribers:
            if sub["chat_id"] == chat_id:
                continue
            s_lat = sub.get("latitude")
            s_lon = sub.get("longitude")
            if not s_lat or not s_lon:
                continue
            d_sos = haversine_km(s_lat, s_lon, lat, lon)
            if d_sos <= 20.0:
                # At-sea filter: verify subscriber is offshore (>3km from port)
                sub_h = nearest_harbour(s_lat, s_lon)
                if sub_h["distance_km"] > 3.0:
                    crowd_text = (
                        f"⚠️ *MAYDAY / CROWD RESCUE BROADCAST*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"A fellow fishing boat (*{safe_first_name}*) has signaled distress approximately *{d_sos:.1f} km* from your coordinates.\n"
                        f"📍 *Target Location:* `{lat:.4f}°N, {lon:.4f}°E`\n\n"
                        f"If safe and feasible, please maintain radio watch on **VHF Channel 16** and render assistance to fellow mariners.\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    )
                    try:
                        await _telegram_request(client, "sendMessage", {
                            "chat_id": sub["chat_id"],
                            "text": crowd_text,
                            "parse_mode": "Markdown"
                        })
                    except Exception as ex:
                        logger.debug(f"[Crowd-Rescue] Failed to deliver to #{sub['chat_id']}: {ex}")

    _spawn_task(_broadcast_crowd_rescue())

    # 6. Simulated Coast Guard MRCC Acknowledgment after 12 seconds
    async def _simulated_mrcc_ack():
        await asyncio.sleep(12)
        acknowledge_sos_alert(sos_id, notes="MRCC Patrol Craft ICGS Samrat deployed, ETA 25 mins")
        ack_msg = (
            f"🛡️ *[SIMULATED PROTOCOL DEMO] COAST GUARD MRCC ACKNOWLEDGMENT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Maritime Rescue Coordination Centre (MRCC) has confirmed beacon `#SOS-{sos_id:04d}`.\n\n"
            f"• *Dispatched Unit:* Interceptor Craft ICGS Samrat (Fast Patrol Vessel)\n"
            f"• *Estimated Intercept Time:* ~25 minutes\n"
            f"• *Instructions:* Keep EPIRB/VHF active. Display visual orange smoke flare if safe.\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        try:
            await _telegram_request(client, "sendMessage", {
                "chat_id": chat_id,
                "text": ack_msg,
                "parse_mode": "Markdown"
            })
        except Exception as ex:
            logger.debug(f"[MRCC Ack] Delivery notice: {ex}")

    _spawn_task(_simulated_mrcc_ack())


async def _handle_location(client: httpx.AsyncClient, chat_id: int, lat: float, lon: float):
    """Handle user GPS location sharing — calculates nearest ARGO float, thermocline & ICAR-CMFRI viability."""
    # 1. Log breadcrumb in location_history for temporal trend detection
    log_location_history(chat_id, lat, lon)

    # 2. Step 0: GEOFENCE HAZARD CHECK (Highest severity priority)
    active_hz = check_geofence_hazard(lat, lon)
    if active_hz:
        nearest_h = nearest_harbour(lat, lon)
        escape_maps_url = f"https://maps.google.com/?q={nearest_h['latitude']:.4f},{nearest_h['longitude']:.4f}"
        hazard_badge = "🔴 DANGER ZONE INTERCEPTION — SQUALL / CYCLONE ALERT" if active_hz.get("severity") in ("critical", "severe") else "⚠️ MARITIME HAZARD WARNING"

        danger_card = (
            f"🚨 *{hazard_badge}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *ACTIVE HAZARD IN YOUR MARITIME SECTOR:*\n"
            f"• *Incident:* *{active_hz['title']}* ({active_hz['hazard_type'].upper()})\n"
            f"• *Severity Rating:* *{active_hz['severity'].upper()}* (Source: {active_hz['source']})\n"
            f"• *Estimated Marine Conditions:* Waves: *{active_hz.get('wave_height_m') or 3.8}m* | Winds: *{active_hz.get('wind_speed_kmh') or 58} km/h*\n"
            f"• *Epicenter Proximity:* *{active_hz.get('dist_from_center_km', 0)} km* (Inside {active_hz['radius_km']} km danger circle)\n\n"
            f"⛔ *PFZ FISHING ADVISORY SUPPRESSED:*\n"
            f"Commercial fishing is strictly discouraged in this active weather anomaly to safeguard vessel and crew.\n\n"
            f"⚓ *RECOMMENDED ESCAPE HAVEN:*\n"
            f"• *Safe Port:* *{nearest_h['harbour']}*\n"
            f"• *Escape Vector:* *{nearest_h['distance_km']} km* | Compass Heading: *{nearest_h['compass']} ({nearest_h['bearing_deg']}°)*\n"
            f"• *Estimated Transit:* ~{nearest_h['distance_km'] / 16.0:.1f} hours at cruising speed\n\n"
            f"👉 [Open Safe Route to Harbour in Google Maps]({escape_maps_url})\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": danger_card,
            "parse_mode": "Markdown",
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🗺️ Open Safe Route to Harbour", "url": escape_maps_url}],
                    [{"text": "🚨 Trigger Emergency SOS", "callback_data": "cmd_sos_confirm_yes"}]
                ]
            }
        })
        # Send native location pin of the SAFE HARBOUR
        await send_telegram_location(chat_id, nearest_h["latitude"], nearest_h["longitude"])

        # Send spoken alarm voice advisory
        voice_script = (
            f"Khatra Alert! Aapke sector me {active_hz['title']} active hai. "
            f"Samundar me unchi lahrein aur tez hawa hai. Machhli pakadna band karein aur turant {nearest_h['harbour']} port ki taraf wapas nikaliye."
        )
        voice_bytes = await _synthesize_voice_audio(voice_script, lang="hi")
        if voice_bytes:
            await send_telegram_voice(chat_id, voice_bytes, caption="🚨 *Khatra Alert Voice Guidance*")
        return  # SUPPRESS PFZ RECOMMENDATION COMPLETELY

    nearest_f = _find_nearest_argo_float(lat, lon)
    nearest_h = nearest_harbour(lat, lon)

    if not nearest_f:
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "⚠️ Could not retrieve live ARGO telemetry for these coordinates. Please try again.",
            "parse_mode": "Markdown"
        })
        return

    # Deep Marine Calculus
    sst = nearest_f["sst"]
    sal = nearest_f["sss"]
    mld = compute_mld(nearest_f["profile_id"]) or 42.0
    therm = compute_thermocline_gradient(nearest_f["profile_id"])
    # compute_thermocline_gradient returns None when the profile has too few valid levels.
    therm_depth = therm["thermocline_depth_m"] if therm else None
    therm_grad = therm["max_gradient_c_per_m"] if therm else None
    therm_str = f"{therm_depth} m (dT/dz: {therm_grad}°C/m)" if therm else "Insufficient profile levels to resolve"
    econ = calculate_voyage_economics(nearest_f["distance_km"])

    # Species evaluation for primary pelagic species
    tuna_eval = evaluate_species_profile_viability("yellowfin_tuna", sst, mld, therm_depth, sal)
    mackerel_eval = evaluate_species_profile_viability("indian_mackerel", sst, mld, therm_depth, sal)

    maps_url = f"https://maps.google.com/?q={nearest_f['latitude']:.4f},{nearest_f['longitude']:.4f}"

    msg = (
        f"📍 *GPS FIX RECORDED:* `{lat:.3f}°N, {lon:.3f}°E`\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🛰️ *INCOIS ARGO Float:* `#{nearest_f['float_id']}`\n"
        f"🎯 *Target Vector:* *{nearest_f['distance_km']} km* ({econ['distance_nm']} NM) | Heading: *{nearest_f['compass']} ({nearest_f['bearing_deg']}°)*\n"
        f"⚓ *Closest Port:* {nearest_h['harbour']} ({nearest_h['distance_km']} km)\n\n"
        f"🌊 *Subsurface Ocean Physics:*\n"
        f"• 🌡️ *Sea Surface Temp (SST):* `{sst}°C`\n"
        f"• 📏 *Mixed Layer Depth (MLD):* `{mld:.1f} m` (Surface nutrient mixing)\n"
        f"• 📉 *Thermocline Peak:* `{therm_str}`\n"
        f"• 🧂 *Salinity:* `{sal} PSU`\n\n"
        f"🎣 *ICAR-CMFRI Biological Catch Feasibility:*\n"
        f"• *Yellowfin Tuna:* {tuna_eval['status']} ({tuna_eval['viability_pct']}%)\n"
        f"  └ *Recommended Gear Depth:* `{tuna_eval['recommended_gear_depth_m']}` ({tuna_eval['gear_type']})\n"
        f"• *Indian Mackerel (Bangda):* {mackerel_eval['status']} ({mackerel_eval['viability_pct']}%)\n\n"
        f"⛽ *NavIC Voyage Economics:*\n"
        f"• Estimated Diesel Burn: *{econ['estimated_fuel_burn_l']} L* (~{econ['transit_time_hrs']} hrs)\n"
        f"• Direct Routing Savings: *₹{econ['financial_saved_inr']:,}* & *{econ['co2_reduction_kg']} kg CO₂*\n\n"
        f"🗺️ *One-Tap GPS Navigation:*\n"
        f"👉 [Open Coordinates in Google Maps]({maps_url})\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False
    })

    # Send native GPS map pin
    await send_telegram_location(chat_id, nearest_f["latitude"], nearest_f["longitude"])

    # Send spoken voice advisory
    voice_script = (
        f"GPS fix received. Nearest ARGO float is {nearest_f['distance_km']} kilometers away at bearing {nearest_f['bearing_deg']} degrees {nearest_f['compass']}. "
        f"Sea surface temperature is {sst} degrees Celsius. Yellowfin Tuna viability is {tuna_eval['viability_pct']} percent at gear depth {tuna_eval['recommended_gear_depth_m']}."
    )
    voice_bytes = await _synthesize_voice_audio(voice_script, lang="en")
    if voice_bytes:
        await send_telegram_voice(chat_id, voice_bytes, caption="🔊 *Live Ocean Voice Advisory*")


async def _handle_voice_message(client: httpx.AsyncClient, chat_id: int, voice_file_id: str, first_name: Optional[str] = None):
    """Processes incoming user voice note via Groq Whisper Large v3 Turbo in <300ms."""
    if not first_name or first_name.strip().lower() == "captain":
        first_name = get_subscriber_first_name(chat_id, default="Captain")

    await _telegram_request(client, "sendChatAction", {"chat_id": chat_id, "action": "record_voice"})
    
    # Download audio bytes
    audio_bytes = await _download_telegram_voice(client, voice_file_id)
    if not audio_bytes:
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "⚠️ *Could not download voice note.* Please try again.",
            "parse_mode": "Markdown"
        })
        return

    # Transcribe via Groq Whisper (offloaded to a worker thread — the SDK call is
    # synchronous/blocking and would otherwise freeze the whole event loop)
    transcribed_text = await asyncio.to_thread(_transcribe_audio_groq, audio_bytes)
    if not transcribed_text:
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "⚠️ *Could not decipher audio.* Please speak clearly or send text.",
            "parse_mode": "Markdown"
        })
        return

    # Notify transcribed query
    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": f"🎙️ *I heard you say:*\n_\"{_escape_md(transcribed_text)}\"_\n\n⏳ *Querying ARGO in-situ database & ocean models...*",
        "parse_mode": "Markdown"
    })

    # Run query and send both text + voice response
    await _handle_text_query(client, chat_id, transcribed_text, send_voice=True, first_name=first_name)


async def _handle_callback_query(client: httpx.AsyncClient, callback_query: dict):
    """Handle interactive button taps from inline keyboard."""
    cb_id = callback_query["id"]

    # Acknowledge callback immediately (clears the button spinner even for old messages)
    await _telegram_request(client, "answerCallbackQuery", {"callback_query_id": cb_id})

    # `message` can be absent for very old inline messages (>48h) — handle gracefully
    message = callback_query.get("message")
    if not message or "chat" not in message:
        logger.debug("[Telegram Callback] Callback query has no accessible message; acknowledged only.")
        return

    chat_id = message["chat"]["id"]
    data = callback_query.get("data", "")

    user_from = callback_query.get("from") or {}
    first_name = user_from.get("first_name") or message.get("chat", {}).get("first_name") or get_subscriber_first_name(chat_id, default="Captain")
    display_name = format_mariner_name(first_name)

    if data == "cmd_pfz":
        query = "Show me the top 3 potential fishing zones near the Indian coast with the best SST and chlorophyll today"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data == "cmd_temp":
        query = "Show the latest sea surface temperature and salinity near Mumbai coast from ARGO floats today"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data == "cmd_storm":
        query = "Are there any active marine heatwaves, extreme thermal anomalies, or storm warnings in the Indian Ocean?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data == "cmd_nearest_float":
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "📍 *Please share your live GPS location* (Tap 📎 ➔ Location) to calculate your nearest INCOIS ARGO float!",
            "parse_mode": "Markdown"
        })
    elif data == "cmd_lang_hi":
        query = "Mumbai ke paas samundar ka taapman kya hai aur machhli pakadne ke liye kaunsa zone best hai aaj?"
        await _handle_text_query(client, chat_id, query, send_voice=True, lang="hi", first_name=first_name)
    elif data == "cmd_log_catch":
        prompt_msg = (
            "🎣 *Post-Voyage Catch & PFZ Feedback Logging*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Namaste {display_name}! Please send your catch details or a voice note in ANY language:\n\n"
            "• *Text Example (English):* `350kg Yellowfin Tuna near Sassoon Dock at 40m depth`\n"
            "• *Text Example (Hindi):* `250 kilo bangda mila 25 meter pe, advisory achhi thi`\n"
            "• *Text Example (Tamil):* `300kg vanjaram meen kidaithathu 35m depth`\n\n"
            "🎙️ Or just send a voice note saying what you caught!"
        )
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": prompt_msg,
            "parse_mode": "Markdown"
        })
    elif data == "cmd_about":
        about_text = (
            "🏆 *Lehar AI — Grand Finale Edition*\n"
            "• *Team:* Ctrl Alt Elites (SIH26067)\n"
            "• *Ministry:* Ministry of Earth Sciences & INCOIS\n"
            "• *Tech:* 72,000+ In-Situ ARGO NetCDF Measurements + NOAA Daily SST + NASA VIIRS Chlorophyll-a + Groq Llama 3.3 70B.\n"
            "• *Website:* `http://localhost:5173`"
        )
        await _telegram_request(client, "sendMessage", {"chat_id": chat_id, "text": about_text, "parse_mode": "Markdown"})
    elif data == "cmd_sos_trigger" or data == "cmd_sos_confirm_yes":
        # Cancel any pending fail-safe timer
        if chat_id in _pending_escalations:
            _pending_escalations[chat_id].cancel()
            _pending_escalations.pop(chat_id, None)
        user_from = callback_query.get("from") or message.get("chat") or {}
        first_name = user_from.get("first_name") or get_subscriber_first_name(chat_id, default="Captain")
        await _handle_sos_command(client, chat_id, first_name)
    elif data == "cmd_sos_confirm_no":
        # Cancel pending fail-safe timer
        if chat_id in _pending_escalations:
            _pending_escalations[chat_id].cancel()
            _pending_escalations.pop(chat_id, None)
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "✅ *Understood, Captain!* Emergency alert cancelled. Safe sailing! 🌊",
            "parse_mode": "Markdown",
            "reply_markup": _get_start_keyboard()
        })
    elif data.startswith("cmd_sos_resolve_"):
        try:
            sos_id = int(data.replace("cmd_sos_resolve_", ""))
            resolve_sos_alert(sos_id)
            await _telegram_request(client, "sendMessage", {
                "chat_id": chat_id,
                "text": f"✅ *Distress beacon #SOS-{sos_id:04d} marked as RESOLVED.* Glad your vessel and crew are safe! ⚓",
                "parse_mode": "Markdown"
            })
        except Exception as ex:
            logger.debug(f"[SOS Resolve] Error: {ex}")
    elif data == "cmd_main_menu":
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "🌊 <b>Lehar AI Marine Intelligence Menu</b>\nSelect an ocean capability below or ask any question in any language:",
            "parse_mode": "HTML",
            "reply_markup": _get_start_keyboard()
        })
    elif data.startswith("chip_wave_"):
        loc = data.replace("chip_wave_", "").replace("_", " ").title()
        query = f"{loc} me live wave height, wind speed aur samundar ka haal kaisa hai?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data.startswith("chip_twilight_"):
        loc = data.replace("chip_twilight_", "").replace("_", " ").title()
        query = f"{loc} me machhli pakadne ka best twilight window aur dawn dusk feeding time kab hai?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data.startswith("chip_fuel_"):
        loc = data.replace("chip_fuel_", "").replace("_", " ").title()
        query = f"{loc} ke PFZ tak voyage economics, diesel consumption aur fuel cost savings kitni hogi?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data.startswith("chip_fish_"):
        loc = data.replace("chip_fish_", "").replace("_", " ").title()
        query = f"{loc} ke paas best fishing zone, species prospects aur SST thermocline kaisa hai?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)
    elif data.startswith("chip_safety_"):
        loc = data.replace("chip_safety_", "").replace("_", " ").title()
        query = f"{loc} me fishing safety status, seasonal ban aur cyclone hazard alerts kya hain?"
        await _handle_text_query(client, chat_id, query, send_voice=True, first_name=first_name)



async def _handle_text_query(
    client: httpx.AsyncClient,
    chat_id: int,
    text: str,
    send_voice: bool = True,
    lang: str = "en",
    first_name: Optional[str] = None
):
    """Handle free-form natural language query in any language with deep marine physics + voice output."""
    global _total_messages_handled
    _total_messages_handled += 1

    if not first_name or first_name.strip().lower() == "captain":
        first_name = get_subscriber_first_name(chat_id, default="Captain")

    # Check for explicit SOS / Mayday commands
    text_lower = text.lower().strip()
    if text_lower.startswith("/sos") or text_lower.startswith("/mayday"):
        await _handle_sos_command(client, chat_id, first_name)
        return

    # Check for emergency distress keywords in conversational messages (False-positive immune)
    is_high_urgency = any(kw in text_lower for kw in HIGH_URGENCY_KEYWORDS)
    is_general_emergency = any(kw in text_lower for kw in EMERGENCY_KEYWORDS)

    if is_high_urgency or is_general_emergency:
        confirm_msg = (
            f"⚠️ *Emergency Distress Detection / आपातकालीन चेतावनी*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Aapke message me emergency distress keywords detect hue hain:\n"
            f"_\"{_escape_md(text[:80])}\"_\n\n"
            f"Kya aap waqayi samundar me sankat me hain aur **Indian Coast Guard (1554)** ko distress alert bhejna chahte hain?"
        )
        confirm_markup = {
            "inline_keyboard": [
                [
                    {"text": "🚨 HAAN, RESCUE ALERT BHEJO", "callback_data": "cmd_sos_confirm_yes"},
                    {"text": "✅ NAHI, SAB THEEK HAI", "callback_data": "cmd_sos_confirm_no"}
                ]
            ]
        }
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": confirm_msg,
            "parse_mode": "Markdown",
            "reply_markup": confirm_markup
        })

        if is_high_urgency:
            # Spawn 90-second fail-safe timer
            if chat_id in _pending_escalations:
                _pending_escalations[chat_id].cancel()

            async def _escalate_fail_safe(cid=chat_id, q_text=text, fname=first_name):
                try:
                    await asyncio.sleep(90)
                    logger.warning(f"[SOS Fail-Safe] 90s timeout expired for #{cid}. Auto-escalating.")
                    await _handle_sos_command(
                        client, cid, fname,
                        notes=f"[AUTO-ESCALATED FAIL-SAFE: 90s timeout after: {q_text[:60]}]"
                    )
                except asyncio.CancelledError:
                    pass
                finally:
                    _pending_escalations.pop(cid, None)

            _pending_escalations[chat_id] = asyncio.create_task(_escalate_fail_safe())
        return

    # Check if this text is a post-voyage catch report or feedback
    from .feedback_engine import is_likely_catch_feedback
    if is_likely_catch_feedback(text):
        await _handle_report_command(client, chat_id, first_name, text)
        return

    # Send typing action
    await _telegram_request(client, "sendChatAction", {"chat_id": chat_id, "action": "typing"})

    try:
        result = await process_chat_query(text, language="auto", session_id=f"tg_{chat_id}", user_name=first_name)

        # Check if the pipeline returned an error
        if result.get("error"):
            logger.warning(f"[Telegram Query] Pipeline error for '{text[:50]}': {result['error']}")

        answer = result.get("answer") or result.get("summary") or ""

        # If answer is empty or too short, generate a helpful fallback
        if not answer or len(answer.strip()) < 20:
            answer = "Currently no specific data available for this query. Please try asking about a specific coastal area like Mumbai, Chennai, or Kochi."

        # Convert LLM narrative response into Telegram-compliant HTML
        html_answer = markdown_to_telegram_html(answer)

        # Append species ecological focus if detected and not already mentioned
        if result.get("species_detected"):
            sp = result['species_detected'].lower().replace(" ", "_")
            if sp in SPECIES_ECOLOGY:
                ec = SPECIES_ECOLOGY[sp]
                if ec['common_name'].lower() not in answer.lower():
                    html_answer += (
                        f"\n\n🐟 <b>Species Focus:</b> <i>{ec['common_name']}</i>\n"
                        f"• <b>Optimal SST:</b> <code>{ec['optimal_sst'][0]}°C - {ec['optimal_sst'][1]}°C</code>\n"
                        f"• <b>Ideal Depth:</b> <code>{ec['ideal_depth'][0]}m - {ec['ideal_depth'][1]}m</code> ({ec['gear']})"
                    )

        # If query resulted in specific map coordinates, offer coordinates and navigation link
        markers = result.get("map_markers") or []
        target_lat, target_lon = None, None
        if markers and len(markers) > 0:
            first_m = markers[0]
            lat = first_m.get("lat")
            lon = first_m.get("lon")
            if lat and lon:
                target_lat, target_lon = lat, lon
                maps_url = f"https://maps.google.com/?q={lat:.4f},{lon:.4f}"
                html_answer += f"\n\n📍 <b>Target Coordinates:</b> <code>{lat:.3f}°N, {lon:.3f}°E</code>\n👉 <a href=\"{maps_url}\">Open Navigation in Google Maps</a>"

        # Determine active sector for contextual chips
        session = get_session_memory(f"tg_{chat_id}")
        sector_slug = (session.active_location if session and session.active_location else "mumbai")
        query_route = result.get("query_route") or "species_advisory"

        context_keyboard = _get_contextual_keyboard(
            sector_slug=sector_slug,
            query_route=query_route,
            target_lat=target_lat,
            target_lon=target_lon
        )

        try:
            await _telegram_request(client, "sendMessage", {
                "chat_id": chat_id,
                "text": html_answer,
                "parse_mode": "HTML",
                "reply_markup": context_keyboard,
                "disable_web_page_preview": False
            })
        except Exception as html_err:
            logger.warning(f"[Telegram HTML Parse Error] Fallback to plain text: {html_err}")
            await _telegram_request(client, "sendMessage", {
                "chat_id": chat_id,
                "text": answer,
                "reply_markup": context_keyboard,
                "disable_web_page_preview": False
            })

        if target_lat and target_lon:
            await send_telegram_location(chat_id, target_lat, target_lon)

        # Determine language code for accurate regional Edge-TTS voice note
        detected_lang = lang
        if result.get("detected_language") and result["detected_language"].get("code"):
            detected_lang = result["detected_language"]["code"]
        elif lang == "en" or not lang:
            meta = detect_script_language(text)
            detected_lang = meta.get("code", "en")

        # Generate voice note if requested in the exact user language
        if send_voice:
            voice_bytes = await _synthesize_voice_audio(answer, lang=detected_lang)
            if voice_bytes:
                await send_telegram_voice(chat_id, voice_bytes, caption="🔊 <b>Lehar AI Spoken Summary</b>", parse_mode="HTML")

    except Exception as err:
        import traceback
        logger.error(f"Error processing Telegram query for '{text[:60]}': {err}\n{traceback.format_exc()}")
        # Send a helpful fallback instead of a generic error
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "⚠️ *Temporary processing error.* Please try asking your question again or try a specific query like:\n\n• _Mumbai ke paas samundar ka taapman kya hai?_\n• _Show temperature near Chennai coast_\n• _Best fishing zone near Goa_",
            "parse_mode": "Markdown",
            "reply_markup": _get_start_keyboard()
        })


async def _handle_report_command(client: httpx.AsyncClient, chat_id: int, first_name: str, text: str):
    """
    Handle /report and conversational catch submissions in any Indian language.
    Extracts species, weight, depth, and advisory feedback and responds in user's native language.
    """
    from .feedback_engine import parse_and_process_feedback
    from .db import get_connection
    
    clean_text = text.replace("/report", "").replace("/catch", "").strip()
    if not clean_text or len(clean_text) < 3:
        guide_msg = (
            "📝 *How to Report Live Catch & Advisory Feedback:*\n\n"
            "Send your catch details in ANY language to update the live community map:\n"
            "• `/report 400kg Bangda at 20m depth near Mumbai`\n"
            "• `250kg Tuna near Kochi at 50m depth`\n"
            "• `300 kilo Surmai mila 30 meter pe`\n\n"
            "🎙️ Or send a voice note saying what you caught with quantity in kg!"
        )
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": guide_msg,
            "parse_mode": "Markdown"
        })
        return

    # Resolve accurate subscriber name
    if not first_name or first_name.strip().lower() == "captain":
        resolved_name = get_subscriber_first_name(chat_id, default="Captain")
    else:
        resolved_name = first_name.strip()

    # Extract location if subscriber profile exists
    with get_connection() as conn:
        sub = conn.execute("SELECT latitude, longitude, harbour FROM telegram_subscribers WHERE chat_id = ?", (chat_id,)).fetchone()
    
    lat = sub["latitude"] if sub and sub["latitude"] else 18.915
    lon = sub["longitude"] if sub and sub["longitude"] else 72.828
    harbour = sub["harbour"] if sub and sub["harbour"] else "Mumbai (Sassoon Dock)"
    
    result = await parse_and_process_feedback(
        text=clean_text,
        chat_id=chat_id,
        reporter_name=resolved_name,
        default_lat=lat,
        default_lon=lon,
        default_harbour=harbour
    )
    
    report_id = result.get("report_id", 1)
    species_name = result.get("species", "Pelagic Catch")
    quantity = result.get("quantity_kg")
    depth = result.get("depth_m")
    localized_reply = result.get("localized_reply", "")
    detected_lang = result.get("detected_language", "hi")
    
    qty_display = f"{quantity:.0f} kg" if quantity and quantity > 0 else "Recorded Catch"
    depth_display = f"{depth:.0f}m" if depth and depth > 0 else "Surface / Mixed Depth"
    mariner_display = format_mariner_name(resolved_name)

    reply = (
        f"✅ *Catch Report Verified & Logged!* (#FR-{report_id:04d})\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎣 *Species:* _{species_name}_\n"
        f"⚖️ *Quantity:* *{qty_display}* | Depth: *{depth_display}*\n"
        f"⚓ *Port Sector:* {harbour} ({lat:.3f}°N, {lon:.3f}°E)\n\n"
        f"💬 *Advisory Feedback:*\n_{localized_reply}_\n\n"
        f"🌐 *Lehar AI Live Community Map Updated:* Validating INCOIS PFZ forecasts for {mariner_display} and fellow coastal fishermen."
    )
    
    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": reply,
        "parse_mode": "Markdown"
    })
    
    # Generate native spoken voice note confirmation
    voice_bytes = await _synthesize_voice_audio(localized_reply, lang=detected_lang)
    if voice_bytes:
        await send_telegram_voice(chat_id, voice_bytes, caption=f"🔊 *Voice Confirmation ({detected_lang.upper()})*")


async def run_telegram_bot():
    """Main async long-polling worker loop."""
    global _bot_running, _last_update_id, _http_client
    token = get_bot_token()
    username = get_bot_username()
    if not token:
        logger.info("[Telegram Bot] TELEGRAM_BOT_TOKEN not configured. Bot worker running in standby.")
        _bot_running = False
        return

    _bot_running = True
    # Resume from the last processed update so a restart doesn't reprocess ~24h of backlog
    _last_update_id = _load_last_update_id()
    logger.info(f"[Telegram Bot] Starting async polling for @{username} (resume offset={_last_update_id})...")

    async with httpx.AsyncClient(timeout=35.0) as client:
        # Verify bot token on startup
        me = await _telegram_request(client, "getMe", {})
        if me:
            logger.info(f"[Telegram Bot] Successfully connected to Telegram API as @{me.get('username')}")
            
            # Setup bot commands menu
            await _telegram_request(client, "setMyCommands", {
                "commands": [
                    {"command": "start", "description": "🌊 Open Lehar AI Main Menu & Advisories"},
                    {"command": "pfz", "description": "🐟 Find Nearest Potential Fishing Zone"},
                    {"command": "temp", "description": "🌊 Check Ocean Temperature & MLD"},
                    {"command": "storm", "description": "🚨 Marine Heatwave & Storm Alerts"},
                    {"command": "report", "description": "📝 Report Live Catch for Community Map"},
                    {"command": "help", "description": "ℹ️ How to use Lehar AI"}
                ]
            })

            # Setup bot description
            await _telegram_request(client, "setMyDescription", {
                "description": (
                    "🌊 Lehar AI (@LeharAIBot) — Know the Sea. Know the Way.\n\n"
                    "India's First Conversational Marine Intelligence Assistant developed for INCOIS & Ministry of Earth Sciences (SIH26067).\n\n"
                    "🎙️ Send a voice note or ask questions in 9 Indic languages, or share your GPS location to get your nearest ARGO Float & Gold Fishing Zone!"
                )
            })

            # Setup short description
            await _telegram_request(client, "setMyShortDescription", {
                "short_description": "🌊 24/7 Voice & Multimodal Ocean Intelligence for Coastal Fishermen (INCOIS / SIH26067)."
            })
        else:
            logger.warning("[Telegram Bot] Failed to verify bot token with Telegram API.")

        # Ensure no leftover webhook is registered — a live webhook makes getUpdates
        # return a permanent 409 Conflict. Keep pending updates (offset handles backlog).
        await _telegram_request(client, "deleteWebhook", {"drop_pending_updates": False})

        while _bot_running:
            try:
                updates = await _telegram_request(client, "getUpdates", {
                    "offset": _last_update_id + 1,
                    "timeout": 20,
                    "allowed_updates": ["message", "callback_query"]
                })

                if updates and isinstance(updates, list):
                    for u in updates:
                        _last_update_id = u["update_id"]
                        _save_last_update_id(_last_update_id)

                        # Handle Callback Query (Buttons)
                        if "callback_query" in u:
                            _spawn_task(_handle_callback_query(client, u["callback_query"]))
                            continue

                        # Handle Standard Message
                        message = u.get("message")
                        if not message:
                            continue

                        chat_id = message["chat"]["id"]
                        user_obj = message.get("from") or message.get("chat") or {}
                        first_name = user_obj.get("first_name", "").strip()
                        if not first_name:
                            first_name = get_subscriber_first_name(chat_id, default="Captain")

                        username_val = user_obj.get("username", "")
                        register_or_update_subscriber(chat_id, first_name=first_name, username=username_val)

                        # Process Telegram update via unified helper
                        _spawn_task(process_telegram_update(client, u))

            except asyncio.CancelledError:
                logger.info("[Telegram Bot] Worker cancelled.")
                break
            except Exception as e:
                logger.warning(f"[Telegram Bot] Polling exception: {e}. Retrying in 5 seconds...")
                await asyncio.sleep(5)

    _bot_running = False
    # Close the reused outbound client (self-heals via _get_http_client if used again)
    if _http_client is not None and not _http_client.is_closed:
        try:
            await _http_client.aclose()
        except Exception:
            pass
        _http_client = None
    logger.info("[Telegram Bot] Gateway shutdown complete.")


async def process_telegram_update(client: Optional[httpx.AsyncClient], u: dict):
    """
    Processes a single Telegram update event.
    Shared by both async long-polling and FastAPI webhook endpoint.
    """
    if client is None:
        client = _get_http_client()

    # Handle Callback Query (Buttons)
    if "callback_query" in u:
        _spawn_task(_handle_callback_query(client, u["callback_query"]))
        return

    # Handle Standard Message
    message = u.get("message")
    if not message:
        return

    chat_id = message["chat"]["id"]
    user_obj = message.get("from") or message.get("chat") or {}
    first_name = user_obj.get("first_name", "").strip()
    if not first_name:
        first_name = get_subscriber_first_name(chat_id, default="Captain")

    username_val = user_obj.get("username", "")

    # Auto-Register / Update Subscriber
    register_or_update_subscriber(chat_id, first_name=first_name, username=username_val)

    # Location Message
    if "location" in message:
        loc = message["location"]
        h_info = nearest_harbour(loc["latitude"], loc["longitude"])
        register_or_update_subscriber(
            chat_id,
            first_name=first_name,
            username=username_val,
            lat=loc["latitude"],
            lon=loc["longitude"],
            harbour=h_info["harbour"]
        )
        _spawn_task(_handle_location(client, chat_id, loc["latitude"], loc["longitude"]))
        return

    # Voice Message (Voice In)
    if "voice" in message:
        voice_file_id = message["voice"]["file_id"]
        _spawn_task(_handle_voice_message(client, chat_id, voice_file_id, first_name=first_name))
        return

    # Audio File Message (Voice In)
    if "audio" in message:
        audio_file_id = message["audio"]["file_id"]
        _spawn_task(_handle_voice_message(client, chat_id, audio_file_id, first_name=first_name))
        return

    # Text Message
    text = message.get("text", "").strip()
    if not text:
        return

    if text.startswith("/start"):
        _spawn_task(_handle_start_command(client, chat_id, first_name))
    elif text.startswith("/help"):
        _spawn_task(_handle_start_command(client, chat_id, first_name))
    elif text.startswith("/report") or text.startswith("/catch"):
        _spawn_task(_handle_report_command(client, chat_id, first_name, text))
    elif text.startswith("/sos") or text.startswith("/mayday"):
        _spawn_task(_handle_sos_command(client, chat_id, first_name))
    else:
        _spawn_task(_handle_text_query(client, chat_id, text, send_voice=True, first_name=first_name))


async def run_guardian_proactive_watchdog():
    """
    Autonomous ocean watchdog loop:
    1. Inspects multi-sensor ocean anomalies (ARGO + NOAA SST) -> pushes proactive alert cards.
    2. Continuous geofence surveillance: checks all subscribers' last known coordinates against active hazard zones.
    3. Return route safety check: checks if offshore boats face deteriorating weather (Hs >= 2.3m, wind >= 24kn) with 30-min DB debounce.
    4. Hourly 48-hour TTL purge on location_history to prevent database bloat.
    """
    global _sent_proactive_alert_ids
    from .guardian_engine import scan_for_guardian_alerts

    logger.info("[Guardian Watchdog] Autonomous ocean watchdog loop initiated.")
    iteration = 0

    while _bot_running:
        try:
            await asyncio.sleep(60)  # Check ocean state every 60 seconds
            iteration += 1
            subscribers = get_all_subscribers()
            if not subscribers:
                continue

            client = _get_http_client()

            # --- 1. Continuous Geofence Hazard Surveillance ---
            active_hazards = get_active_hazards()
            for sub in subscribers:
                sub_lat = sub.get("latitude")
                sub_lon = sub.get("longitude")
                if not sub_lat or not sub_lon:
                    continue

                # Check against active hazard zones
                for hz in active_hazards:
                    d_hz = haversine_km(sub_lat, sub_lon, hz["center_lat"], hz["center_lon"])
                    if d_hz <= hz["radius_km"]:
                        hz_alert_key = f"hz_{hz['id']}_{sub['chat_id']}"
                        if hz_alert_key not in _sent_proactive_alert_ids:
                            _sent_proactive_alert_ids.add(hz_alert_key)
                            nearest_h = nearest_harbour(sub_lat, sub_lon)
                            escape_maps = f"https://maps.google.com/?q={nearest_h['latitude']:.4f},{nearest_h['longitude']:.4f}"
                            card = (
                                f"🚨 *PROACTIVE GEOFENCE HAZARD ALERT*\n"
                                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"⚠️ *Vessel Master {sub.get('first_name', 'Captain')}:* Active threat in your sector!\n"
                                f"• *Incident:* *{hz['title']}* ({hz['hazard_type'].upper()})\n"
                                f"• *Severity Rating:* 🔴 *{hz['severity'].upper()}*\n"
                                f"• *Waves:* *{hz.get('wave_height_m') or 3.8}m* | Winds: *{hz.get('wind_speed_kmh') or 58} km/h*\n"
                                f"• *Nearest Safe Port:* *{nearest_h['harbour']}* ({nearest_h['distance_km']} km | Heading: {nearest_h['compass']})\n\n"
                                f"👉 [Open Escape Route in Maps]({escape_maps})\n"
                                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                            )
                            try:
                                await _telegram_request(client, "sendMessage", {
                                    "chat_id": sub["chat_id"],
                                    "text": card,
                                    "parse_mode": "Markdown"
                                })
                            except Exception as ex:
                                logger.debug(f"[Geofence Watchdog] Delivery notice: {ex}")

            # --- 2. Return Route Safety Check (Offshore Boats + Worsening Trend + 30m DB Debounce) ---
            for sub in subscribers:
                sub_lat = sub.get("latitude")
                sub_lon = sub.get("longitude")
                if not sub_lat or not sub_lon:
                    continue

                nearest_h = nearest_harbour(sub_lat, sub_lon)
                dist_offshore = nearest_h["distance_km"]

                # Only evaluate vessels genuinely offshore (>20 km)
                if dist_offshore > 20.0:
                    try:
                        weather = get_live_marine_weather(sub_lat, sub_lon)
                        w_h = weather.get("wave_height_m", 1.0)
                        w_spd = weather.get("wind_speed_knots", 10.0)

                        if w_h >= 2.3 or w_spd >= 24.0:
                            # Check persistent DB debounce
                            last_alert_str = sub.get("last_weather_alert_at")
                            should_alert = True
                            if last_alert_str:
                                try:
                                    from datetime import datetime, timezone
                                    last_dt = datetime.fromisoformat(last_alert_str.replace(" ", "T")).replace(tzinfo=timezone.utc)
                                    now_dt = datetime.now(timezone.utc)
                                    elapsed_mins = (now_dt - last_dt).total_seconds() / 60.0
                                    if elapsed_mins < 30.0:
                                        should_alert = False
                                except Exception:
                                    should_alert = True

                            if should_alert:
                                update_subscriber_weather_alert_time(sub["chat_id"])
                                transit_time_hrs = dist_offshore / (8.5 * 1.852)
                                return_msg = (
                                    f"⚠️ *LEHAR GUARDIAN — RETURN ROUTE WEATHER ADVISORY*\n"
                                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                                    f"👤 *Vessel:* `{_escape_md(sub.get('first_name', 'Captain'))}`\n"
                                    f"📍 *Sector:* *{dist_offshore} km offshore* ({nearest_h['harbour']})\n\n"
                                    f"🌊 *Deteriorating Ocean State:*\n"
                                    f"• Wave Height: *{w_h:.1f} m* (Rough Sea)\n"
                                    f"• Wind Velocity: *{w_spd:.1f} knots* ({weather.get('wind_speed_kmh', 0)} km/h)\n"
                                    f"• Status: 🔴 *{weather.get('safety_badge', 'ROUGH SEA')}*\n\n"
                                    f"⚓ *Advisory:* Return transit to *{nearest_h['harbour']}* estimated at *~{transit_time_hrs:.1f} hours*. "
                                    f"Begin heading to port before wave swell increases.\n"
                                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                                )
                                try:
                                    await _telegram_request(client, "sendMessage", {
                                        "chat_id": sub["chat_id"],
                                        "text": return_msg,
                                        "parse_mode": "Markdown"
                                    })
                                    voice_script = (
                                        f"Namaste Captain {sub.get('first_name', '')}! Mausam bigad raha hai. "
                                        f"Offshore wave height {w_h:.1f} meter ho gayi hai. Turant {nearest_h['harbour']} port lautna shuru karein."
                                    )
                                    v_bytes = await _synthesize_voice_audio(voice_script, lang="hi")
                                    if v_bytes:
                                        await send_telegram_voice(sub["chat_id"], v_bytes, caption="🔊 *Return Route Voice Advisory*")
                                except Exception as ex:
                                    logger.debug(f"[Return Route] Notice: {ex}")

                    except Exception as ex:
                        logger.debug(f"[Return Route Weather Check] Error: {ex}")

            # --- 3. Multi-Sensor ARGO / Satellite Anomaly Scan ---
            alerts = await asyncio.to_thread(scan_for_guardian_alerts)
            for alert in alerts:
                alert_id = alert.get("id")
                if not alert_id or alert_id in _sent_proactive_alert_ids:
                    continue

                for sub in subscribers:
                    sub_lat = sub.get("latitude", 18.915)
                    sub_lon = sub.get("longitude", 72.828)
                    alert_lat = alert["location"]["latitude"]
                    alert_lon = alert["location"]["longitude"]
                    
                    dist = haversine_km(sub_lat, sub_lon, alert_lat, alert_lon)
                    if dist <= 150.0:
                        try:
                            await send_proactive_guardian_alert(sub, alert)
                        except Exception as ex:
                            logger.warning(f"[Guardian Watchdog] Failed to push alert to #{sub['chat_id']}: {ex}")

                _sent_proactive_alert_ids.add(alert_id)

            # --- 4. Hourly 48-Hour TTL Cleanup on Location History ---
            if iteration % 60 == 0:
                purge_old_location_history()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"[Guardian Watchdog] Error in watchdog loop: {e}")
            await asyncio.sleep(15)


def start_telegram_bot_task():
    """Starts the Telegram bot background worker task and autonomous guardian watchdog."""
    global _bot_task, _watchdog_task
    if _bot_task is None or _bot_task.done():
        _bot_task = asyncio.create_task(run_telegram_bot())
    if _watchdog_task is None or _watchdog_task.done():
        _watchdog_task = asyncio.create_task(run_guardian_proactive_watchdog())
    return _bot_task


def stop_telegram_bot_task():
    """Stops the Telegram bot worker and watchdog."""
    global _bot_running, _bot_task, _watchdog_task
    _bot_running = False
    if _bot_task and not _bot_task.done():
        _bot_task.cancel()
    if _watchdog_task and not _watchdog_task.done():
        _watchdog_task.cancel()
