"""Evidence-based anomaly detection for locally ingested Argo profiles.

Alerts identify unusual observations relative to nearby historical observations.
They are not cyclone, weather, fishing, or navigation advisories.
"""

from __future__ import annotations

from statistics import median

from .db import get_connection

SURFACE_DEPTH_METERS = 20
MIN_BASELINE_SAMPLES = 20
REGION_RADIUS_DEGREES = 4  # ~440 km local reference window (was 10° / ~1100 km — too broad to be "local")
ROBUST_Z_THRESHOLD = 2.0   # flag from a moderate robust-Z upward so every intensity band is reachable

# Physical-plausibility QC gates. Reject sensor spikes and fill values (e.g. -999, near-zero
# salinity) before they can raise false anomalies or corrupt the baseline median/MAD statistics.
TEMPERATURE_VALID_RANGE = (-2.0, 40.0)   # °C
SALINITY_VALID_RANGE = (10.0, 42.0)      # PSU — open-ocean plausibility; rejects the 3.73 PSU fill spike


def _valid_range(parameter: str) -> tuple[float, float]:
    """Return the accepted physical range for a CTD parameter."""
    return TEMPERATURE_VALID_RANGE if parameter == "temperature" else SALINITY_VALID_RANGE


def _month_from_iso(date: str) -> str | None:
    """Extract the calendar month from an ISO timestamp without assuming a timezone."""
    if len(date) >= 7 and date[4] == "-":
        return date[5:7]
    return None


def _surface_observation(profile_id: int, parameter: str) -> float | None:
    """Return the shallowest physically-valid measurement for one CTD parameter."""
    if parameter not in {"temperature", "salinity"}:
        raise ValueError("Unsupported anomaly parameter")

    lo, hi = _valid_range(parameter)
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT {parameter}
            FROM argo_measurements
            WHERE profile_id = ? AND depth <= ? AND {parameter} IS NOT NULL
              AND {parameter} BETWEEN ? AND ?
            ORDER BY depth ASC
            LIMIT 1
            """,
            (profile_id, SURFACE_DEPTH_METERS, lo, hi),
        ).fetchone()
    return float(row[parameter]) if row else None


def _baseline_values(parameter: str, lat: float, lon: float, date: str) -> list[float]:
    """Fetch a local, same-month, QC-filtered reference sample and widen only when sparse."""
    if parameter not in {"temperature", "salinity"}:
        raise ValueError("Unsupported anomaly parameter")

    lo, hi = _valid_range(parameter)
    month = _month_from_iso(date)
    month_clause = "AND substr(p.date, 6, 2) = ?" if month else ""
    month_params: tuple[object, ...] = (month,) if month else ()
    local_params = (
        SURFACE_DEPTH_METERS,
        lo,
        hi,
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
              AND m.{parameter} BETWEEN ? AND ?
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
                WHERE m.depth <= ? AND m.{parameter} IS NOT NULL
                  AND m.{parameter} BETWEEN ? AND ? {month_clause}
                """,
                (SURFACE_DEPTH_METERS, lo, hi, *month_params),
            ).fetchall()
    return [float(row["value"]) for row in rows]


def _percentile(values: list[float], p: float) -> float:
    """Calculate the p-th percentile (0-100) of a numerical list."""
    if not values:
        return 0.0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_v) - 1)
    d = k - f
    return sorted_v[f] + d * (sorted_v[c] - sorted_v[f])


def _describe_anomaly(
    parameter: str,
    value: float,
    baseline: float,
    robust_z: float,
    sample_count: int,
    mhw_cat: str | None = None,
    p90_threshold: float | None = None,
    hobday_multiplier: float | None = None,
) -> str:
    unit = "°C" if parameter == "temperature" else "PSU"
    direction = "above" if value > baseline else "below"
    mhw_prefix = f"[{mhw_cat}] " if mhw_cat else ""
    diff = round(abs(value - baseline), 2)
    val_rounded = round(value, 2)
    base_rounded = round(baseline, 2)
    z_rounded = round(robust_z, 1)

    if mhw_cat and p90_threshold and hobday_multiplier:
        return (
            f"{mhw_prefix}Observed surface {parameter} {val_rounded:.2f}{unit} exceeds 90th-percentile "
            f"threshold ({p90_threshold:.2f}{unit}) by {(value - p90_threshold):.2f}{unit} "
            f"(Hobday Multiplier: {hobday_multiplier:.1f}x | Climatological Base: {base_rounded:.2f}{unit} | "
            f"Robust Z: {z_rounded:.1f} | n={sample_count}). Source: In-Situ ARGO CTD Profile."
        )

    return (
        f"{mhw_prefix}Observed surface {parameter} {val_rounded:.2f} {unit}, {diff:.2f} {unit} "
        f"{direction} the local same-month baseline ({base_rounded:.2f} {unit}; n={sample_count}; "
        f"robust Z-score {z_rounded:.1f}). Source: In-Situ ARGO CTD Profile."
    )


