import urllib.request
import json

def test_query(q, lang="en-IN"):
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/chat',
        data=json.dumps({'query': q, 'mode': 'text', 'language': lang}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    print("=" * 60)
    print(f"QUERY: {q}")
    print(f"SUMMARY: {data.get('summary')}")
    print(f"HERO STAT: {data.get('hero_stat')}")
    print(f"STATS: {data.get('stats')}")
    print(f"READING COUNT: {data.get('reading_count')}")
    print(f"MAP MARKERS: {len(data.get('map_markers') or [])}")
    print(f"CHART TYPE: {data.get('chart', {}).get('chart_type') if data.get('chart') else None}")
    print()

if __name__ == "__main__":
    test_query("Show temperature depth profile near Kochi")
    test_query("Show active anomaly alerts in Indian Ocean")
    test_query("Mumbai ke paas machhli pakadne ke liye samundar kaisa hai", "hi-IN")
