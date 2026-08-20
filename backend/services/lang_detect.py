"""
Lehar AI — Script-Based & Lexical Multi-Language Detection Engine
Automatically detects the query language and script to respond natively in the same register.

Supports:
- Devanagari (Hindi)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Kannada (ಕನ್ನಡ)
- Bengali (বাংলা)
- Malayalam (മലയാളം)
- Gujarati (ગુજરાતી)
- Hinglish (Hindi written in Latin script)
- English
"""

import re
from typing import Dict, Any

# Common Romanized Hindi / Hinglish tokens
HINGLISH_KEYWORDS = {
    "hai", "hain", "kya", "kaisa", "kaisi", "kaise", "mein", "me", "ka", "ki", "ke",
    "ko", "se", "par", "paas", "kahaan", "kahan", "kitna", "kitni", "kitne", "pakad",
    "machli", "machhli", "samundar", "paani", "taapman", "batao", "bataiye", "dikhaye",
    "kardo", "karo", "raha", "rahi", "aaj", "kal", "abhi", "kripya", "namaste", "chahiye",
    "milega", "milegi", "karein", "ho", "tha", "thi", "gaya", "gayi", "hoga", "sakte", "sakta"
}

STRONG_HINGLISH_TOKENS = {
    "machhli", "machli", "samundar", "kahaan", "taapman", "batao", "bataiye", "chahiye", "pakad"
}


def detect_script_language(text: str) -> Dict[str, Any]:
    """
    Analyzes input text via Unicode code point ranges and lexical analysis.
    Returns language metadata, TTS locale, display label, and LLM prompt instructions.
    """
    if not text or not text.strip():
        return {
            "code": "en",
            "label": "English",
            "script": "Latin",
            "tts_locale": "en-IN",
            "system_instruction": "The user's query was in English. Reply in clear, professional English."
        }

    # Count characters in specific Indic Unicode blocks
    devanagari_count = 0
    tamil_count = 0
    telugu_count = 0
    kannada_count = 0
    bengali_count = 0
    malayalam_count = 0
    gujarati_count = 0

    for ch in text:
        cp = ord(ch)
        if 0x0900 <= cp <= 0x097F:
            devanagari_count += 1
        elif 0x0B80 <= cp <= 0x0BFF:
            tamil_count += 1
        elif 0x0C00 <= cp <= 0x0C7F:
            telugu_count += 1
        elif 0x0C80 <= cp <= 0x0CFF:
            kannada_count += 1
        elif 0x0980 <= cp <= 0x09FF:
            bengali_count += 1
        elif 0x0D00 <= cp <= 0x0D7F:
            malayalam_count += 1
        elif 0x0A80 <= cp <= 0x0AFF:
            gujarati_count += 1

    # 1. Native Indic Scripts
    if devanagari_count >= 2:
        # Check for Marathi specific vocabulary in Devanagari
        marathi_markers = {"मासे", "कुठे", "मिळतील", "सांगा", "आहेत", "कशी", "कसा", "करावे", "करा", "ताशी", "किनारपट्टी", "समुद्रात", "पाणी"}
        if any(marker in text for marker in marathi_markers):
            return {
                "code": "mr",
                "label": "मराठी (Marathi)",
                "script": "Devanagari",
                "tts_locale": "mr-IN",
                "system_instruction": "The user's query was in Marathi (Devanagari script). Reply entirely in natural, fluent Marathi."
            }
        return {
            "code": "hi",
            "label": "हिंदी (Hindi)",
            "script": "Devanagari",
            "tts_locale": "hi-IN",
            "system_instruction": "The user's query was in Hindi (Devanagari script). Reply entirely in natural, fluent Hindi in Devanagari script."
        }

    if tamil_count >= 2:
        return {
            "code": "ta",
            "label": "தமிழ் (Tamil)",
            "script": "Tamil",
            "tts_locale": "ta-IN",
            "system_instruction": "The user's query was in Tamil (தமிழ் script). Reply entirely in natural, fluent Tamil."
        }

    if telugu_count >= 2:
        return {
            "code": "te",
            "label": "తెలుగు (Telugu)",
            "script": "Telugu",
            "tts_locale": "te-IN",
            "system_instruction": "The user's query was in Telugu (తెలుగు script). Reply entirely in natural, fluent Telugu."
        }

    if kannada_count >= 2:
        return {
            "code": "kn",
            "label": "ಕನ್ನಡ (Kannada)",
            "script": "Kannada",
            "tts_locale": "kn-IN",
            "system_instruction": "The user's query was in Kannada (ಕನ್ನಡ script). Reply entirely in natural, fluent Kannada."
        }

    if bengali_count >= 2:
        return {
            "code": "bn",
            "label": "বাংলা (Bengali)",
            "script": "Bengali",
            "tts_locale": "bn-IN",
            "system_instruction": "The user's query was in Bengali (বাংলা script). Reply entirely in natural, fluent Bengali."
        }

    if malayalam_count >= 2:
        return {
            "code": "ml",
            "label": "മലയാളം (Malayalam)",
            "script": "Malayalam",
            "tts_locale": "ml-IN",
            "system_instruction": "The user's query was in Malayalam (മലയാളം script). Reply entirely in natural, fluent Malayalam."
        }

    if gujarati_count >= 2:
        return {
            "code": "gu",
            "label": "ગુજરાતી (Gujarati)",
            "script": "Gujarati",
            "tts_locale": "gu-IN",
            "system_instruction": "The user's query was in Gujarati (ગુજરાતી script). Reply entirely in natural, fluent Gujarati."
        }

    # 2. Latin Script: Check for Hinglish vs English
    clean_words = re.findall(r'[a-zA-Z]+', text.lower())
    hinglish_matches = [w for w in clean_words if w in HINGLISH_KEYWORDS]
    has_strong_hinglish = any(w in STRONG_HINGLISH_TOKENS for w in clean_words)

    if len(hinglish_matches) >= 2 or has_strong_hinglish:
        return {
            "code": "hi-latin",
            "label": "Hinglish",
            "script": "Latin",
            "tts_locale": "hi-IN",
            "system_instruction": "The user's query was in casual Hinglish (Hindi written in Roman/Latin script). Reply in natural, conversational Hinglish (Hindi written in Roman English script) with friendly phrasing. Do not use pure English or pure Devanagari script."
        }

    # Default to English
    return {
        "code": "en",
        "label": "English",
        "script": "Latin",
        "tts_locale": "en-IN",
        "system_instruction": "The user's query was in English. Reply in clear, professional English."
    }
