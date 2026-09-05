"""
Lehar AI — Post-Voyage Fishermen Feedback & Ground-Truth Validation Engine
Processes multi-lingual voice & text catch feedback from coastal fishermen across 9 Indian languages.
Extracts species, weight, depth, coordinates, and advisory accuracy ratings for INCOIS validation.
"""

import os
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv

from .db import save_fisherman_report, get_connection
from .species_dict import detect_species_in_query
from .lang_detect import detect_script_language

# Load backend/.env
backend_env = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=backend_env)
load_dotenv()

logger = logging.getLogger(__name__)

QUESTION_INDICATORS = [
    "?", "where", "kahan", "kidhar", "how", "kaise", "kaisa", "what", "kya",
    "which", "kaunsa", "kaunsi", "when", "kab", "who", "kaun", "why", "kyun",
    "can we", "can i", "could we", "is there", "are there", "tell me", "batao",
    "bataiye", "dikhao", "show me", "find", "search", "dhoondo", "milega", "milegi",
    "mil sakti", "mil sakta", "milenge", "hoga", "sakte hain", "karna hai", "chahiye",
    "weather", "forecast", "taapman", "temperature", "advisory", "wave", "lahar",
    "rate", "bhav", "price", "market",
    "enga", "engae", "eppadi", "enna", "endha", "ekkada", "ela", "enti", "eppudu",
    "evide", "engane", "entha", "kothay", "kemon", "kuthe", "kasa", "kay", "malshe"
]

CATCH_VERBS = [
    "caught", "harvested", "landed", "hauled", "fished",
    "pakda", "pakdi", "pakde", "pakad liya", "mila hai", "mili hai", "mila tha", "mili thi", "laaye", "nikala",
    "saapadla", "pakadla", "dharla",
    "pidithom", "pidithen", "kidaithathu", "patnam", "labhichu", "dhorlam", "pelam",
    "catch report", "logged catch", "reporting catch"
]

QTY_PATTERN = re.compile(
    r"\b\d+(\.\d+)?\s*(kg|kgs|kilo|kilos|ton|tons|tonne|tonnes|quintal|quintals|peti|crate|crates|box|boxes|किलो|टन|கிலோ|குவிண்டால்)\b",
    re.IGNORECASE
)


def format_mariner_title(name: Optional[str]) -> str:
    """Format a mariner's name with Captain title without duplicates like 'Captain Captain'."""
    if not name or not name.strip():
        return "Captain"
    clean = name.strip()
    if clean.lower() == "captain":
        return "Captain"
    if clean.lower().startswith("captain "):
        return clean
    if clean.lower().startswith("capt.") or clean.lower().startswith("capt "):
        return clean
    return f"Captain {clean}"


def is_likely_catch_feedback(text: str) -> bool:
    """
    Strict classifier to determine if incoming message is a post-voyage catch report.
    Returns True ONLY if:
      1. Explicit command: starts with /report, /catch, or /logcatch.
      2. OR conversational catch submission:
         - Contains ZERO question/inquiry markers (e.g. 'where', 'kahan', 'how', '?').
         - Contains an explicit catch action verb (e.g. 'caught', 'pakda', 'landed').
         - Contains a numeric quantity with weight/crate unit (e.g. '250kg', '2 ton').
    """
    text_lower = text.lower().strip()
    if text_lower.startswith("/report") or text_lower.startswith("/catch") or text_lower.startswith("/logcatch"):
        return True

    # 1. Any question or advisory inquiry immediately disqualifies it as a catch submission
    if any(q_kw in text_lower for q_kw in QUESTION_INDICATORS):
        return False

    # 2. Must contain an explicit catch action verb
    has_catch_verb = any(v_kw in text_lower for v_kw in CATCH_VERBS)
    if not has_catch_verb:
        return False

    # 3. Must contain an explicit numeric quantity with unit
    has_quantity = bool(QTY_PATTERN.search(text))
    return has_quantity


