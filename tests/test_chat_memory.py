"""
Validation tests for Multi-Turn Session Persistence and Context Resolution across restarts.
"""

import time
import pytest
from backend.services.chat_memory import (
    get_or_create_session,
    update_session_memory,
    resolve_query_context,
    _load_session_from_db,
    SESSION_STORE
)
from backend.services.db import get_connection


def test_session_creation_and_memory_persistence():
    """Verify session is written to SQLite and survives memory cache clearing."""
    session_id = f"test_session_{int(time.time())}"
    
    # 1. Update session with location and a turn
    update_session_memory(
        session_id=session_id,
        user_query="Mumbai ke paas samundar ka taapman kya hai?",
        bot_summary="Mumbai ke paas sea surface temperature 28.2°C hai.",
        detected_location="mumbai"
    )

    # 2. Clear in-memory cache to simulate full backend restart / multi-worker handoff
    if session_id in SESSION_STORE:
        del SESSION_STORE[session_id]

    # 3. Fetch session — must hydrate directly from SQLite
    session = get_or_create_session(session_id)
    assert session.session_id == session_id
    assert session.active_location == "mumbai"
    assert len(session.history) == 1
    assert "Mumbai" in session.history[0].user_query

    # 4. Verify SQLite table rows directly
    with get_connection() as conn:
        sess_row = conn.execute("SELECT * FROM chat_sessions WHERE session_id = ?", (session_id,)).fetchone()
        assert sess_row is not None
        assert sess_row["active_location"] == "mumbai"

        msg_rows = conn.execute("SELECT * FROM chat_messages WHERE session_id = ?", (session_id,)).fetchall()
        assert len(msg_rows) == 1


def test_coreference_context_resolution():
    """Verify follow-up queries with pronouns inherit the active sector context."""
    session_id = f"test_coref_{int(time.time())}"

    # Initial turn sets Mumbai
    update_session_memory(
        session_id=session_id,
        user_query="How is the sea state near Kochi?",
        bot_summary="Kochi sea surface temperature is 28.5°C with 1.2m waves.",
        detected_location="kochi"
    )

    # Follow-up query using pronoun 'wahan' without mentioning Kochi
    resolved_query, context_meta = resolve_query_context(session_id, "Wahan machhli kaunsi milegi?")
    
    assert "Context: near Kochi" in resolved_query
    assert context_meta["carried_location"] == "kochi"
