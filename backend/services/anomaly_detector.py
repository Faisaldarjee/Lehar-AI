"""Evidence-based anomaly detection for locally ingested Argo profiles.

Alerts identify unusual observations relative to nearby historical observations.
They are not cyclone, weather, fishing, or navigation advisories.
"""

from __future__ import annotations

from statistics import median

from .db import get_connection

SURFACE_DEPTH_METERS = 20
MIN_BASELINE_SAMPLES = 20
REGION_RADIUS_DEGREES = 10
ROBUST_Z_THRESHOLD = 3.0


def _month_from_iso(date: str) -> str | None:
    """Extract the calendar month from an ISO timestamp without assuming a timezone."""
    if len(date) >= 7 and date[4] == "-":
        return date[5:7]
    return None


def _surface_observation(profile_id: int, parameter: str) -> float | None:
    """Return the shallowest valid measurement for one CTD parameter."""
    if parameter not in {"temperature", "salinity"}:
        raise ValueError("Unsupported anomaly parameter")

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT {parameter}
            FROM argo_measurements
            WHERE profile_id = ? AND depth <= ? AND {parameter} IS NOT NULL
            ORDER BY depth ASC
            LIMIT 1
            """,
            (profile_id, SURFACE_DEPTH_METERS),
        ).fetchone()
    return float(row[parameter]) if row else None


def _baseline_values(parameter: str, lat: float, lon: float, date: str) -> list[float]:
    """Fetch a local, same-month reference sample and widen only when sparse."""
    if parameter not in {"temperature", "salinity"}:
        raise ValueError("Unsupported anomaly parameter")

    month = _month_from_iso(date)
    month_clause = "AND substr(p.date, 6, 2) = ?" if month else ""
    month_params: tuple[object, ...] = (month,) if month else ()
    local_params = (
        SURFACE_DEPTH_METERS,
        lat - REGION_RADIUS_DEGREES,
        lat + REGION_RADIUS_DEGREES,
        lon - REGION_RADIUS_DEGREES,
        lon + REGION_RADIUS_DEGREES,
        *month_params,
    )

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT m.{parameter} AS value
            FROM argo_profiles p
            JOIN argo_measurements m ON m.profile_id = p.id
            WHERE m.depth <= ? AND m.{parameter} IS NOT NULL
              AND p.latitude BETWEEN ? AND ?
              AND p.longitude BETWEEN ? AND ?
              {month_clause}
            """,
            local_params,
        ).fetchall()
        if len(rows) < MIN_BASELINE_SAMPLES:
            rows = conn.execute(
                f"""
                SELECT m.{parameter} AS value
                FROM argo_profiles p
                JOIN argo_measurements m ON m.profile_id = p.id
                WHERE m.depth <= ? AND m.{parameter} IS NOT NULL {month_clause}
                """,
                (SURFACE_DEPTH_METERS, *month_params),
            ).fetchall()
    return [float(row["value"]) for row in rows]


def _describe_anomaly(parameter: str, value: float, baseline: float, robust_z: float, sample_count: int, mhw_cat: str | None = None) -> str:
    unit = "°C" if parameter == "temperature" else "PSU"
    direction = "above" if value > baseline else "below"
    mhw_prefix = f"[{mhw_cat} Marine Heatwave] " if mhw_cat else ""
    diff = round(abs(value - baseline), 2)
    val_rounded = round(value, 2)
    base_rounded = round(baseline, 2)
    z_rounded = round(robust_z, 1)
    return (
        f"{mhw_prefix}Observed surface {parameter} {val_rounded:.2f} {unit}, {diff:.2f} {unit} "
        f"{direction} the regional baseline ({base_rounded:.2f} {unit}; n={sample_count}; "
        f"Z-score {z_rounded:.1f}). Monitored by ARGO CTD telemetry."
    )


def detect_anomalies_in_profile(profile_id: int, float_id: str, lat: float, lon: float, date: str) -> list[dict]:
    """Detect statistically unusual shallow-water observations for one profile."""
    anomalies: list[dict] = []
    for parameter in ("temperature", "salinity"):
        value = _surface_observation(profile_id, parameter)
        if value is None:
            continue

        values = _baseline_values(parameter, lat, lon, date)
        if len(values) < MIN_BASELINE_SAMPLES:
            continue

        reference = median(values)
        mad = median([abs(sample - reference) for sample in values])
        scale = max(mad * 1.4826, 0.25 if parameter == "temperature" else 0.05)
        robust_z = (value - reference) / scale
        if abs(robust_z) < ROBUST_Z_THRESHOLD:
            continue

        magnitude = abs(robust_z)
        severity = "critical" if magnitude >= 5 else "high" if magnitude >= 4 else "medium"

        # Hobday et al. (2016) Marine Heatwave Categorization for positive temperature anomalies
        mhw_cat = None
        if parameter == "temperature" and value > reference:
            if magnitude >= 4.0:
                mhw_cat = "Cat IV (Extreme)"
            elif magnitude >= 3.0:
                mhw_cat = "Cat III (Severe)"
            elif magnitude >= 2.0:
                mhw_cat = "Cat II (Strong)"
            else:
                mhw_cat = "Cat I (Moderate)"

        val_2dec = round(value, 2)
        ref_2dec = round(reference, 2)

        anomalies.append(
            {
                "float_id": float_id,
                "latitude": round(lat, 3),
                "longitude": round(lon, 3),
                "date": date,
                "parameter": parameter,
                "value": val_2dec,
                "threshold": ref_2dec,
                "severity": severity,
                "mhw_category": mhw_cat,
                "description": _describe_anomaly(parameter, val_2dec, ref_2dec, robust_z, len(values), mhw_cat),
            }
        )
    return anomalies


def run_anomaly_scan(reset_existing: bool = False, max_profiles: int = 500) -> int:
    """Rebuild alerts from real Argo observations and return the number found."""
    with get_connection() as conn:
        if reset_existing:
            conn.execute("DELETE FROM anomaly_alerts")
        profiles = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, float_id, latitude, longitude, date
                FROM argo_profiles
                ORDER BY date DESC
                LIMIT ?
                """,
                (max_profiles,),
            ).fetchall()
        ]
        conn.commit()

    new_count = 0
    for profile in profiles:
        for anomaly in detect_anomalies_in_profile(
            profile["id"], profile["float_id"], profile["latitude"], profile["longitude"], profile["date"]
        ):
            with get_connection() as conn:
                existing = conn.execute(
                    "SELECT id FROM anomaly_alerts WHERE float_id = ? AND date = ? AND parameter = ?",
                    (anomaly["float_id"], anomaly["date"], anomaly["parameter"]),
                ).fetchone()
                if existing:
                    continue
                conn.execute(
                    """
                    INSERT INTO anomaly_alerts
                    (float_id, latitude, longitude, date, parameter, value, threshold, severity, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        anomaly["float_id"], anomaly["latitude"], anomaly["longitude"], anomaly["date"],
                        anomaly["parameter"], anomaly["value"], anomaly["threshold"], anomaly["severity"],
                        anomaly["description"],
                    ),
                )
                conn.commit()
                new_count += 1

    print(f"[AnomalyRadar] Scan complete. {new_count} evidence-based observations stored.")
    return new_count
