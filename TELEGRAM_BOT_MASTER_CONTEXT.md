# Lehar AI — Telegram Bot Gateway (@LeharAIBot) & WhatsApp Transition Master Context
> **Document Purpose:** Complete, self-contained architectural reference, operational manual, and future migration blueprint. This document can be passed directly to any AI model (ChatGPT, Claude, Gemini) or developer to understand 100% of the marine conversational bot system, its underlying ocean physics algorithms, and the roadmap to transition it into an enterprise WhatsApp Business solution for INCOIS & the Ministry of Earth Sciences (MoES).

---

## 1. Executive Summary & Problem Context

* **Project:** Lehar AI — "Know the Sea. Know the Way" (SIH Problem Statement: SIH26040).
* **Target Users:** Indian artisanal, motorized, and mechanized coastal fishermen (operating out of ports such as Sassoon Dock/Mumbai, Cochin, Chennai, Visakhapatnam, Veraval, Mangalore, etc.) and INCOIS ocean scientists.
* **Core Problem:** 
  * Traditional marine advisory portals rely on desktop web GIS dashboards and static PDF bulletins that coastal fishermen cannot easily interpret while navigating rough seas.
  * Fishermen struggle with English/Hindi text and complex numerical data; they require **voice in their native language** (Tamil, Telugu, Marathi, Malayalam, Gujarati, Bengali, Hindi, English).
  * Finding Potential Fishing Zones (PFZ) without deep-ocean subsurface telemetry wastes up to 60–70% of a voyage's diesel looking for fish.
* **Lehar Solution:**
  * An AI-powered conversational marine intelligence gateway operating 24/7 on **Telegram** (`@LeharAIBot`) and architected to migrate to **WhatsApp Business API**.
  * Accepts **voice notes**, **GPS location pins**, and **natural language text**.
  * Queries **72,000+ in-situ ARGO NetCDF ocean measurements**, NOAA high-resolution SST, and NASA VIIRS chlorophyll data.
  * Runs real ocean physics: Mixed Layer Depth (MLD), Thermocline Gradient ($dT/dz$), ICAR-CMFRI pelagic species habitat models (Yellowfin Tuna, Indian Mackerel, etc.), and voyage diesel savings calculations.
  * Replies with **localized text**, **native GPS map pins**, **one-tap Google Maps navigation links**, and **neural voice notes synthesized in 9 Indic regional accents**.
  * Ingests **crowdsourced catch feedback** from fishermen, automatically verifies species, quantity (kg), and gear depth (m) via Groq LLaMA 3.3, and pins it to a live GIS community map layer.
  * Features an autonomous **Lehar Guardian Watchdog** that monitors ocean anomalies every 60 seconds and pushes proactive safety/fishing opportunity alerts to subscribers within 150 km.

---

## 2. System Architecture & Component Diagram

```
                                  ┌─────────────────────────────┐
                                  │   Coastal Fisherman / User  │
                                  └──────────────┬──────────────┘
                                                 │ Voice Note / GPS Pin / Text Query
                                                 ▼
                        ┌─────────────────────────────────────────────────┐
                        │      Messaging Gateway Layer                    │
                        │  • Telegram Bot API (Long-Polling / Webhook)    │
                        │  • [Planned] WhatsApp Cloud API (Meta Webhook)   │
                        └────────────────────────┬────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   │                                                           │
                   ▼ (Voice .ogg / .mp3)                                       ▼ (GPS Pin / Text)
        ┌────────────────────────────────┐                         ┌────────────────────────────────┐
        │     Groq Whisper v3 Turbo      │                         │     Language & Intent Router   │
        │ (<300ms Speech Transcription)  │                         │  • detect_script_language()    │
        └──────────────┬─────────────────┘                         │  • is_likely_catch_feedback()  │
                       │ Transcribed Text                          └──────────────┬─────────────────┘
                       └─────────────────────────────┬────────────────────────────┘
                                                     ▼
    ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
    │                            Lehar AI Marine Intelligence Engine                                │
    ├───────────────────────────────────────────────────────────────────────────────────────────────┤
    │  1. In-Situ ARGO Database Query:                                                              │
    │     - SQLite: argo_profiles, argo_measurements (Depth, Temp, Salinity, Pressure)              │
    │  2. Ocean Physics Calculus:                                                                   │
    │     - Mixed Layer Depth (MLD: ΔT = 0.2°C from surface)                                        │
    │     - Thermocline Peak & Gradient (dT/dz °C/m)                                                │
    │     - Haversine Distance (km) & Compass Bearing (0–360° to N, NE, E...)                       │
    │  3. ICAR-CMFRI Pelagic Biology Model:                                                         │
    │     - Species ecological envelopes (Yellowfin Tuna, Mackerel, Pomfret, Sardine)               │
    │     - Viability Score (%) + Recommended Gear Depth (m) + Hook/Net Type                        │
    │  4. Voyage Economics:                                                                         │
    │     - Direct-vector routing diesel saved (Litres), ₹ saved (at ₹94/L), CO2 offset (kg)        │
    │  5. Groq LLaMA 3.3 70B Versatile:                                                             │
    │     - Multilingual conversational reasoning, NL2SQL query synthesis, Catch report parser      │
    └────────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
         ┌───────────────────────────┐               ┌───────────────────────────┐
         │     Text & GIS Payload    │               │  Neural Speech Synthesis  │
         │ • Formatted Markdown Card │               │ • Microsoft Edge-TTS      │
         │ • Google Maps Deep Link   │               │ • 9 Indic Regional Accents│
         │ • Native Telegram Map Pin │               │ • Audio Voice Note Bytes  │
         └─────────────┬─────────────┘               └─────────────┬─────────────┘
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                               ┌───────────────────────────┐
                               │  Delivery to User Chat    │
                               │  (Text Card + Audio Note) │
                               └───────────────────────────┘
```

