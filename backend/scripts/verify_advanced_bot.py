"""
Verification Script for Lehar AI Supercharged Bot Core Capabilities:
1. Zero-hallucination ground truth injection & post-generation numeric validation
2. Astronomical NOAA solar twilight calculator (dynamic crepuscular window)
3. 2026 CMFRI seasonal fishing ban detection with southern tip boundary resolution
4. Multi-turn chat memory with automatic location switch detection
5. Safe Telegram HTML formatting & dynamic contextual chips keyboard
"""

import sys
import os
from datetime import datetime
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services.marine_weather import calculate_solar_twilight, get_live_marine_weather
from services.db import get_active_seasonal_ban, seed_seasonal_bans_if_empty
from services.chat_memory import (
    get_session_memory,
    update_session_memory,
    resolve_query_with_context,
    clear_session_memory
)
from services.nl2sql import (
    synthesize_ground_truth_facts,
    validate_no_hallucination,
    render_deterministic_advisory,
    process_chat_query
)
from services.telegram_bot import markdown_to_telegram_html, _get_contextual_keyboard

def run_tests():
    print("==================================================================")
    print("🧪 STARTING LEHAR AI BOT VERIFICATION SUITE")
    print("==================================================================")

    # 1. Test Astronomical Solar Twilight
    print("\n--- [1] Astronomical NOAA Solar Twilight ---")
    tw_mumbai = calculate_solar_twilight(18.915, 72.828, datetime(2026, 9, 5, 6, 0))
    print(f"Mumbai Twilight (Sep 5, 2026): Dawn={tw_mumbai['dawn_twilight']} | Sunrise={tw_mumbai['sunrise']} | Window={tw_mumbai['morning_feeding_window']}")
    assert tw_mumbai["dawn_twilight"] and tw_mumbai["sunrise"], "Mumbai twilight failed"
    
    tw_chennai = calculate_solar_twilight(13.0827, 80.2707, datetime(2026, 9, 5, 6, 0))
    print(f"Chennai Twilight (Sep 5, 2026): Dawn={tw_chennai['dawn_twilight']} | Sunrise={tw_chennai['sunrise']} | Window={tw_chennai['morning_feeding_window']}")
    assert tw_chennai["dawn_twilight"] != tw_mumbai["dawn_twilight"], "East vs West coast twilight should differ!"
    print("✅ Astronomical calculation passed.")

    # 2. Test Seasonal Ban & Southern Tip Resolution
    print("\n--- [2] 2026 CMFRI Seasonal Ban Resolution ---")
    seed_seasonal_bans_if_empty()
    
    # West Coast during ban (June 15, 2026)
    ban_west_june = get_active_seasonal_ban(18.915, 72.828, datetime(2026, 6, 15))
    print(f"West Coast June 15: Ban Active = {ban_west_june['is_active'] if ban_west_june else False}")
    assert ban_west_june and ban_west_june["is_active"], "West coast should have active ban in June"
    assert "Mechanized" in ban_west_june["advisory_en"] or "trawling" in ban_west_june["advisory_en"]
    assert "artisanal" in ban_west_june["advisory_en"].lower() or "traditional" in ban_west_june["advisory_en"].lower()

    # East Coast during ban (May 1, 2026)
    ban_east_may = get_active_seasonal_ban(13.0827, 80.2707, datetime(2026, 5, 1))
    print(f"East Coast May 1: Ban Active = {ban_east_may['is_active'] if ban_east_may else False}")
    assert ban_east_may and ban_east_may["is_active"], "East coast should have active ban in May"

    # Southern tip (Kanyakumari) split at lon=77.55°E
    kanya_west = get_active_seasonal_ban(8.08, 77.50, datetime(2026, 6, 15))  # Lon < 77.55 -> West coast rule (active in June)
    kanya_east = get_active_seasonal_ban(8.08, 77.60, datetime(2026, 6, 15))  # Lon >= 77.55 -> East coast rule (inactive in June)
    print(f"Kanyakumari West (77.50°E, June 15): Active={kanya_west['is_active']}, Zone={kanya_west['zone_code']}")
    print(f"Kanyakumari East (77.60°E, June 15): Active={kanya_east['is_active']}, Zone={kanya_east['zone_code']}")
    assert kanya_west["is_active"] is True and kanya_east["is_active"] is False, "Kanyakumari boundary split failed!"
    print("✅ Seasonal ban & boundary resolution passed.")

    # 3. Test Ground-Truth Injection & Validation Guardrail
    print("\n--- [3] Zero-Hallucination Guardrail & Validator ---")
    mock_facts = {
        "sector_name": "Mumbai",
        "sst_c": 28.4,
        "mld_m": 32,
        "wave_height_m": 1.2,
        "wind_speed_knots": 11,
        "viability_pct": 78,
        "fuel_savings_inr": 3800
    }
    
    # Truthful LLM output: uses only facts and safe numbers
    truthful_output = (
        "Mumbai me samundar ka taapman 28.4°C hai aur MLD 32m hai. "
        "Wave height 1.2m aur hawa 11 knots hai. Viability 78% hai aur ₹3800 diesel bachega."
    )
    assert validate_no_hallucination(truthful_output, mock_facts) is True, "Truthful output should pass validation!"

    # Hallucinated LLM output: hallucinates 34.5°C and ₹9500
    hallucinated_output = (
        "Mumbai me samundar ka taapman 34.5°C hai aur ₹9500 bachega."
    )
    assert validate_no_hallucination(hallucinated_output, mock_facts) is False, "Hallucinated output MUST be rejected!"
    
    # Verify deterministic template fallback generates clean output
    fallback_rendered = render_deterministic_advisory(
        facts=mock_facts,
        lang_code="hi"
    )
    print(f"Sample Fallback Output:\n{fallback_rendered[:150]}...")
    assert "28.4" in fallback_rendered and "32" in fallback_rendered
    print("✅ Zero-hallucination validation and fallback passed.")

    # 4. Test Multi-Turn Memory & Location Switch
    print("\n--- [4] Multi-Turn Memory with Location Switch ---")
    session_id = "test_fisherman_42"
    clear_session_memory(session_id)

    # Turn 1: Mumbai query
    q1 = "Mumbai me machhli milegi kya?"
    r1 = resolve_query_with_context(session_id, q1)
    print(f"Turn 1 resolved: '{r1}'")
    update_session_memory(session_id, q1, "Mumbai me achhi machhli mil sakti hai.")
    mem1 = get_session_memory(session_id)
    assert mem1.active_location == "mumbai", "Active location should be Mumbai"

    # Turn 2: Location switch to Chennai
    q2 = "Ab Chennai ka bata do"
    r2 = resolve_query_with_context(session_id, q2)
    print(f"Turn 2 resolved: '{r2}'")
    update_session_memory(session_id, q2, "Chennai me waves 1.1m hain.")
    mem2 = get_session_memory(session_id)
    assert mem2.active_location == "chennai", "Active location should have switched to Chennai"

    # Turn 3: Contextual reference ("wahan") should resolve to Chennai, NOT Mumbai!
    q3 = "Wahan hawa aur lehar kitni hai?"
    r3 = resolve_query_with_context(session_id, q3)
    print(f"Turn 3 resolved: '{r3}'")
    assert "chennai" in r3.lower(), f"Expected Chennai in resolved query, got: {r3}"
    assert "mumbai" not in r3.lower(), "Old location Mumbai leaked into resolved query!"
    print("✅ Context resolution and location switch passed.")

    # 5. Test Telegram HTML Formatting & Smart Chips
    print("\n--- [5] Telegram HTML Formatting & Dynamic Chips ---")
    markdown_sample = "**Bold Title** with *legacy italic* and `code_snippet` and [Maps](https://maps.google.com/?q=18.9,72.8) & raw <tags>"
    html_sample = markdown_to_telegram_html(markdown_sample)
    print(f"Converted HTML:\n{html_sample}")
    assert "<b>Bold Title</b>" in html_sample
    assert "<code>code_snippet</code>" in html_sample
    assert "<a href=\"https://maps.google.com/?q=18.9,72.8\">Maps</a>" in html_sample
    assert "&lt;tags&gt;" in html_sample, "HTML special chars must be escaped to prevent entity parse errors!"

    chips = _get_contextual_keyboard(sector_slug="chennai", query_route="species_advisory", target_lat=13.08, target_lon=80.27)
    buttons = chips["inline_keyboard"]
    print(f"Dynamic Chips Generated: {[[b['text'] for b in row] for row in buttons]}")
    assert any("Wave & Wind" in b["text"] for b in buttons[0])
    assert any("Feeding Time" in b["text"] for b in buttons[0])
    assert any("Fuel Saved" in b["text"] for b in buttons[0])
    assert any("Google Maps" in b["text"] for b in buttons[1])
    print("✅ Telegram HTML & Contextual Keyboard passed.")

    print("\n==================================================================")
    print("🎉 ALL 5 ADVANCED BOT CAPABILITIES VERIFIED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
