"""
Lehar AI — Argo Data Ingestion Script
Fetches real Argo float profiles from the Argovis REST API
and stores them in the local SQLite database.

Usage: python -m backend.scripts.ingest_argo
"""

import sys
import os
import time
import httpx

# Add parent to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.services.db import init_db, get_connection


ARGOVIS_BASE = "https://argovis-api.colorado.edu"

# Indian Ocean search regions (Argovis center is lon,lat)
REGIONS = [
    {"name": "Arabian Sea (Mumbai/Goa/Gujarat)", "center": "68,18", "radius": "600"},
    {"name": "Bay of Bengal (Chennai/Vizag)", "center": "85,15", "radius": "600"},
    {"name": "South India / Kochi", "center": "75,9", "radius": "500"},
    {"name": "Equatorial Indian Ocean", "center": "70,0", "radius": "600"},
    {"name": "Southern Indian Ocean", "center": "80,-15", "radius": "600"},
]


def fetch_profiles(center: str, radius: str, start_date: str, end_date: str) -> list[dict]:
    """Fetch profiles from Argovis API for a region."""
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "center": center,
        "radius": radius,
    }

    api_key = os.getenv("ARGOVIS_API_KEY", "")
    headers = {"Accept": "application/json"}
    if api_key:
        headers["x-argokey"] = api_key

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.get(f"{ARGOVIS_BASE}/argo", params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
    except Exception as e:
        print(f"  [ERROR] API call failed: {e}")
        return []


def parse_and_store_profiles(profiles: list[dict]) -> int:
    """Parse Argovis JSON profiles and store in SQLite."""
    stored = 0

    with get_connection() as conn:
        for profile in profiles:
            try:
                # Extract metadata
                geo = profile.get("geolocation", {})
                coords = geo.get("coordinates", [0, 0])
                lon, lat = coords[0], coords[1]
                
                float_id = profile.get("_id", "").split("_")[0] if "_" in profile.get("_id", "") else profile.get("platform", "unknown")
                cycle_str = profile.get("_id", "").split("_")[-1] if "_" in profile.get("_id", "") else "0"
                try:
                    cycle_number = int(cycle_str)
                except ValueError:
                    cycle_number = 0

                date = profile.get("timestamp", "")

                # Check if profile already exists
                existing = conn.execute(
                    "SELECT id FROM argo_profiles WHERE float_id = ? AND date = ?",
                    (float_id, date)
                ).fetchone()

                if existing:
                    continue                # Get data arrays
                data_info = profile.get("data_info", [[], [], []])
                data_arrays = profile.get("data", [])
                
                # Map data_info to find column indices
                data_keys = data_info[0] if data_info and isinstance(data_info[0], list) else []

                # Find indices for pressure, temperature, salinity
                pres_idx = -1
                temp_idx = -1
                sal_idx = -1

                for idx, k in enumerate(data_keys):
                    k_str = str(k).lower()
                    if "pressure" in k_str or "pres" in k_str:
                        if pres_idx == -1 and "qc" not in k_str:
                            pres_idx = idx
                    elif "temperature" in k_str or "temp" in k_str:
                        if temp_idx == -1 and "qc" not in k_str:
                            temp_idx = idx
                    elif "salinity" in k_str or "psal" in k_str:
                        if sal_idx == -1 and "qc" not in k_str:
                            sal_idx = idx

                # Get measurements
                measurements = []
                num_levels = 0
                max_depth = 0

                if data_arrays and len(data_arrays) > 0:
                    pres_vals = data_arrays[pres_idx] if pres_idx >= 0 and pres_idx < len(data_arrays) else []
                    temp_vals = data_arrays[temp_idx] if temp_idx >= 0 and temp_idx < len(data_arrays) else []
                    sal_vals = data_arrays[sal_idx] if sal_idx >= 0 and sal_idx < len(data_arrays) else []

                    # Flatten if nested
                    if pres_vals and isinstance(pres_vals[0], list):
                        pres_vals = pres_vals[0]
                    if temp_vals and isinstance(temp_vals[0], list):
                        temp_vals = temp_vals[0]
                    if sal_vals and isinstance(sal_vals[0], list):
                        sal_vals = sal_vals[0]

                    num_levels = max(len(pres_vals), len(temp_vals), len(sal_vals))

                    for i in range(num_levels):
                        pres = pres_vals[i] if i < len(pres_vals) and pres_vals[i] is not None else None
                        temp = temp_vals[i] if i < len(temp_vals) and temp_vals[i] is not None else None
                        sal = sal_vals[i] if i < len(sal_vals) and sal_vals[i] is not None else None
                        
                        # Approximate depth from pressure (1 dbar ≈ 1 meter)
                        depth = pres if pres is not None else 0

                        if depth and depth > max_depth:
                            max_depth = depth

                        measurements.append({
                            "pressure": pres,
                            "depth": depth,
                            "temperature": temp,
                            "salinity": sal,
                        })
                else:
                    num_levels = 0
                    max_depth = 0

                # Insert profile
                cursor = conn.execute("""
                    INSERT INTO argo_profiles (float_id, cycle_number, latitude, longitude, date, max_depth, num_levels)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (float_id, cycle_number, lat, lon, date, max_depth, num_levels))
                profile_id = cursor.lastrowid

                # Insert measurements
                for m in measurements:
                    conn.execute("""
                        INSERT INTO argo_measurements (profile_id, pressure, depth, temperature, salinity)
                        VALUES (?, ?, ?, ?, ?)
                    """, (profile_id, m["pressure"], m["depth"], m["temperature"], m["salinity"]))

                stored += 1

            except Exception as e:
                print(f"  [WARN] Skipping profile: {e}")
                continue

        conn.commit()

    return stored


def main():
    print("=" * 60)
    print("Lehar AI -- Argo Data Ingestion")
    print("Fetching real ocean data from Argovis API...")
    print("=" * 60)

    # Initialize database
    init_db()

    # Date range: last 3 months
    from datetime import datetime, timedelta, timezone
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=90)
    start_date = start.strftime("%Y-%m-%dT00:00:00Z")
    end_date = end.strftime("%Y-%m-%dT23:59:59Z")

    print(f"\nDate range: {start_date} to {end_date}")

    total_stored = 0

    for region in REGIONS:
        print(f"\n[FETCH] {region['name']} (center={region['center']}, radius={region['radius']}km)...")
        
        profiles = fetch_profiles(region["center"], region["radius"], start_date, end_date)
        print(f"  -> API returned {len(profiles)} profiles")

        if profiles:
            count = parse_and_store_profiles(profiles)
            total_stored += count
            print(f"  -> Stored {count} new profiles")

        # Rate limit: wait between requests
        time.sleep(2)

    print(f"\n{'=' * 60}")
    print(f"[DONE] Ingestion complete! Total profiles stored: {total_stored}")
    
    # Print stats
    from backend.services.db import get_profile_count, get_unique_float_count
    print(f"   Database now has: {get_profile_count()} profiles from {get_unique_float_count()} floats")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