---

## 3. Detailed Technology Stack

| Layer | Technology | Purpose | Key File / Configuration |
| :--- | :--- | :--- | :--- |
| **Gateway Protocol** | Telegram Bot API / httpx | Zero-dependency async long-polling with persistent update offset | `backend/services/telegram_bot.py` |
| **Target Gateway** | WhatsApp Cloud API (Meta Graph API v21.0+) | Target production protocol for INCOIS nationwide rollout | Webhook adapter in plan |
| **Speech-to-Text (STT)** | Groq Cloud — Whisper Large v3 Turbo | Transcribes spoken Hindi, Tamil, Telugu, English voice notes in <300ms | `_transcribe_audio_groq()` |
| **Text-to-Speech (TTS)** | Microsoft Edge-TTS | Generates natural human-like neural regional voice notes | `_synthesize_voice_audio()` |
| **Reasoning & NL2SQL** | Groq Cloud — LLaMA 3.3 70B Versatile | Multilingual reasoning, conversational chat, and SQL synthesis | `backend/services/nl2sql.py` |
| **In-Situ Ocean Data** | ARGO NetCDF Floats (INCOIS / Coriolis) | 646+ ocean profiles, 72,000+ discrete depth measurements | `backend/data/argo_database.db` |
| **Catch Validation** | Feedback Engine + LLaMA 3.3 | Extracts species, catch kg, depth m, and writes to live GIS layer | `backend/services/feedback_engine.py` |
| **Database & Cache** | SQLite3 (WAL mode) | Persistent tables: subscribers, reports, profiles, chat memory | `backend/services/db.py` |
| **Web Server Framework**| FastAPI / Uvicorn (Python 3.12) | REST endpoints, lifespan background task manager, CORS | `backend/main.py` |

---

## 4. Complete Codebase & Service Inventory

### 4.1. `backend/services/telegram_bot.py` (1,108 lines)
The central nervous system of the bot.
* **Worker Lifecycle:**
  * `start_telegram_bot_task()`: Launched on FastAPI startup in `lifespan()`. Creates two background async tasks:
    1. `run_telegram_bot()`: The long-polling update loop.
    2. `run_guardian_proactive_watchdog()`: Autonomous 60-second ocean anomaly scanner.
  * `stop_telegram_bot_task()`: Clean cancellation on server shutdown.
  * `_last_update_id`: Persisted to `backend/data/telegram_state.json` to prevent reprocessing backlog on restarts.
  * Transient network backoff: Handles HTTP 409 (duplicate polling instance) and HTTP 429 (Telegram rate-limiting with `retry_after`).
