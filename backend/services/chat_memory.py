"""
Lehar AI Backend — Multi-Turn Conversational Memory & Context Resolution Service
Maintains session state and resolves coreferences, pronouns, and sector continuity across turns.
"""

from __future__ import annotations
import re
import time
from typing import Any
from dataclasses import dataclass, field
from .species_dict import detect_species_in_query


KNOWN_COASTAL_LOCATIONS = [
    # Gujarat
    "veraval", "porbandar", "okha", "dwarka", "mangrol", "jakhau", "mandvi", "kandla", "mundra", "saurashtra", "kutch", "gujarat",
    "વેરાવળ", "પોરબંદર", "ઓખા", "દ્વારકા", "માંગરોળ", "ગુજરાત", "वेरावल", "पोरबंदर", "ओखा", "द्वारका", "गुजरात",
    # Maharashtra
    "mumbai", "bombay", "sassoon", "versova", "ratnagiri", "malvan", "alibaug", "alibag", "murud", "harnai", "dahanu", "sindhudurg", "konkan", "maharashtra",
    "मुंबई", "मुम्बई", "ससून", "वर्सोवा", "रत्नागिरी", "मालवण", "अलिबाग", "सिंधुदुर्ग", "कोकण", "महाराष्ट्र",
    # Goa
    "goa", "panaji", "malim", "vasco", "cortalim", "mormugao", "गोवा", "पणजी",
    # Karnataka
    "karwar", "baithkol", "malpe", "udupi", "mangalore", "mangaluru", "honnavar", "bhatkal", "karnataka",
    "कारवार", "मंगलोर", "उडुपी", "ಮಾಲ್ಪೆ", "ಮಂಗಳೂರು", "ಕಾರವಾರ", "ಕರ್ನಾಟಕ",
    # Kerala
    "kochi", "cochin", "munambam", "beypore", "kozhikode", "calicut", "kollam", "neendakara", "vizhinjam", "trivandrum", "thoppumpady", "malabar", "kerala",
    "കൊച്ചി", "ബേപ്പൂർ", "കോഴിക്കോട്", "കൊല്ലം", "നീണ്ടകര", "വിഴിഞ്ഞം", "കേരളം", "कोच्चि", "केरल", "कालीकट", "कोझिकोड",
    # Tamil Nadu & Puducherry
    "chennai", "madras", "kasimedu", "royapuram", "tuticorin", "thoothukudi", "rameswaram", "rameshwaram", "mandapam", "nagapattinam", "cuddalore", "kanyakumari", "colachel", "coromandel", "tamil nadu",
    "சென்னை", "காசிமேடு", "தூத்துக்குடி", "ராமேஸ்வரம்", "நாகப்பட்டினம்", "கடலூர்", "கன்னியாகுமரி", "தமிழ்நாடு", "चेन्नई", "तमिलनाडु", "रामेश्वरम", "तूतीकोरिन", "कन्याकुमारी",
    # Andhra Pradesh
    "visakhapatnam", "vizag", "kakinada", "machilipatnam", "nizampatnam", "krishnapatnam", "andhra", "andhra pradesh",
    "విశాఖపట్నం", "కాకినాడ", "మచిలీపట్నం", "ఆంధ్ర", "विशाखापट्टनम", "वाइज़ैग", "काकीनाडा", "मछलीपट्टनम", "आंध्र",
    # Odisha
    "paradip", "paradeep", "dhamra", "chandipur", "puri", "gopalpur", "odisha", "orissa",
    "ପାରାଦ୍ୱୀପ", "ଧାମରା", "ପୁରୀ", "ଓଡ଼ିଶା", "पारादीप", "धामरा", "पुरी", "ओडिशा",
    # West Bengal
    "digha", "sankarpur", "kakdwip", "frasergunj", "diamond harbour", "sundarbans", "kolkata", "calcutta", "hooghly", "bengal", "west bengal",
    "দীঘা", "শঙ্করপুর", "কাকদ্বীপ", "সুন্দরবন", "কলকাতা", "বাঙলা", "পশ্চিমবঙ্গ", "दीघा", "सुंदरबन", "कोलकाता", "बंगाल",
    # Island Territories
    "port blair", "andaman", "nicobar", "kavaratti", "agatti", "lakshadweep", "पोर्ट ब्लेयर", "अंडमान", "लक्षद्वीप",
    # Maritime Basins
    "arabian sea", "bay of bengal", "indian ocean", "gulf of kutch", "gulf of khambhat", "gulf of mannar", "palk strait",
    "अरब सागर", "बंगाल की खाड़ी", "हिन्द महासागर", "மன்னார் வளைகுடா"
]


