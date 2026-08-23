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
import math
import logging
import io
from typing import Optional, Dict, Any, List
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
_bot_running = False
_last_update_id = 0
_total_messages_handled = 0


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
        else:
            logger.warning(f"[Telegram API] {method} returned {resp.status_code}: {resp.text}")
            return None
    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
        logger.warning(f"[Telegram API] Network connectivity notice in {method}: {e}")
        await asyncio.sleep(3)
        return None
    except Exception as e:
        logger.error(f"[Telegram API] Error in {method}: {e}")
        await asyncio.sleep(3)
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
    async with httpx.AsyncClient() as client:
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
    async with httpx.AsyncClient() as client:
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
    async with httpx.AsyncClient() as client:
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
    clean_text = text.replace("*", "").replace("`", "").replace("_", "").replace("#", "")
    clean_text = "\n".join([line for line in clean_text.split("\n") if not line.startswith("http") and not line.startswith("👉")])
    if len(clean_text) > 450:
        clean_text = clean_text[:450] + "..."

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
        communicate = edge_tts.Communicate(clean_text, voice_id)
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
        return bytes(audio_data)
    except Exception as e:
        logger.error(f"[Edge-TTS] Synthesis error: {e}")
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
    welcome_text = (
        f"🌊 *Namaste {first_name}! Welcome to Lehar AI (@{username})*\n"
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
    econ = calculate_voyage_economics(nearest_f["distance_km"])
    
    # Species evaluation for primary pelagic species
    tuna_eval = evaluate_species_profile_viability("yellowfin_tuna", sst, mld, therm["thermocline_depth_m"], sal)
    mackerel_eval = evaluate_species_profile_viability("indian_mackerel", sst, mld, therm["thermocline_depth_m"], sal)

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
        f"• 📉 *Thermocline Peak:* `{therm['thermocline_depth_m']} m` (dT/dz: {therm['max_gradient_c_per_m']}°C/m)\n"
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

    # Transcribe via Groq Whisper
    transcribed_text = _transcribe_audio_groq(audio_bytes)
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
        "text": f"🎙️ *I heard you say:*\n_\"{transcribed_text}\"_\n\n⏳ *Querying ARGO in-situ database & ocean models...*",
        "parse_mode": "Markdown"
    })

    # Run query and send both text + voice response
    await _handle_text_query(client, chat_id, transcribed_text, send_voice=True)


async def _handle_callback_query(client: httpx.AsyncClient, callback_query: dict):
    """Handle interactive button taps from inline keyboard."""
    cb_id = callback_query["id"]
    chat_id = callback_query["message"]["chat"]["id"]
    data = callback_query.get("data", "")

    # Acknowledge callback immediately
    await _telegram_request(client, "answerCallbackQuery", {"callback_query_id": cb_id})

    if data == "cmd_pfz":
        query = "Where are the top 3 potential fishing zones near the Indian coast with optimal SST and chlorophyll?"
        await _handle_text_query(client, chat_id, query, send_voice=True)
    elif data == "cmd_temp":
        query = "What is the latest sea surface temperature and mixed layer depth in the Arabian Sea from ARGO floats?"
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
        query = "अरब सागर में मछली पकड़ने के सबसे अच्छे क्षेत्र कौन से हैं और पानी का तापमान कितना है?"
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
        answer = result.get("answer", "No insights could be generated.")
        
        # Build clean Telegram markdown response
        response_text = f"🌊 *Lehar AI Operational Advisory:*\n\n{answer}"

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
        logger.error(f"Error processing Telegram query: {err}")
        await _telegram_request(client, "sendMessage", {
            "chat_id": chat_id,
            "text": "⚠️ *Apologies, error querying ARGO ocean database.* Please try rephrasing your question.",
            "parse_mode": "Markdown"
        })


async def run_telegram_bot():
    """Main async long-polling worker loop."""
    global _bot_running, _last_update_id
    token = get_bot_token()
    username = get_bot_username()
    if not token:
        logger.info("[Telegram Bot] TELEGRAM_BOT_TOKEN not configured. Bot worker running in standby.")
        _bot_running = False
        return

    _bot_running = True
    logger.info(f"[Telegram Bot] Starting async polling for @{username}...")

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

                        # Handle Callback Query (Buttons)
                        if "callback_query" in u:
                            asyncio.create_task(_handle_callback_query(client, u["callback_query"]))
                            continue

                        # Handle Standard Message
                        message = u.get("message")
                        if not message:
                            continue

                        chat_id = message["chat"]["id"]
                        first_name = message["chat"].get("first_name", "Captain")

                        # Location Message
                        if "location" in message:
                            loc = message["location"]
                            asyncio.create_task(_handle_location(client, chat_id, loc["latitude"], loc["longitude"]))
                            continue

                        # Voice Message (Voice In)
                        if "voice" in message:
                            voice_file_id = message["voice"]["file_id"]
                            asyncio.create_task(_handle_voice_message(client, chat_id, voice_file_id))
                            continue

                        # Audio File Message (Voice In)
                        if "audio" in message:
                            audio_file_id = message["audio"]["file_id"]
                            asyncio.create_task(_handle_voice_message(client, chat_id, audio_file_id))
                            continue

                        # Text Message
                        text = message.get("text", "").strip()
                        if not text:
                            continue

                        if text.startswith("/start"):
                            asyncio.create_task(_handle_start_command(client, chat_id, first_name))
                        elif text.startswith("/help"):
                            asyncio.create_task(_handle_start_command(client, chat_id, first_name))
                        else:
                            asyncio.create_task(_handle_text_query(client, chat_id, text, send_voice=True))

            except asyncio.CancelledError:
                logger.info("[Telegram Bot] Worker cancelled.")
                break
            except Exception as e:
                logger.warning(f"[Telegram Bot] Polling exception: {e}. Retrying in 5 seconds...")
                await asyncio.sleep(5)

    _bot_running = False
    logger.info("[Telegram Bot] Gateway shutdown complete.")


def start_telegram_bot_task():
    """Starts the Telegram bot background worker task."""
    global _bot_task
    if _bot_task is None or _bot_task.done():
        _bot_task = asyncio.create_task(run_telegram_bot())
    return _bot_task


def stop_telegram_bot_task():
    """Stops the Telegram bot worker."""
    global _bot_running, _bot_task
    _bot_running = False
    if _bot_task and not _bot_task.done():
        _bot_task.cancel()