* **Input Handlers:**
  * `_handle_start_command()`: Displays rich introductory banner with 7 quick interactive buttons + sends welcome voice note.
  * `_handle_location()`: Triggered when fisherman sends GPS location. Calculates nearest ARGO float, MLD, thermocline, tuna viability, voyage diesel savings, and sends a native map pin + voice advisory.
  * `_handle_voice_message()`: Downloads `.ogg`/`.mp3` audio, calls Groq Whisper Turbo, shows transcribed query to user, and routes to NL2SQL/physics engine.
  * `_handle_text_query()`: Evaluates if text is a catch report (`is_likely_catch_feedback`) or a general ocean query; generates multi-modal answer with optional map markers and voice note.
  * `_handle_callback_query()`: Handles taps on inline keyboard buttons (`cmd_pfz`, `cmd_temp`, `cmd_storm`, `cmd_log_catch`, `cmd_lang_hi`, etc.).
  * `_handle_report_command()`: Handles `/report` catch logging.
* **Proactive Broadcast:**
  * `send_proactive_guardian_alert()`: Sends high-priority hazard/opportunity cards + voice advisories to fishermen within 150 km.

### 4.2. `backend/services/feedback_engine.py` (171 lines)
Ground-truth catch feedback engine for validating INCOIS PFZ forecasts.
* `is_likely_catch_feedback(text)`: Scans for keywords (`kg`, `kilo`, `ton`, `pakda`, `mila`, `caught`, `bangda`, `tuna`, `pomfret`, etc.).
* `parse_and_process_feedback()`:
  1. Detects user language script.
  2. Prompts Groq LLaMA 3.3 70B with strict JSON schema to extract:
     * `species` (standardized common name)
     * `quantity_kg` (float)
     * `depth_m` (float)
     * `satisfaction_score` (1 to 5)
     * `harbour` (string)
     * `localized_thank_you` (warm 2-sentence confirmation in user's native tongue).
  3. Deterministic regex fallback if LLM times out or is offline.
  4. Saves record to `fishermen_reports` in SQLite.
  5. Instantly renders on live frontend GIS Catch Map (`/api/reports`).

### 4.3. `backend/services/pfz_engine.py`
Core ocean physics and marine biology library.
* `nearest_harbour(lat, lon)`: Returns closest Indian harbor out of 25+ major ports (Mumbai Sassoon Dock, Cochin, Chennai, Veraval, etc.).
* `haversine_km(lat1, lon1, lat2, lon2)`: Computes great-circle distance.
* `bearing_degrees(lat1, lon1, lat2, lon2)` & `bearing_to_compass(deg)`: Converts coordinates to navigational heading (e.g., `245° WSW`).
* `compute_mld(profile_id)`: Mixed Layer Depth using temperature threshold ($\Delta T = 0.2^\circ\text{C}$ from surface layer).
* `compute_thermocline_gradient(profile_id)`: Finds maximum vertical temperature gradient $dT/dz$ (°C/m) and its depth.
* `evaluate_species_profile_viability(species, sst, mld, therm_depth, sal)`:
  * Uses ICAR-CMFRI ecological envelopes:
    * **Yellowfin Tuna:** Optimal SST 26.0–29.5°C, depth 40–120m, gear: Longline/Gillnet.
    * **Indian Mackerel (Bangda):** Optimal SST 25.5–29.0°C, depth 15–50m, gear: Purse Seine/Pelagic Trawl.
    * **Silver Pomfret:** Optimal SST 24.0–28.5°C, depth 20–60m.
    * **Oil Sardine:** Optimal SST 25.0–29.0°C, depth 10–35m.
* `calculate_voyage_economics(distance_km)`:
  * Calculates diesel consumption: `burn_l = (dist_km * 2 / 18 km/hr) * 22 L/hr`.
  * Optimizations from direct NavIC routing: 25% distance saved.
  * Financial savings at ₹94/L and $\text{CO}_2$ offset at 2.68 kg/L.

### 4.4. `backend/services/lang_detect.py`
Script-based and unicode-block language detection for Indian languages:
* Hindi (`hi`), Marathi (`mr`), Tamil (`ta`), Telugu (`te`), Bengali (`bn`), Gujarati (`gu`), Malayalam (`ml`), Kannada (`kn`), English (`en`).

---

## 5. Neural Voice Synthesis (Edge-TTS Regional Accents)

The bot supports bidirectional voice. When responding, it matches the user's language using the following neural voices:

| Language Code | Language | Voice Model Name | Gender | Sample Advisory Script |
| :--- | :--- | :--- | :--- | :--- |
| `hi` | Hindi | `hi-IN-SwaraNeural` | Female | "नमस्ते कैप्टन! आपके निकटतम 35 किलोमीटर पर येलोफिन टूना का अनुकूल क्षेत्र मिला है।" |
| `mr` | Marathi | `mr-IN-AarohiNeural` | Female | "नमस्कार कॅप्टन! ससून डॉकजवळ समुद्राचे तापमान 28.5 अंश सेल्सिअस आहे." |
| `ta` | Tamil | `ta-IN-PallaviNeural` | Female | "வணக்கம் கேப்டன்! உங்கள் துறைமுகத்திற்கு அருகில் சிறந்த மீன்பிடி மண்டலம் உள்ளது." |
| `te` | Telugu | `te-IN-ShrutiNeural` | Female | "నమస్కారం కెప్టెన్! సముద్ర ఉపరితల ఉష్ణోగ్రత 28 డిగ్రీలు ఉంది." |
| `bn` | Bengali | `bn-IN-TanishaaNeural` | Female | "নমস্কার ক্যাপ্টেন! আপনার কাছাকাছি সম্ভাব্য মাছ ধরার অঞ্চল শনাক্ত করা হয়েছে।" |
| `gu` | Gujarati | `gu-IN-DhwaniNeural` | Female | "નમસ્તે કેપ્ટન! વેરાવળ બંદરેથી 20 કિલોમીટર દૂર અનુકૂળ માછીમારી વિસ્તાર છે." |
| `ml` | Malayalam| `ml-IN-SobhanaNeural` | Female | "നമസ്കാരം ക്യാപ്റ്റൻ! കൊച്ചി തീരത്ത് കാലാവസ്ഥ അനുകൂലമാണ്." |
| `kn` | Kannada | `kn-IN-SapnaNeural` | Female | "ನಮಸ್ಕಾರ ಕ್ಯಾಪ್ಟನ್! ಮಂಗಳೂರು ಬಂದರಿನ ಸಮೀಪ ಸಮುದ್ರ ಸ್ಥಿತಿ ಹೀಗಿದೆ." |
| `en` | English | `en-IN-NeerjaNeural` | Female | "Namaste Captain! Yellowfin Tuna viability is 88% at gear depth 45 meters." |

---

## 6. Database Schemas (SQLite WAL Mode)

```sql
-- Registered Telegram Users & Geo-Fence Watchdog Tracking
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

-- Crowdsourced Catch Ground-Truth Validation Reports
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

-- Multi-Turn Conversational Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    active_location TEXT,
    active_float_id TEXT,
    active_species TEXT,
    active_parameter TEXT,
    last_updated REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Conversational Chat Message History
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

-- Ocean Anomaly Radar (Marine Heatwaves & Thermal Upwelling)
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
```

---

## 7. Configuration & Environment Variables

All settings reside in `backend/.env` (and root `.env`):

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_from_botfather"
TELEGRAM_BOT_USERNAME="LeharAIBot"

# Groq Cloud API (Whisper Speech-to-Text & LLaMA 3.3 70B Reasoning)
GROQ_API_KEY="gsk_your_groq_api_key"

# INCOIS / ARGO Data Paths
ARGO_DB_PATH="backend/data/argo_database.db"

# Server Host & Base URL
BASE_URL="https://lehar-ai.onrender.com"
PORT=8000
```

---

## 8. Current Command & Interaction Catalog

| Trigger | Input Type | Description & System Action | Output Payload |
| :--- | :--- | :--- | :--- |
| `/start` or `/help` | Command / Text | Sends rich onboarding card with 7 inline buttons and a welcome voice note. | Text card + inline keyboard + Edge-TTS audio |
| `[Location Pin]` | Native GPS | Triggers `_handle_location()`: Finds closest ARGO float, computes MLD, thermocline, species viability, and fuel savings. | Detailed physics report + Telegram location pin + Maps URL + Voice advisory |
| `[Voice Note]` | `.ogg` / `.mp3` | Triggers `_handle_voice_message()`: Transcribes via Groq Whisper Turbo (<300ms), echoes transcribed text, and executes NL2SQL reasoning. | Transcribed text echo + Full answer card + Regional voice note |
| `/report <catch>` | Command / Text / Voice | Ingests post-voyage catch data. LLaMA 3.3 extracts species, kg, depth, and logs to `fishermen_reports`. | Verified catch card (`#FR-0017`) + Native thank-you voice note |
| `cmd_pfz` button | Callback Query | Triggers high-yield PFZ query for nearest coastal sector. | Top 3 PFZ zones with coordinates & SST/Chlorophyll |
| `cmd_temp` button | Callback Query | Queries sea surface temperature, salinity, and thermocline depth. | Current SST & subsurface conditions |
| `cmd_storm` button | Callback Query | Checks for marine heatwaves, tropical storms, and extreme anomalies. | Alert status bulletin |
| Natural Query | Free-text | Any question: "Where is Tuna near Mumbai?", "Cochin la meen eppo kidaikkum?", etc. | Full NL2SQL database answer + voice note |

---

## 9. The Master Migration Blueprint: Telegram ➔ WhatsApp Business API

### 9.1. Why Telegram for Hackathon / Demonstration?
1. **Zero Approval Delay:** Telegram bot tokens are created instantly via `@BotFather`.
2. **Built-in Long-Polling:** Works behind NAT/firewalls and localhost without requiring public domain SSL webhooks.
3. **Rich Media Support:** Telegram natively supports dynamic inline keyboards, audio voice notes, and live GPS map pins without per-message template fees.

### 9.2. Why WhatsApp is Essential for Real-World Deployment
1. **User Adoption:** 500M+ Indians use WhatsApp daily. Coastal fishermen already communicate in WhatsApp harbor groups and send voice notes. They rarely have Telegram installed.
2. **Institutional Integration:** INCOIS and MoES can register an official verified Green-Badge Business Number (e.g., `+91-40-INCOIS-PFZ`).
3. **Zero Digital Friction:** Fishermen simply save the number and send a WhatsApp voice note or live location pin.

---

### 9.3. Key Technical Differences: Telegram vs. WhatsApp Cloud API

| Feature | Telegram Bot API (Current) | WhatsApp Cloud API / On-Premises (Target) | Architectural Resolution |
| :--- | :--- | :--- | :--- |
| **Worker Ingestion** | Async Long-Polling (`getUpdates`) | HTTPS Webhook (`POST /api/whatsapp/webhook`) | Create a dedicated FastAPI webhook router verified via Meta `hub.challenge` |
| **User Identity** | Integer `chat_id` (e.g., `584920192`) | Phone Number E.164 (e.g., `+919876543210`) | Abstract as `user_id: str` across both channels |
| **Markdown Parsing** | Telegram Markdown (`*bold*`, `_italic_`, `[link](url)`) | WhatsApp formatting (`*bold*`, `_italic_`, `~strike~`, no hyperlinked text) | Create a formatting sanitizer `format_for_channel(text, channel="whatsapp")` |
| **Interactive Buttons** | Inline Keyboards (unlimited rows & columns) | Interactive Buttons (max 3) or Interactive List Messages (max 10 rows) | Convert quick menus into a WhatsApp Interactive List with sections |
| **Voice Notes** | Sends `.mp3` via `sendVoice` | Media Upload (`POST /v21.0/{phone_number_id}/media`) with `type: audio/ogg; codecs=opus` | Convert Edge-TTS MP3 to Opus OGG using `ffmpeg` or pass direct audio URL |
| **Live Location** | Native `sendLocation(lat, lon)` | `type: "location", location: {"latitude": lat, "longitude": lon, "name": "PFZ Zone"}` | Direct 1:1 mapping in the response payload |
| **24-Hour Window** | Free messaging anytime | Free-form replies allowed within 24h of user message; outside 24h requires pre-approved Template | Use Meta-approved Utility Templates for proactive Guardian alerts |

---

### 9.4. Decoupled Core Architecture: The `MarineBotEngine` Abstraction

To support both Telegram and WhatsApp without duplicating business logic, the code is structured around an engine-adapter pattern:

```
                  ┌───────────────────────┐       ┌───────────────────────┐
                  │ Telegram Poller/Hook  │       │ WhatsApp Meta Webhook │
                  └───────────┬───────────┘       └───────────┬───────────┘
                              │                               │
                              ▼                               ▼
                      ┌───────────────┐               ┌───────────────┐
                      │  TG Adapter   │               │  WA Adapter   │
                      └───────┬───────┘               └───────┬───────┘
                              │ Normalizes to:                │ Normalizes to:
                              │ IncomingMarineMessage         │ IncomingMarineMessage
                              └───────────────┬───────────────┘
                                              ▼
                              ┌───────────────────────────────┐
                              │       MarineBotEngine         │
                              │  (Core Business Logic)        │
                              │  • Physics & MLD              │
                              │  • ICAR-CMFRI Viability       │
                              │  • Groq Whisper / LLaMA       │
                              │  • Edge-TTS Synthesis         │
                              │  • Feedback Engine Logging    │
                              └───────────────┬───────────────┘
                                              │ Returns:
                                              │ MarineBotResponse
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                      ┌───────────────┐               ┌───────────────┐
                      │  TG Formatter │               │  WA Formatter │
                      └───────┬───────┘               └───────┬───────┘
                              ▼                               ▼
                      Telegram send* API             Meta Graph API Send
```

#### Unified Data Contract:
```python
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

@dataclass
class IncomingMarineMessage:
    channel: str              # "telegram" | "whatsapp"
    user_id: str              # chat_id or E.164 phone number
    sender_name: str          # "Captain Koli"
    message_type: str         # "text" | "voice" | "location" | "button_click"
    text_content: Optional[str] = None
    voice_bytes: Optional[bytes] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    button_payload: Optional[str] = None

@dataclass
class MarineBotResponse:
    text_message: str
    voice_audio_bytes: Optional[bytes] = None
    location_pin: Optional[tuple[float, float]] = None  # (lat, lon)
    location_label: Optional[str] = None
    action_buttons: Optional[List[Dict[str, str]]] = None # [{"title": "PFZ", "payload": "cmd_pfz"}]
    maps_url: Optional[str] = None
```

---

## 10. WhatsApp Cloud API Integration Code Template

When ready to activate WhatsApp, implement the following adapter:

```python
# backend/routers/whatsapp.py
import os
import httpx
from fastapi import APIRouter, Request, Response, HTTPException

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "lehar_incois_secure_token_2026")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

@router.get("/webhook")
async def verify_webhook(request: Request):
    """Meta Webhook Challenge Verification."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@router.post("/webhook")
async def handle_whatsapp_webhook(request: Request):
    """Processes incoming WhatsApp messages (text, voice, location, interactive list)."""
    payload = await request.json()
    
    # Check if this is an incoming message event
    entry = payload.get("entry", [{}])[0]
    changes = entry.get("changes", [{}])[0]
    value = changes.get("value", {})
    messages = value.get("messages", [])
    
    if not messages:
        return {"status": "ignored_no_message"}
    
    msg = messages[0]
    sender_phone = msg["from"]  # e.g., "919876543210"
    msg_type = msg.get("type")
    
    # 1. Location Message
    if msg_type == "location":
        loc = msg["location"]
        lat, lon = loc["latitude"], loc["longitude"]
        # Route to MarineBotEngine...
        
    # 2. Voice Audio Message
    elif msg_type == "audio":
        media_id = msg["audio"]["id"]
        # Download audio via Meta Graph API media endpoint -> Transcribe with Groq Whisper -> Route...
        
    # 3. Text Message
    elif msg_type == "text":
        user_text = msg["text"]["body"]
        # Route to MarineBotEngine...
        
    return {"status": "processed"}
```

---

## 11. Action Plan: Next Strategic Enhancements

To make the bot truly "world-class / enterprise-grade" for the grand finale and government adoption:

### Phase 1: High-Impact Telegram Advancements (Hackathon Ready)
1. **Multi-Turn Conversational Memory Integration:**
   * Bind Telegram chats to the existing `chat_sessions` and `chat_messages` tables in `db.py`.
   * When a fisherman says "Show temperature near Mumbai", followed by "Are there tuna there?", the bot remembers that the context is Mumbai.
2. **Live Cyclone & IMD Sea Weather Radar:**
   * Integrate real-time wind speed (knots), wave height ($H_s$ in meters), and sea state warnings (Rough/Very Rough) into the `/temp` and `/storm` commands using open marine APIs.
3. **Interactive Language Switcher (`/language`):**
   * Allow fishermen to choose their preferred advisory language via one-tap buttons (`English`, `हिंदी`, `தமிழ்`, `తెలుగు`, `मराठी`, `বাংলা`, `ગુજરાતી`, `മലയാളം`, `ಕನ್ನಡ`).
   * Store their preference in `telegram_subscribers.language` so all voice notes automatically speak in that dialect.
4. **Emergency S.O.S. Distress Beacon (`/sos`):**
   * Immediate distress command that logs the vessel's last known GPS coordinates to the dashboard and sends Indian Coast Guard emergency helpline coordinates (`1554`).

### Phase 2: Decoupled Core Refactoring (`MarineBotEngine`)
1. Create `backend/services/marine_engine.py`:
   * Extract physics, Groq Whisper STT, Groq LLaMA reasoning, and Edge-TTS synthesis out of `telegram_bot.py` into a channel-agnostic engine.
2. Make `backend/services/telegram_bot.py` a pure adapter that converts Telegram inputs to `IncomingMarineMessage` and calls `MarineBotEngine`.

### Phase 3: WhatsApp Cloud API Staging
1. Create `backend/routers/whatsapp.py` implementing Meta's Webhook challenge and incoming message parser.
2. Setup test credentials using Meta Developer Portal (test phone number + permanent access token).
3. Test dual-dispatch: sending an advisory to both Telegram and WhatsApp simultaneously from the same event.

### Phase 4: ISRO NavIC / Deep-Sea Satellite Compression
1. Beyond 20 nautical miles offshore, cellular towers lose connectivity.
2. Implement an ultra-compact byte-packing format (32 bytes per PFZ advisory) compatible with **ISRO NavIC MSS transponders** for deep-sea reception.

---

## 12. Marine Safety Suite Architecture (Production Complete)

The bot features a comprehensive 3-pillar safety suite engineered for real coastal rescue operations:

### 12.1. Geofence Hazard Interception
* **Logic:** When coordinates are shared, `check_geofence_hazard(lat, lon)` runs before any PFZ calculation.
* **PFZ Suppression:** If inside a cyclone, storm surge, or high swell zone, fish recommendations are **completely suppressed** to eliminate greed-based peril.
* **Escape Vector:** Computes the direct vector to the nearest safe port, sends a Google Maps navigation deep-link, a native map pin, and an Edge-TTS voice alarm.
* **Overlapping Hazard Resolution:** Multiple zones are sorted by severity rank (`critical > severe > warning > watch`), ensuring the highest-threat polygon governs the response.

### 12.2. Zero-Latency `/sos` Distress Beacon Pipeline
* **Response Time:** `< 1.0 second` (Zero LLM delay, bypasses all neural models).
* **Helplines Dispatched:** Indian Coast Guard `1554` (Toll-free), VHF Channel `16` (International distress), Marine Police `1093`.
* **SAR Station Routing:** Automatically resolves nearest Indian Coast Guard District Headquarters (DHQ-1 through DHQ-7).
* **False-Positive Guard:** Explicit commands (`/sos`, `/mayday`) trigger instantly. Conversational mentions (*"emergency"*, *"bachao"*) spawn a 1-tap confirmation card with a **90-second fail-safe timer** that auto-escalates if uncancelled.
* **At-Sea Crowd Rescue:** Only broadcasts to registered mariners who are actively offshore (`> 3km` from port and active in last 24h) to avoid panicking ashore crews.
* **Simulated Protocol Demo:** 12 seconds post-beacon, an acknowledgment message simulates Maritime Rescue Coordination Centre (MRCC) interceptor craft dispatch.

### 12.3. Return-Route Safety Watchdog & 24/7 Keep-Alive
* **Watchdog Surveillance:** Evaluates offshore boats (`> 20 km` out) every 60s against Open-Meteo wave physics ($H_s \ge 2.3\text{m}$, wind $\ge 24\text{ knots}$).
* **Persistent Debounce:** Uses `telegram_subscribers.last_weather_alert_at` SQLite column (30-minute debounce window) to prevent spamming while surviving container restarts.
* **Render Free-Tier Zero-Sleep Daemon:** FastAPI background daemon self-pings `/health` every 10 minutes, complemented by webhook reception at `/api/telegram/webhook`.
* **Data Hygiene:** Automatically purges `location_history` records older than 48 hours.

---

## 13. Verification & Health Monitoring

* **Status Endpoint:** `GET https://lehar-ai.onrender.com/api/telegram/status`
  * Response:
    ```json
    {
      "status": "online",
      "bot_username": "@LeharAIBot",
      "token_configured": true,
      "active_worker": true,
      "subscribers_count": 1,
      "messages_handled": 4,
      "polling_mode": "async_long_polling",
      "qr_url": "https://t.me/LeharAIBot"
    }
    ```
* **Catch Feedback Verification:** `GET https://lehar-ai.onrender.com/api/reports`
* **Health Check:** `GET https://lehar-ai.onrender.com/health` (Reports active profiles & floats).
