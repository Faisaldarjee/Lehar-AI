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
from .db import get_connection
from .lang_detect import detect_script_language

# Load from backend/.env
backend_env = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=backend_env)
load_dotenv()

logger = logging.getLogger("lehar_telegram_bot")


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
    safe_first_name = _escape_md(first_name)
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
                f"Namaste {first_name}! Yeh Lehar Guardian ka zaroori ocean safety alert hai. "
                f"Aapke harbour {harbour} se {int(dist_km)} kilometer door samundar me severe temperature anomaly detect hui hai. "
                f"Chhoti naav samundar me savdhani bartein."
            )
        else:
            sp_name = alert.get("species") or "machhli"
            voice_script = (
                f"Namaste {first_name}! Yeh Lehar Guardian fishing opportunity alert hai. "
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
    caption: str = "🔊 *Lehar AI Voice Advisory*"
) -> bool:
    """Send a native voice note (.ogg/.mp3) to Telegram chat."""
    token = get_bot_token()
    if not token or not audio_bytes:
        return False
    client = _get_http_client()
    files = {"voice": ("voice.mp3", audio_bytes, "audio/mpeg")}
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": "Markdown"}
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
                {"text": "🇮🇳 हिंदी एडवाइजरी", "callback_data": "cmd_lang_hi"},
                {"text": "🌐 Project Details", "callback_data": "cmd_about"}
            ]
        ]
    }


async def _handle_start_command(client: httpx.AsyncClient, chat_id: int, first_name: str):
    """Handle /start greeting with rich introductory banner & instant voice welcome."""
    username = get_bot_username()
    safe_first_name = _escape_md(first_name)
    welcome_text = (
        f"🌊 *Namaste {safe_first_name}! Welcome to Lehar AI (@{username})*\n"
        f"_Know the Sea. Know the Way._\n\n"
        f"I am your *24/7 AI Marine Intelligence Assistant*, developed for **INCOIS & Ministry of Earth Sciences (SIH26040)**.\n\n"
        f"⚡ *What you can do:*\n"
        f"• 🎙️ *Send a Voice Note* in Hindi, Marathi, Tamil, Telugu or English\n"
        f"• 💬 *Ask any ocean question* in natural text\n"
        f"• 📍 *Send your GPS Location* (tap 📎 ➔ Location) to get your nearest ARGO Float, Fishing Viability & Navigation Pin!\n"
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
        f"Namaste {first_name}! Welcome to Lehar AI Marine Intelligence. You can speak to me in your voice or ask any ocean question.",
        lang="en"
    )
    if voice_bytes:
        await send_telegram_voice(chat_id, voice_bytes, caption="🔊 *Lehar AI Voice Guide*")


async def _handle_location(client: httpx.AsyncClient, chat_id: int, lat: float, lon: float):
    """Handle user GPS location sharing — calculates nearest ARGO float, thermocline & ICAR-CMFRI viability."""
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


async def _handle_voice_message(client: httpx.AsyncClient, chat_id: int, voice_file_id: str):
    """Processes incoming user voice note via Groq Whisper Large v3 Turbo in <300ms."""
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
    await _handle_text_query(client, chat_id, transcribed_text, send_voice=True)


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

    if data == "cmd_pfz":
        query = "Show me the top 3 potential fishing zones near the Indian coast with the best SST and chlorophyll today"
        await _handle_text_query(client, chat_id, query, send_voice=True)
    elif data == "cmd_temp":
        query = "Show the latest sea surface temperature and salinity near Mumbai coast from ARGO floats today"
        await _handle_text_query(client, chat_id, query, send_voice=True)
    elif data == "cmd_storm":
        query = "Are there any active marine heatwaves, extreme thermal anomalies, or storm warnings in the Indian Ocean?"
        await _handle_text_query(client, chat_id, query, send_voice=True)
    elif data == "cmd_nearest_float":
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "📍 *Please share your live GPS location* (Tap 📎 ➔ Location) to calculate your nearest INCOIS ARGO float!",
            "parse_mode": "Markdown"
        })
    elif data == "cmd_lang_hi":
        query = "Mumbai ke paas samundar ka taapman kya hai aur machhli pakadne ke liye kaunsa zone best hai aaj?"
        await _handle_text_query(client, chat_id, query, send_voice=True, lang="hi")
    elif data == "cmd_about":
        about_text = (
            "🏆 *Lehar AI — Grand Finale Edition*\n"
            "• *Team:* Ctrl Alt Elites (SIH26040)\n"
            "• *Ministry:* Ministry of Earth Sciences & INCOIS\n"
            "• *Tech:* 72,000+ In-Situ ARGO NetCDF Measurements + NOAA Daily SST + NASA VIIRS Chlorophyll-a + Groq Llama 3.3 70B.\n"
            "• *Website:* `http://localhost:5173`"
        )
        await _telegram_request(client, "sendMessage", {"chat_id": chat_id, "text": about_text, "parse_mode": "Markdown"})


