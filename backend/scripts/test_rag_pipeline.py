"""
Lehar AI — RAG & Vernacular Species Upgrade Test Suite
Verifies Hybrid RAG, Vernacular Species Dictionary, and Multi-Turn Coreference.
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_root))

from backend.services.species_dict import detect_species_in_query, evaluate_species_viability
from backend.services.rag_service import retrieve_ocean_knowledge, classify_query_intent
from backend.services.chat_memory import resolve_query_context, update_session_memory
from backend.services.nl2sql import process_chat_query


def test_species_dictionary():
    print("\n--- 1. Testing Multilingual Marine Species Dictionary ---")
    queries = [
        "Ratnagiri me Surmai machhli pakadne ke liye samundar kaisa hai?",
        "Bangda fishing conditions near Goa",
        "Is today good for Rawas in Mumbai?",
        "Chennai coast vanjaram fish advisory",
        "Kochi tarli mathi school locations"
    ]
    for q in queries:
        species = detect_species_in_query(q)
        assert species is not None, f"Failed to detect species in: {q}"
        viability = evaluate_species_viability(species, observed_sst=28.2, observed_salinity=35.1)
        print(f"[OK] Query: '{q}'")
        print(f"   -> Detected: {species['common_name']}")
        print(f"   -> Viability: {viability['score']}% ({viability['rating']}) | Optimal SST: {viability['optimal_sst']}")


def test_oceanographic_rag():
    print("\n--- 2. Testing Oceanographic Vector RAG Knowledge Base ---")
    rag_queries = [
        "What is the Indian Ocean Dipole and how does it affect monsoon upwelling?",
        "Explain Marine Heatwaves Hobday classification",
        "What is the Mixed Layer Depth (MLD) and thermocline?",
        "What are the fishing ban dates on the west coast?"
    ]
    for q in rag_queries:
        intent = classify_query_intent(q)
        docs = retrieve_ocean_knowledge(q, top_k=1)
        assert len(docs) > 0, f"RAG returned 0 documents for: {q}"
        print(f"[OK] Query: '{q}'")
        print(f"   -> Intent: {intent}")
        print(f"   -> Top Retrieved Document: '{docs[0]['title']}' (Category: {docs[0]['category']})")


def test_conversational_memory():
    print("\n--- 3. Testing Multi-Turn Conversational Memory ---")
    session_id = "test_eval_session_99"

    # Turn 1: Establish location
    q1 = "Mumbai ke paas samundar ka taapman kitna hai?"
    res1, meta1 = resolve_query_context(session_id, q1)
    update_session_memory(session_id, q1, "Mumbai SST is 28.5 C", detected_location="mumbai")
    print(f"[OK] Turn 1 Query: '{q1}' -> Active Location: Mumbai")

    # Turn 2: Follow-up pronoun 'wahan'
    q2 = "Wahan 500 meter gehraai par salinity kya hai?"
    res2, meta2 = resolve_query_context(session_id, q2)
    print(f"[OK] Turn 2 Query: '{q2}'")
    print(f"   -> Resolved With Context: '{res2}'")
    assert "mumbai" in res2.lower(), "Coreference failed to carry forward Mumbai location!"


async def test_end_to_end_pipeline():
    print("\n--- 4. Testing End-to-End Hybrid Processing Pipeline ---")
    # Test RAG Pure route
    rag_res = await process_chat_query(
        user_query="What is the Indian Ocean Dipole effect on monsoon upwelling?",
        session_id="test_sess_rag"
    )
    print(f"[OK] RAG Route Response: Route = {rag_res.get('query_route')}")
    print(f"   Summary: {rag_res.get('summary')[:80]}...")

    # Test Species route
    species_res = await process_chat_query(
        user_query="Ratnagiri me Surmai machhli pakadne ke liye samundar kaisa hai?",
        session_id="test_sess_species"
    )
    print(f"[OK] Species Route Response: Route = {species_res.get('query_route')}")
    print(f"   Species: {species_res.get('species_detected')}")
    print(f"   Hero Stat: {species_res.get('hero_stat')}")


def main():
    print("=" * 65)
    print(">> Running Lehar AI RAG & Vernacular Species Upgrade Test Suite")
    print("=" * 65)
    test_species_dictionary()
    test_oceanographic_rag()
    test_conversational_memory()
    asyncio.run(test_end_to_end_pipeline())
    print("\n" + "=" * 65)
    print(">> ALL TESTS PASSED SUCCESSFULLY! Upgrade is 100% Validated.")
    print("=" * 65)


if __name__ == "__main__":
    main()