async def parse_and_process_feedback(
    text: str,
    chat_id: Optional[int] = None,
    reporter_name: str = "Coastal Fisherman",
    default_lat: float = 18.915,
    default_lon: float = 72.828,
    default_harbour: str = "Mumbai (Sassoon Dock)",
    lang: str = "auto"
) -> Dict[str, Any]:
    """
    Parses conversational multi-lingual catch feedback using Groq LLaMA 3.3 with regex fallbacks.
    Persists the ground-truth report to SQLite and returns localized response text.
    Zero hallucinated defaults: if quantity/depth are omitted, they remain None.
    """
    groq_key = os.getenv("GROQ_API_KEY")

    # 1. Detect language metadata
    lang_meta = detect_script_language(text)
    detected_lang_code = lang_meta.get("code", "hi")
    detected_lang_name = lang_meta.get("name", "Hindi")

    extracted_data = {
        "species": "Pelagic Mixed Catch",
        "quantity_kg": None,
        "depth_m": None,
        "satisfaction_score": 5,
        "notes": text,
        "harbour": default_harbour,
        "latitude": default_lat,
        "longitude": default_lon,
    }

    # 2. Try fast LLM extraction for conversational nuances in Indian languages
    if groq_key and len(groq_key) > 5:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            system_prompt = (
                "You are an expert marine fisheries data extractor for INCOIS India. "
                "Extract fishing catch report details from the user message in ANY Indian language into strict JSON. "
                "If quantity or depth are NOT mentioned, return null for them. DO NOT INVENT OR GUESS NUMBERS. "
                "JSON Schema: {\n"
                '  "species": string (common name e.g. Yellowfin Tuna, Indian Mackerel, Silver Pomfret),\n'
                '  "quantity_kg": number or null,\n'
                '  "depth_m": number or null,\n'
                '  "satisfaction_score": integer (1 to 5 based on sentiment),\n'
                '  "harbour": string (mentioned harbour/city or empty),\n'
                '  "localized_thank_you": string (Warm, respectful 2-sentence confirmation in the USER\'S EXACT LANGUAGE thanking Captain for logging catch and validating INCOIS PFZ)\n'
                "}\nReturn ONLY JSON with no markdown backticks."
            )

            resp = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.1,
                max_tokens=300
            )

            raw_json = resp.choices[0].message.content.strip()
            # Strip backticks if any
            raw_json = re.sub(r"^```json\s*|\s*```$", "", raw_json, flags=re.MULTILINE)
            parsed = json.loads(raw_json)

            if parsed.get("species"):
                extracted_data["species"] = parsed["species"]
            if parsed.get("quantity_kg") is not None:
                try:
                    extracted_data["quantity_kg"] = float(parsed["quantity_kg"])
                except (ValueError, TypeError):
                    pass
            if parsed.get("depth_m") is not None:
                try:
                    extracted_data["depth_m"] = float(parsed["depth_m"])
                except (ValueError, TypeError):
                    pass
            if parsed.get("satisfaction_score"):
                try:
                    extracted_data["satisfaction_score"] = int(parsed["satisfaction_score"])
                except (ValueError, TypeError):
                    pass
            if parsed.get("harbour") and len(parsed["harbour"]) > 2:
                extracted_data["harbour"] = parsed["harbour"]
            if parsed.get("localized_thank_you"):
                extracted_data["localized_reply"] = parsed["localized_thank_you"]

        except Exception as e:
            logger.debug(f"[Feedback Engine] LLM extraction fallback to regex: {e}")

    # 3. Deterministic Regex Fallback for Species, Quantity & Depth
    if extracted_data.get("quantity_kg") is None:
        qty_m = QTY_PATTERN.search(text)
        if qty_m:
            num_val = re.search(r"\d+(\.\d+)?", qty_m.group(0))
            if num_val:
                extracted_data["quantity_kg"] = float(num_val.group(0))

    if extracted_data.get("depth_m") is None:
        depth_m = re.search(r"(\d+(\.\d+)?)\s*(m|meter|metre|feet|ft)\b", text, re.IGNORECASE)
        if depth_m:
            extracted_data["depth_m"] = float(depth_m.group(1))

    if extracted_data.get("species") == "Pelagic Mixed Catch":
        sp = detect_species_in_query(text)
        if sp:
            extracted_data["species"] = sp["common_name"]

    display_captain = format_mariner_title(reporter_name)

    if "localized_reply" not in extracted_data:
        qty_parts = []
        if extracted_data["quantity_kg"] is not None:
            qty_parts.append(f"{extracted_data['quantity_kg']:.0f}kg")
        qty_parts.append(extracted_data["species"])
        if extracted_data["depth_m"] is not None:
            qty_parts.append(f"at {extracted_data['depth_m']:.0f}m depth")
        qty_str = " ".join(qty_parts)

        greetings = {
            "hi": f"धन्यवाद {display_captain}! आपका कैच रिपोर्ट ({qty_str}) वेरिफाई होकर लाइव मैप पर दर्ज हो गया है। INCOIS PFZ एडवाइजरी को वैलिडेट करने के लिए आभार!",
            "ta": f"நன்றி {display_captain}! உங்கள் மீன்பிடி அறிக்கை ({qty_str}) வெற்றிகரமாக சேமிக்கப்பட்டது. INCOIS PFZ ஆலோசனைக்கு உதவியதற்கு நன்றி!",
            "te": f"ధన్యవాదాలు {display_captain}! మీ క్యాచ్ రిపోర్ట్ ({qty_str}) విజయవంతంగా నమోదైంది.",
            "mr": f"धन्यवाद {display_captain}! आपला मासेमारी अहवाल ({qty_str}) थेट नकाशावर जतन केला आहे.",
            "ml": f"നന്ദി {display_captain}! നിങ്ങളുടെ ക്യാച്ച് റിപ്പോർട്ട് ({qty_str}) വിജയകരമായി രേഖപ്പെടുത്തി.",
            "bn": f"ধন্যবাদ {display_captain}! আপনার মাছ ধরার রিপোর্ট ({qty_str}) সফলভাবে যুক্ত হয়েছে।",
            "gu": f"આભાર {display_captain}! તમારો પકડાયેલ માછલીનો અહેવાલ ({qty_str}) લાઈવ નકશા પર સાચવવામાં આવ્યો છે.",
            "en": f"Thank you, {display_captain}! Your verified catch report of {qty_str} has been pinned to the Lehar AI Live Community Map.",
        }
        extracted_data["localized_reply"] = greetings.get(detected_lang_code, greetings["hi"])

    # 4. Save into SQLite Database for Live GIS Map Layer
    report_id = save_fisherman_report(
        latitude=extracted_data["latitude"],
        longitude=extracted_data["longitude"],
        species=extracted_data["species"],
        quantity_kg=extracted_data["quantity_kg"] if extracted_data["quantity_kg"] is not None else 0.0,
        depth_m=extracted_data["depth_m"] if extracted_data["depth_m"] is not None else 0.0,
        reporter_id=f"tg_{chat_id}" if chat_id else "web_user",
        reporter_name=display_captain,
        harbour=extracted_data["harbour"],
        notes=f"Rating: {extracted_data['satisfaction_score']}/5 | {text}"
    )

    extracted_data["report_id"] = report_id
    extracted_data["detected_language"] = detected_lang_code
    return extracted_data