@dataclass
class ConversationTurn:
    user_query: str
    bot_summary: str
    timestamp: float
    detected_location: str | None = None
    detected_float_id: str | None = None
    detected_species: str | None = None


@dataclass
class SessionContext:
    session_id: str
    last_updated: float = field(default_factory=time.time)
    active_location: str | None = None
    active_float_id: str | None = None
    active_species: str | None = None
    active_parameter: str | None = None
    history: list[ConversationTurn] = field(default_factory=list)


# In-memory thread-safe session store
SESSION_STORE: dict[str, SessionContext] = {}
MAX_SESSION_HISTORY = 10
SESSION_EXPIRY_SECONDS = 3600 * 24  # 24 hours durable session window


def _load_session_from_db(session_id: str) -> SessionContext | None:
    """Load persistent session context and recent conversation turns from SQLite."""
    try:
        from .db import get_connection
        with get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM chat_sessions WHERE session_id = ?",
                (session_id,)
            ).fetchone()

            if not row:
                return None

            session = SessionContext(
                session_id=session_id,
                last_updated=float(row["last_updated"]),
                active_location=row["active_location"],
                active_float_id=row["active_float_id"],
                active_species=row["active_species"],
                active_parameter=row["active_parameter"],
                history=[]
            )

            # Load recent message history
            msg_rows = conn.execute(
                """
                SELECT user_query, bot_summary, timestamp, detected_location, detected_float_id, detected_species
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (session_id, MAX_SESSION_HISTORY)
            ).fetchall()

            for mr in msg_rows:
                session.history.append(
                    ConversationTurn(
                        user_query=mr["user_query"],
                        bot_summary=mr["bot_summary"],
                        timestamp=float(mr["timestamp"]),
                        detected_location=mr["detected_location"],
                        detected_float_id=mr["detected_float_id"],
                        detected_species=mr["detected_species"]
                    )
                )

            return session
    except Exception as e:
        print(f"[ChatMemory] DB load fallback: {e}")
        return None


def _persist_session_to_db(session: SessionContext, turn: ConversationTurn | None = None) -> None:
    """Persist updated session metadata and new conversation turn to SQLite."""
    try:
        from .db import get_connection
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO chat_sessions (session_id, active_location, active_float_id, active_species, active_parameter, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    active_location = excluded.active_location,
                    active_float_id = excluded.active_float_id,
                    active_species = excluded.active_species,
                    active_parameter = excluded.active_parameter,
                    last_updated = excluded.last_updated
                """,
                (
                    session.session_id,
                    session.active_location,
                    session.active_float_id,
                    session.active_species,
                    session.active_parameter,
                    session.last_updated
                )
            )

            if turn:
                conn.execute(
                    """
                    INSERT INTO chat_messages (session_id, user_query, bot_summary, detected_location, detected_float_id, detected_species, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        session.session_id,
                        turn.user_query,
                        turn.bot_summary,
                        turn.detected_location,
                        turn.detected_float_id,
                        turn.detected_species,
                        turn.timestamp
                    )
                )
            conn.commit()
    except Exception as e:
        print(f"[ChatMemory] DB persist fallback: {e}")


def get_or_create_session(session_id: str | None) -> SessionContext:
    """Retrieve existing session context from memory or SQLite, or create a new one."""
    if not session_id or session_id.strip() == "":
        session_id = "default_guest_session"

    current_time = time.time()
    
    # 1. Check in-memory store
    if session_id in SESSION_STORE:
        session = SESSION_STORE[session_id]
        if current_time - session.last_updated > SESSION_EXPIRY_SECONDS:
            session.history.clear()
            session.active_location = None
            session.active_float_id = None
            session.active_species = None
            session.active_parameter = None
        session.last_updated = current_time
        return session

    # 2. Check persistent SQLite database
    db_session = _load_session_from_db(session_id)
    if db_session:
        SESSION_STORE[session_id] = db_session
        return db_session

    # 3. Create fresh session
    session = SessionContext(session_id=session_id, last_updated=current_time)
    SESSION_STORE[session_id] = session
    _persist_session_to_db(session)
    return session


def extract_location(text: str) -> str | None:
    """Extract known coastal ports or ocean sectors from text."""
    lowered = text.lower()
    for loc in KNOWN_COASTAL_LOCATIONS:
        pattern = rf"\b{re.escape(loc)}\b"
        if re.search(pattern, lowered):
            return loc
    return None


def extract_float_id(text: str) -> str | None:
    """Extract Argo float WMO ID (typically 5 to 7 digits) from query."""
    match = re.search(r"\b(float\s*#?\s*)?(\d{5,7})\b", text, flags=re.IGNORECASE)
    if match:
        return match.group(2)
    return None


def resolve_query_context(session_id: str | None, current_query: str) -> tuple[str, dict[str, Any]]:
    """
    Analyze the current query against session history.
    If pronouns or ellipsis are detected (e.g. 'what about its salinity at 500m', 'is it good for surmai?'),
    expand and inject the active location/float/species context.
    """
    session = get_or_create_session(session_id)
    resolved_query = current_query.strip()
    context_meta: dict[str, Any] = {
        "session_id": session.session_id,
        "carried_location": None,
        "carried_float_id": None,
        "carried_species": None
    }

    # Extract immediate entities in current turn
    cur_loc = extract_location(current_query)
    cur_float = extract_float_id(current_query)
    cur_species = detect_species_in_query(current_query)

    # Coreference Triggers (Pronouns / Follow-up phrases)
    coreference_patterns = [
        r"\b(it|its|there|this place|that float|that area|this sector|wahan|iska|uski|yahan|us float|vahan)\b",
        r"^(and\s+)?what about\s+",
        r"^(and\s+)?aur\s+",
        r"^(is it|kya yeh)\s+",
        r"^(salinity|temperature|taapman|depth|profile)\s+(at|pe|par|in)\s+"
    ]

    is_follow_up = any(re.search(p, current_query, flags=re.IGNORECASE) for p in coreference_patterns)

    # Resolve Location Coreference & Context Switching
    if not cur_loc and session.active_location and (is_follow_up or len(current_query.split()) <= 6):
        # Inject active location
        resolved_query = f"{current_query} (Context: near {session.active_location.capitalize()})"
        context_meta["carried_location"] = session.active_location
    elif cur_loc:
        if session.active_location and session.active_location.lower() != cur_loc.lower():
            # Explicit Location Switch detected! Reset dependent transient states
            session.active_float_id = None
            session.active_parameter = None
            context_meta["location_switched"] = True
        session.active_location = cur_loc

    # Resolve Float ID Coreference
    if not cur_float and session.active_float_id and (is_follow_up or "float" in current_query.lower()):
        resolved_query = f"{resolved_query} (Float ID: {session.active_float_id})"
        context_meta["carried_float_id"] = session.active_float_id
    elif cur_float:
        session.active_float_id = cur_float

    # Resolve Species Coreference
    if not cur_species and session.active_species and is_follow_up:
        context_meta["carried_species"] = session.active_species
    elif cur_species:
        session.active_species = cur_species["common_name"]

    return resolved_query, context_meta


def update_session_memory(
    session_id: str | None,
    user_query: str,
    bot_summary: str,
    detected_location: str | None = None,
    detected_float_id: str | None = None,
    detected_species: str | None = None
) -> None:
    """Commit the completed turn to the session history queue and persistent SQLite store."""
    session = get_or_create_session(session_id)

    # Update active slots
    if detected_location:
        session.active_location = detected_location
    elif not session.active_location:
        session.active_location = extract_location(user_query)

    if detected_float_id:
        session.active_float_id = detected_float_id
    elif not session.active_float_id:
        session.active_float_id = extract_float_id(user_query)

    if detected_species:
        session.active_species = detected_species

    turn = ConversationTurn(
        user_query=user_query,
        bot_summary=bot_summary,
        timestamp=time.time(),
        detected_location=session.active_location,
        detected_float_id=session.active_float_id,
        detected_species=session.active_species
    )

    session.history.append(turn)
    if len(session.history) > MAX_SESSION_HISTORY:
        session.history.pop(0)
    session.last_updated = time.time()

    # Persist to SQLite
    _persist_session_to_db(session, turn)


def get_session_memory(session_id: str | None) -> SessionContext:
    """Convenience alias for get_or_create_session."""
    return get_or_create_session(session_id)


def resolve_query_with_context(session_id: str | None, current_query: str) -> str:
    """Convenience wrapper returning the resolved query string."""
    resolved, _ = resolve_query_context(session_id, current_query)
    return resolved


def clear_session_memory(session_id: str | None) -> None:
    """Reset and clear session memory in RAM and database."""
    if not session_id:
        return
    if session_id in SESSION_STORE:
        del SESSION_STORE[session_id]
    try:
        from .db import get_connection
        with get_connection() as conn:
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
            conn.commit()
    except Exception as e:
        print(f"[ChatMemory] DB clear fallback: {e}")


