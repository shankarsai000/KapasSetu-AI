"""Software-First Agronomic Moisture Proxy with Open-Meteo Telemetry & Phase-2 BLE Sensor Hook."""

from __future__ import annotations

import httpx
from app.config import settings


def fetch_local_weather(lat: float, lon: float) -> tuple[float, float, str]:
    """Query Open-Meteo current relative humidity and temperature with a fast 2s timeout fallback."""
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "current": "relative_humidity_2m,temperature_2m",
    }
    try:
        with httpx.Client(timeout=settings.OPEN_METEO_TIMEOUT_SEC) as client:
            resp = client.get(settings.OPEN_METEO_BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current", {})
            rh = float(current.get("relative_humidity_2m", settings.DEFAULT_FALLBACK_RH_PCT))
            temp = float(current.get("temperature_2m", settings.DEFAULT_FALLBACK_TEMP_C))
            return round(rh, 1), round(temp, 1), "OPEN_METEO_LIVE"
    except Exception:
        return (
            settings.DEFAULT_FALLBACK_RH_PCT,
            settings.DEFAULT_FALLBACK_TEMP_C,
            "REGIONAL_CLIMATE_FALLBACK",
        )


def estimate_cotton_moisture(
    lat: float,
    lon: float,
    picking_session: str,
    shade_dried_days: int,
    sensor_override_pct: float | None = None,
) -> dict:
    """
    Estimate seed-cotton equilibrium moisture content (%).

    - If `sensor_override_pct` is provided (Phase-2 BLE Capacitive Probe), returns it directly
      with `moisture_source = "BLE_SENSOR"`.
    - Otherwise combines Open-Meteo GPS relative humidity with picking session dew factor
      and shade-drying duration, clamped between 7.0% and 16.0%.
    """
    rh_pct, temp_c, provider = fetch_local_weather(lat, lon)
    normalized_session = (picking_session or "AFTERNOON_SUN").strip().upper()
    dried_days = max(0, int(shade_dried_days))

    if sensor_override_pct is not None:
        clamped_ble = max(5.0, min(25.0, float(sensor_override_pct)))
        return {
            "moisture_percent": round(clamped_ble, 2),
            "moisture_source": "BLE_SENSOR",
            "relative_humidity_pct": rh_pct,
            "ambient_temp_c": temp_c,
            "weather_provider": provider,
            "picking_session": normalized_session,
            "shade_dried_days": dried_days,
        }

    # Empirical equilibrium moisture formula for raw Kapas in Indian Vidarbha climate
    dew_penalty = 2.2 if normalized_session == "MORNING_DEW" else 0.0
    drying_credit = min(dried_days, 4) * 0.65
    raw_moisture = 8.5 + ((rh_pct - 50.0) * 0.06) + dew_penalty - drying_credit
    clamped_moisture = max(7.0, min(16.0, raw_moisture))

    return {
        "moisture_percent": round(clamped_moisture, 2),
        "moisture_source": "SOFTWARE_PROXY",
        "relative_humidity_pct": rh_pct,
        "ambient_temp_c": temp_c,
        "weather_provider": provider,
        "picking_session": normalized_session,
        "shade_dried_days": dried_days,
    }

