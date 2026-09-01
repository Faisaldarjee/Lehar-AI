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

FEEDBACK_KEYWORDS = [
    "kg", "kilo", "ton", "quintal", "pakda", "mila", "caught", "catch", "depth", "meter",
    "meter", "fish", "machhli", "tuna", "bangda", "pomfret", "surmai", "rawas", "sardine",
    "prawn", "chingri", "ayala", "vanjaram", "mathi", "koduva", "pfz", "advisory", "good",
    "achha", "kharab", "bohot", "badiya", "nandri", "dhanyawad", "report", "log"
]


def is_likely_catch_feedback(text: str) -> bool:
    """Check if the incoming user text is a post-voyage catch report or advisory feedback."""
    text_lower = text.lower()
    if text_lower.startswith("/report") or text_lower.startswith("report"):
        return True
    
    # Check for presence of catch units + species or fishing terms
    matches = sum(1 for kw in FEEDBACK_KEYWORDS if kw in text_lower)
    return matches >= 2


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
    """
    groq_key = os.getenv("GROQ_API_KEY")

    # 1. Detect language metadata
    lang_meta = detect_script_language(text)
    detected_lang_code = lang_meta.get("code", "hi")
    detected_lang_name = lang_meta.get("name", "Hindi")

    extracted_data = {
        "species": "Pelagic Mixed Catch",
        "quantity_kg": 75.0,
        "depth_m": 25.0,
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
                "JSON Schema: {\n"
                '  "species": string (common name e.g. Yellowfin Tuna, Indian Mackerel, Silver Pomfret),\n'
                '  "quantity_kg": number (e.g. 250.0),\n'
                '  "depth_m": number (e.g. 35.0),\n'
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
            if parsed.get("quantity_kg"):
                extracted_data["quantity_kg"] = float(parsed["quantity_kg"])
            if parsed.get("depth_m"):
                extracted_data["depth_m"] = float(parsed["depth_m"])
            if parsed.get("satisfaction_score"):
                extracted_data["satisfaction_score"] = int(parsed["satisfaction_score"])
            if parsed.get("harbour") and len(parsed["harbour"]) > 2:
                extracted_data["harbour"] = parsed["harbour"]
            if parsed.get("localized_thank_you"):
                extracted_data["localized_reply"] = parsed["localized_thank_you"]

        except Exception as e:
            logger.debug(f"[Feedback Engine] LLM extraction fallback to regex: {e}")

    # 3. Deterministic Regex Fallback for Species, Quantity & Depth
    if "localized_reply" not in extracted_data:
        # Regex quantity
        qty_m = re.search(r"(\d+)\s*(kg|kilo|ton|quintal)?", text, re.IGNORECASE)
        if qty_m:
            extracted_data["quantity_kg"] = float(qty_m.group(1))

        # Regex depth
        depth_m = re.search(r"(\d+)\s*(m|meter|metre)", text, re.IGNORECASE)
        if depth_m:
            extracted_data["depth_m"] = float(depth_m.group(1))

        # Species matching
        sp = detect_species_in_query(text)
        if sp:
            extracted_data["species"] = sp["common_name"]

        # Localized default confirmations
        greetings = {
            "hi": f"धन्यवाद कैप्टन {reporter_name}! आपका कैच रिपोर्ट ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) वेरिफाई होकर लाइव मैप पर दर्ज हो गया है। INCOIS PFZ एडवाइजरी को वैलिडेट करने के लिए आभार!",
            "ta": f"நன்றி கேப்டன் {reporter_name}! உங்கள் மீன்பிடி அறிக்கை ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) வெற்றிகரமாக சேமிக்கப்பட்டது. INCOIS PFZ ஆலோசனைக்கு உதவியதற்கு நன்றி!",
            "te": f"ధన్యవాదాలు కెప్టెన్ {reporter_name}! మీ క్యాచ్ రిపోర్ట్ ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) విజయవంతంగా నమోదైంది.",
            "mr": f"धन्यवाद कॅप्टन {reporter_name}! आपला मासेमारी अहवाल ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) थेट नकाशावर जतन केला आहे.",
            "ml": f"നന്ദി ക്യാപ്റ്റൻ {reporter_name}! നിങ്ങളുടെ ക്യാച്ച് റിപ്പോർട്ട് ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) വിജയകരമായി രേഖപ്പെടുത്തി.",
            "bn": f"ধন্যবাদ ক্যাপ্টেন {reporter_name}! আপনার মাছ ধরার রিপোর্ট ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) সফলভাবে যুক্ত হয়েছে।",
            "gu": f"આભાર કેપ્ટન {reporter_name}! તમારો પકડાયેલ માછલીનો અહેવાલ ({extracted_data['quantity_kg']:.0f}kg {extracted_data['species']}) લાઈવ નકશા પર સાચવવામાં આવ્યો છે.",
            "en": f"Thank you, Captain {reporter_name}! Your verified catch report of {extracted_data['quantity_kg']:.0f}kg {extracted_data['species']} at {extracted_data['depth_m']:.0f}m has been pinned to the Lehar AI Live Community Map.",
        }
        extracted_data["localized_reply"] = greetings.get(detected_lang_code, greetings["hi"])

    # 4. Save into SQLite Database for Live GIS Map Layer
    report_id = save_fisherman_report(
        latitude=extracted_data["latitude"],
        longitude=extracted_data["longitude"],
        species=extracted_data["species"],
        quantity_kg=extracted_data["quantity_kg"],
        depth_m=extracted_data["depth_m"],
        reporter_id=f"tg_{chat_id}" if chat_id else "web_user",
        reporter_name=reporter_name,
        harbour=extracted_data["harbour"],
        notes=f"Rating: {extracted_data['satisfaction_score']}/5 | {text}"
    )

    extracted_data["report_id"] = report_id
    extracted_data["detected_language"] = detected_lang_code
    return extracted_data