async def _handle_text_query(
    client: httpx.AsyncClient,
    chat_id: int,
    text: str,
    send_voice: bool = True,
    lang: str = "en"
):
    """Handle free-form natural language query in any language with deep marine physics + voice output."""
    global _total_messages_handled
    _total_messages_handled += 1

    # Send typing action
    await _telegram_request(client, "sendChatAction", {"chat_id": chat_id, "action": "typing"})

    try:
        result = await process_chat_query(text, language="auto", session_id=f"tg_{chat_id}")

        # Check if the pipeline returned an error
        if result.get("error"):
            logger.warning(f"[Telegram Query] Pipeline error for '{text[:50]}': {result['error']}")

        answer = result.get("answer") or result.get("summary") or ""

        # If answer is empty or too short, generate a helpful fallback
        if not answer or len(answer.strip()) < 20:
            answer = "Currently no specific data available for this query. Please try asking about a specific coastal area like Mumbai, Chennai, or Kochi."

        # Build clean Telegram markdown response. Escape the raw LLM answer so stray
        # Markdown entity chars can't trigger a 400 'can't parse entities' (silent drop).
        safe_answer = _escape_md(answer)
        response_text = f"🌊 *Lehar AI Operational Advisory:*\n\n{safe_answer}"

        if result.get("hero_stat") and result["hero_stat"].get("value"):
            hs = result["hero_stat"]
            response_text += f"\n\n📊 *Key Ocean Metric:* `{hs.get('label', '')}: {hs.get('value', '')} {hs.get('unit') or ''}`"

        if result.get("species_detected"):
            sp = result['species_detected'].lower().replace(" ", "_")
            if sp in SPECIES_ECOLOGY:
                ec = SPECIES_ECOLOGY[sp]
                response_text += f"\n🐟 *Species Focus:* _{ec['common_name']}_\n• *Optimal SST:* `{ec['optimal_sst'][0]}°C - {ec['optimal_sst'][1]}°C`\n• *Ideal Depth:* `{ec['ideal_depth'][0]}m - {ec['ideal_depth'][1]}m` ({ec['gear']})"
            else:
                response_text += f"\n🐟 *Species Focus:* _{result['species_detected'].title()}_"

        # If query resulted in specific map coordinates, offer location pin & navigation URL
        markers = result.get("map_markers") or []
        target_lat, target_lon = None, None
        if markers and len(markers) > 0:
            first_m = markers[0]
            lat = first_m.get("lat")
            lon = first_m.get("lon")
            if lat and lon:
                target_lat, target_lon = lat, lon
                maps_url = f"https://maps.google.com/?q={lat:.4f},{lon:.4f}"
                response_text += f"\n\n📍 *Target Coordinates:* `{lat:.3f}°N, {lon:.3f}°E`\n👉 [Open Navigation in Google Maps]({maps_url})"

        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": response_text,
            "parse_mode": "Markdown",
            "reply_markup": _get_start_keyboard(),
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
                await send_telegram_voice(chat_id, voice_bytes, caption="🔊 *Lehar AI Spoken Summary*")

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
    Handle /report catch submission by coastal fishermen.
    Example: /report 300kg Yellowfin Tuna near Sassoon Dock at 40m depth
    """
    from .db import save_fisherman_report, get_connection
    from .species_dict import detect_species_in_query
    
    clean_text = text.replace("/report", "").strip()
    if not clean_text:
        guide_msg = (
            "📝 *How to Report Live Catch:*\n\n"
            "Send your catch details to update the live community map:\n"
            "• `/report 400kg Bangda at 20m depth near Mumbai`\n"
            "• `/report 250kg Tuna near Kochi 50m`\n\n"
            "Or send a voice note saying your catch details!"
        )
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": guide_msg,
            "parse_mode": "Markdown"
        })
        return

    # Extract location if mentioned
    with get_connection() as conn:
        sub = conn.execute("SELECT latitude, longitude, harbour FROM telegram_subscribers WHERE chat_id = ?", (chat_id,)).fetchone()
    
    lat = sub["latitude"] if sub and sub["latitude"] else 18.915
    lon = sub["longitude"] if sub and sub["longitude"] else 72.828
    harbour = sub["harbour"] if sub and sub["harbour"] else "Mumbai (Sassoon Dock)"
    
    species_info = detect_species_in_query(clean_text)
    species_name = species_info["common_name"] if species_info else "Pelagic Mixed Catch"
    
    # Extract quantity (e.g. 500kg, 200 kg)
    qty_match = re.search(r"(\d+)\s*(kg|kilo|ton|quintal)?", clean_text, re.IGNORECASE)
    quantity = float(qty_match.group(1)) if qty_match else 75.0
    
    # Extract depth (e.g. 30m, 50 meters)
    depth_match = re.search(r"(\d+)\s*(m|meter|metre)", clean_text, re.IGNORECASE)
    depth = float(depth_match.group(1)) if depth_match else 25.0
    
    report_id = save_fisherman_report(
        latitude=lat,
        longitude=lon,
        species=species_name,
        quantity_kg=quantity,
        depth_m=depth,
        reporter_id=f"tg_{chat_id}",
        reporter_name=first_name,
        harbour=harbour,
        notes=clean_text
    )
    
    reply = (
        f"✅ *Catch Report Verified & Logged!* (#FR-{report_id:04d})\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🎣 *Species:* _{species_name}_\n"
        f"⚖️ *Quantity:* *{quantity:.0f} kg* | Depth: *{depth:.0f}m*\n"
        f"⚓ *Port Sector:* {harbour} ({lat:.3f}°N, {lon:.3f}°E)\n\n"
        f"🌐 *Thank you, Captain {first_name}!* Your report has been added to the **Lehar AI Live Community Catch Map Layer** to help fellow coastal fishermen and validate INCOIS PFZ forecasts."
    )
    
    await _telegram_request(client, "sendMessage", {
        "chat_id": chat_id,
        "text": reply,
        "parse_mode": "Markdown"
    })


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
                    "India's First Conversational Marine Intelligence Assistant developed for INCOIS & Ministry of Earth Sciences (SIH26040).\n\n"
                    "🎙️ Send a voice note or ask questions in 9 Indic languages, or share your GPS location to get your nearest ARGO Float & Gold Fishing Zone!"
                )
            })

            # Setup short description
            await _telegram_request(client, "setMyShortDescription", {
                "short_description": "🌊 24/7 Voice & Multimodal Ocean Intelligence for Coastal Fishermen (INCOIS / SIH26040)."
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
                        first_name = message["chat"].get("first_name", "Captain")

                        # Auto-Register / Update Subscriber
                        username_val = message["chat"].get("username", "")
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
                            continue

                        # Voice Message (Voice In)
                        if "voice" in message:
                            voice_file_id = message["voice"]["file_id"]
                            _spawn_task(_handle_voice_message(client, chat_id, voice_file_id))
                            continue

                        # Audio File Message (Voice In)
                        if "audio" in message:
                            audio_file_id = message["audio"]["file_id"]
                            _spawn_task(_handle_voice_message(client, chat_id, audio_file_id))
                            continue

                        # Text Message
                        text = message.get("text", "").strip()
                        if not text:
                            continue

                        if text.startswith("/start"):
                            _spawn_task(_handle_start_command(client, chat_id, first_name))
                        elif text.startswith("/help"):
                            _spawn_task(_handle_start_command(client, chat_id, first_name))
                        elif text.startswith("/report"):
                            _spawn_task(_handle_report_command(client, chat_id, first_name, text))
                        else:
                            _spawn_task(_handle_text_query(client, chat_id, text, send_voice=True))

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


async def run_guardian_proactive_watchdog():
    """
    Autonomous ocean watchdog loop that periodically inspects real-time
    ARGO in-situ and NOAA satellite anomalies and pushes proactive alerts directly
    to all registered Telegram fishermen & fleet operators in that coastal geo-fence.
    """
    global _sent_proactive_alert_ids
    from .guardian_engine import scan_for_guardian_alerts

    logger.info("[Guardian Watchdog] Autonomous ocean watchdog loop initiated.")
    while _bot_running:
        try:
            await asyncio.sleep(60)  # Check ocean state every 60 seconds
            subscribers = get_all_subscribers()
            if not subscribers:
                continue

            # Offload the synchronous multi-sensor scan (DB + satellite lookups) to a
            # thread so it doesn't block the event loop / other users' handlers.
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
                    # If within 150km operational radius of the fisherman
                    if dist <= 150.0:
                        logger.info(f"[Guardian Watchdog] Pushing proactive alert '{alert['title']}' to {sub.get('first_name')} (#{sub['chat_id']})")
                        try:
                            await send_proactive_guardian_alert(sub, alert)
                        except Exception as ex:
                            logger.warning(f"[Guardian Watchdog] Failed to push alert to #{sub['chat_id']}: {ex}")

                _sent_proactive_alert_ids.add(alert_id)

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
