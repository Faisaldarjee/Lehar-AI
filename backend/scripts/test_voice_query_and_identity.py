import asyncio
import sys
import io
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from backend.services.feedback_engine import is_likely_catch_feedback, parse_and_process_feedback
from backend.services.telegram_bot import format_mariner_name
from backend.services.nl2sql import process_chat_query

async def run_tests():
    print('--- 1. Testing Catch Feedback Classifier ---')
    voice_q = 'I said prawns, tuna fish, where did we get in Mumbai?'
    assert not is_likely_catch_feedback(voice_q), f'FAILED: {voice_q} classified as catch report!'
    assert not is_likely_catch_feedback('Tuna fish kahan milegi Mumbai me?'), 'FAILED on Hindi inquiry!'
    assert not is_likely_catch_feedback('Where to find fish in Mumbai?'), 'FAILED on English inquiry!'
    assert not is_likely_catch_feedback('Can we catch pomfret today?'), 'FAILED on modal inquiry!'
    assert not is_likely_catch_feedback('Mumbai weather and fish report batao'), 'FAILED on request inquiry!'
    assert is_likely_catch_feedback('350kg Tuna caught near Sassoon Dock at 30m'), 'FAILED on valid catch!'
    assert is_likely_catch_feedback('250 kilo bangda pakda 20 meter pe'), 'FAILED on Hindi valid catch!'
    assert is_likely_catch_feedback('/report 200kg Bangda'), 'FAILED on /report command!'
    assert is_likely_catch_feedback('/catch 100kg pomfret'), 'FAILED on /catch command!'
    print('✅ Catch Feedback Classifier: All 9 assertions passed!')

    print('\n--- 2. Testing Mariner Name Deduplication ---')
    assert format_mariner_name('Faisal') == 'Captain Faisal', 'FAILED: Faisal -> ' + format_mariner_name('Faisal')
    assert format_mariner_name('Captain') == 'Captain', 'FAILED: Captain -> ' + format_mariner_name('Captain')
    assert format_mariner_name('Captain Faisal') == 'Captain Faisal', 'FAILED: Captain Faisal'
    assert format_mariner_name('Capt. Faisal') == 'Capt. Faisal', 'FAILED: Capt. Faisal'
    assert format_mariner_name('') == 'Captain', 'FAILED: empty'
    assert format_mariner_name(None) == 'Captain', 'FAILED: None'
    print('✅ Mariner Name Deduplication: All 6 assertions passed!')

    print('\n--- 3. Testing Catch Report Processing & Zero Fake Defaults ---')
    res_quantified = await parse_and_process_feedback('350kg Tuna caught near Sassoon Dock at 30m depth', reporter_name='Faisal')
    assert res_quantified['quantity_kg'] == 350.0, f"Expected 350.0, got {res_quantified['quantity_kg']}"
    assert res_quantified['depth_m'] == 30.0, f"Expected 30.0, got {res_quantified['depth_m']}"
    assert 'Captain Faisal' in res_quantified['localized_reply'], f"Expected Captain Faisal in greeting: {res_quantified['localized_reply']}"
    assert 'Captain Captain' not in res_quantified['localized_reply'], 'Found Captain Captain in greeting!'
    
    res_unquantified = await parse_and_process_feedback('Tuna caught near Sassoon Dock', reporter_name='Captain')
    assert res_unquantified['quantity_kg'] is None, f"Expected None for omitted quantity, got {res_unquantified['quantity_kg']}"
    assert res_unquantified['depth_m'] is None, f"Expected None for omitted depth, got {res_unquantified['depth_m']}"
    assert 'Captain Captain' not in res_unquantified['localized_reply'], 'Found Captain Captain in greeting!'
    print('✅ Catch Processing: Zero fake defaults & perfect name formatting confirmed!')

    print('\n--- 4. Testing End-to-End Voice Query Routing ---')
    query_res = await process_chat_query(voice_q, language='en', session_id='tg_5163844591')
    assert query_res['query_route'] == 'species_advisory', f"Expected species_advisory route, got {query_res['query_route']}"
    print('✅ Query Route:', query_res['query_route'])
    print('✅ Species Detected:', query_res['species_detected'])
    print('✅ Sample Response:\n' + query_res['answer'][:250] + '...')
    print('\n🎉 ALL VERIFICATION TESTS PASSED FLAWLESSLY!')

if __name__ == '__main__':
    asyncio.run(run_tests())