def detect_anomalies_in_profile(profile_id: int, float_id: str, lat: float, lon: float, date: str) -> list[dict]:
    """
    Detect statistically and oceanographically validated anomalies for one profile.
    For temperature, computes the official Hobday et al. (2016) Marine Heatwave (MHW) Category I-IV
    against the 90th percentile same-month regional climatological baseline.
    """
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

        # Calculate 90th percentile climatological threshold (Hobday et al. 2016)
        p90 = _percentile(values, 90.0)
        p10 = _percentile(values, 10.0)

        # Hobday MHW classification for positive thermal anomalies
        mhw_cat = None
        hobday_multiplier = None
        is_mhw = False

        if parameter == "temperature" and value >= p90:
            is_mhw = True
            threshold_diff = max(p90 - reference, 0.25)
            excess = value - p90
            # Hobday et al. 2016 formula: Multiplier = 1 + (T_obs - T_90) / (T_90 - T_mean)
            hobday_multiplier = round(1.0 + (excess / threshold_diff), 2)

            if hobday_multiplier >= 4.0:
                mhw_cat = "Hobday Cat-IV: Extreme MHW"
                severity = "critical"
            elif hobday_multiplier >= 3.0:
                mhw_cat = "Hobday Cat-III: Severe MHW"
                severity = "critical"
            elif hobday_multiplier >= 2.0:
                mhw_cat = "Hobday Cat-II: Strong MHW"
                severity = "high"
            else:
                mhw_cat = "Hobday Cat-I: Moderate MHW"
                severity = "medium"
        elif abs(robust_z) >= ROBUST_Z_THRESHOLD:
            # Statistical anomaly (e.g. salinity spike/drop or cold thermal anomaly)
            magnitude = abs(robust_z)
            severity = "critical" if magnitude >= 5.0 else "high" if magnitude >= 3.5 else "medium"
            if parameter == "temperature" and value < reference:
                mhw_cat = "Marine Cold-Spell Anomaly"
            elif parameter == "salinity":
                mhw_cat = "High Salinity Front" if value > reference else "Low Salinity Influx"
        else:
            # Below both Hobday MHW threshold and Robust Z threshold
            continue

        val_2dec = round(value, 2)
        ref_2dec = round(reference, 2)
        p90_2dec = round(p90, 2)

        anomalies.append(
            {
                "float_id": float_id,
                "latitude": round(lat, 3),
                "longitude": round(lon, 3),
                "date": date,
                "parameter": parameter,
                "value": val_2dec,
                "threshold": p90_2dec if is_mhw else ref_2dec,
                "climatological_mean": ref_2dec,
                "p90_threshold": p90_2dec,
                "hobday_multiplier": hobday_multiplier,
                "robust_z": round(robust_z, 2),
                "severity": severity,
                "mhw_category": mhw_cat,
                "description": _describe_anomaly(
                    parameter, val_2dec, ref_2dec, robust_z, len(values), mhw_cat, p90_2dec if is_mhw else None, hobday_multiplier
                ),
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

    # Compute detections first (read-only), then persist them in a single write transaction
    # instead of opening/committing a fresh connection per inserted row.
    detected: list[dict] = []
    for profile in profiles:
        detected.extend(
            detect_anomalies_in_profile(
                profile["id"], profile["float_id"], profile["latitude"], profile["longitude"], profile["date"]
            )
        )

    new_count = 0
    with get_connection() as conn:
        for anomaly in detected:
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
            new_count += 1
        conn.commit()

    print(f"[AnomalyRadar] Scan complete. {new_count} evidence-based observations stored.")
    return new_count
