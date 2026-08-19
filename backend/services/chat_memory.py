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
    "mumbai", "bombay", "maharashtra", "konkan", "goa", "ratnagiri", "alibaug",
    "kochi", "cochin", "kerala", "lakshadweep", "malabar", "mangalore", "karnataka",
    "chennai", "madras", "tamil nadu", "tuticorin", "thoothukudi", "coromandel",
    "visakhapatnam", "vizag", "andhra", "odisha", "paradip", "bengal", "west bengal",
    "kolkata", "hooghly", "gujarat", "porbandar", "saurashtra", "arabian sea", "bay of bengal"
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
SESSION_EXPIRY_SECONDS = 3600  # 1 hour


def get_or_create_session(session_id: str | None) -> SessionContext:
    """Retrieve existing session context or create a new one."""
    if not session_id or session_id.strip() == "":
        session_id = "default_guest_session"

    current_time = time.time()
    if session_id in SESSION_STORE:
        session = SESSION_STORE[session_id]
        # Reset if expired
        if current_time - session.last_updated > SESSION_EXPIRY_SECONDS:
            session.history.clear()
            session.active_location = None
            session.active_float_id = None
            session.active_species = None
            session.active_parameter = None
        session.last_updated = current_time
        return session

    session = SessionContext(session_id=session_id, last_updated=current_time)
    SESSION_STORE[session_id] = session
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
        r"\b(it|its|there|this place|that float|that area|this sector|wahan|iska|uski|yahan|us float)\b",
        r"^(and\s+)?what about\s+",
        r"^(and\s+)?aur\s+",
        r"^(is it|kya yeh)\s+",
        r"^(salinity|temperature|taapman|depth|profile)\s+(at|pe|par|in)\s+"
    ]

    is_follow_up = any(re.search(p, current_query, flags=re.IGNORECASE) for p in coreference_patterns)

    # Resolve Location Coreference
    if not cur_loc and session.active_location and (is_follow_up or len(current_query.split()) <= 6):
        # Inject active location
        resolved_query = f"{current_query} (Context: near {session.active_location.capitalize()})"
        context_meta["carried_location"] = session.active_location
    elif cur_loc:
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
    """Commit the completed turn to the session history queue."""
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
