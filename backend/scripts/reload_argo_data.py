"""
Lehar AI — Clean Ingestion Script with Real Full Depth Measurements
Fetches profiles and measurement arrays from Argovis API for Indian Ocean floats.
"""

import os
import sys
import time
import httpx
import sqlite3
from dotenv import load_dotenv

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "argo_indian_ocean.db")
ARGOVIS_BASE = "https://argovis-api.colorado.edu"
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
API_KEY = os.getenv("ARGOVIS_API_KEY", "")

REGIONS = [
    {"name": "Arabian Sea (Mumbai/Goa/Gujarat)", "center": "68,18", "radius": "600"},
    {"name": "Bay of Bengal (Chennai/Vizag)", "center": "85,15", "radius": "600"},
    {"name": "South India / Kochi", "center": "75,9", "radius": "500"},
    {"name": "Equatorial Indian Ocean", "center": "70,0", "radius": "600"},
    {"name": "Southern Indian Ocean", "center": "80,-15", "radius": "600"},
]


def reload_data():
    if not API_KEY:
        raise RuntimeError("ARGOVIS_API_KEY is not configured. Add it to backend/.env before ingesting data.")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM argo_measurements")
    conn.execute("DELETE FROM argo_profiles")
    conn.commit()
    print("[DB] Cleared existing tables.")

    headers = {"Accept": "application/json", "x-argokey": API_KEY}

    from datetime import datetime, timedelta, timezone
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=90)
    start_date = start.strftime("%Y-%m-%dT00:00:00Z")
    end_date = end.strftime("%Y-%m-%dT23:59:59Z")

    total_profiles = 0
    total_measurements = 0

    for region in REGIONS:
        print(f"\n[FETCH] {region['name']}...")
        params = {
            "startDate": start_date,
            "endDate": end_date,
            "center": region["center"],
            "radius": region["radius"],
            "data": "all",
        }

        try:
            with httpx.Client(timeout=120.0) as client:
                res = client.get(f"{ARGOVIS_BASE}/argo", params=params, headers=headers)
                res.raise_for_status()
                profiles = res.json()
        except Exception as e:
            print(f"  Error fetching: {e}")
            continue

        if not isinstance(profiles, list):
            continue

        print(f"  -> Argovis returned {len(profiles)} profiles")

        for p in profiles:
            try:
                geo = p.get("geolocation", {})
                coords = geo.get("coordinates", [0, 0])
                lon, lat = coords[0], coords[1]

                pid_str = p.get("_id", "")
                float_id = pid_str.split("_")[0] if "_" in pid_str else p.get("platform", "unknown")
                cycle_str = pid_str.split("_")[-1] if "_" in pid_str else "0"
                try:
                    cycle_num = int(cycle_str)
                except ValueError:
                    cycle_num = 0

                date = p.get("timestamp", "")
                data_info = p.get("data_info", [])
                data_arrays = p.get("data", [])

                data_keys = data_info[0] if data_info and isinstance(data_info[0], list) else []

                pres_idx = -1
                temp_idx = -1
                sal_idx = -1

                for idx, k in enumerate(data_keys):
                    k_str = str(k).lower()
                    if ("pressure" in k_str or "pres" in k_str) and "qc" not in k_str and pres_idx == -1:
                        pres_idx = idx
                    elif ("temperature" in k_str or "temp" in k_str) and "qc" not in k_str and temp_idx == -1:
                        temp_idx = idx
                    elif ("salinity" in k_str or "psal" in k_str) and "qc" not in k_str and sal_idx == -1:
                        sal_idx = idx

                pres_vals = data_arrays[pres_idx] if pres_idx >= 0 and pres_idx < len(data_arrays) else []
                temp_vals = data_arrays[temp_idx] if temp_idx >= 0 and temp_idx < len(data_arrays) else []
                sal_vals = data_arrays[sal_idx] if sal_idx >= 0 and sal_idx < len(data_arrays) else []

                num_levels = max(len(pres_vals), len(temp_vals), len(sal_vals))
                max_depth = max([v for v in pres_vals if v is not None], default=0)

                cur = conn.execute("""
                    INSERT INTO argo_profiles (float_id, cycle_number, latitude, longitude, date, max_depth, num_levels)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (float_id, cycle_num, lat, lon, date, max_depth, num_levels))
                profile_id = cur.lastrowid
                total_profiles += 1

                for i in range(num_levels):
                    pres = pres_vals[i] if i < len(pres_vals) else None
                    temp = temp_vals[i] if i < len(temp_vals) else None
                    sal = sal_vals[i] if i < len(sal_vals) else None
                    depth = pres if pres is not None else 0

                    conn.execute("""
                        INSERT INTO argo_measurements (profile_id, pressure, depth, temperature, salinity)
                        VALUES (?, ?, ?, ?, ?)
                    """, (profile_id, pres, depth, temp, sal))
                    total_measurements += 1

            except Exception as ex:
                continue

        conn.commit()
        time.sleep(1)

    conn.close()
    print(f"\n[DONE] Ingested {total_profiles} profiles with {total_measurements} depth measurements!")


if __name__ == "__main__":
    reload_data()
