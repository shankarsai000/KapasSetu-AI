"""2026-27 Indian Cotton MSP & eNAM Mandi Fair Price Calculation Engine."""

from __future__ import annotations

from app.config import settings


def classify_staple_category(staple_mm: float) -> str:
    if staple_mm >= 29.5:
        return "Extra-Long Staple"
    if staple_mm >= 27.5:
        return "Long Staple"
    if staple_mm >= 26.0:
        return "Medium-Long Staple"
    return "Medium Staple"


def calculate_fair_kapas_price(
    staple_mm: float,
    trash_pct: float,
    moisture_pct: float,
    color_grade: str,
) -> dict:
    """
    Calculate transparent net fair farm-gate Kapas price per quintal (INR).

    Formula:
      P_fair = P_base + M_staple + C_grade - D_trash - D_moisture
    """
    is_long_staple = staple_mm >= settings.LONG_STAPLE_THRESHOLD_MM
    p_base = (
        settings.MSP_LONG_STAPLE_INR
        if is_long_staple
        else settings.MSP_MEDIUM_STAPLE_INR
    )
    msp_class = (
        "Long Staple (2026-27 MSP Benchmark)"
        if is_long_staple
        else "Medium Staple (2026-27 MSP Benchmark)"
    )

    if is_long_staple:
        m_staple = (staple_mm - settings.LONG_STAPLE_THRESHOLD_MM) * 150.0
    else:
        m_staple = (staple_mm - settings.MEDIUM_STAPLE_BASELINE_MM) * 120.0

    grade_upper = (color_grade or "").upper()
    if "SUVIN" in grade_upper:
        color_adj = 300.0
    elif "GRADE A" in grade_upper:
        color_adj = 200.0
    elif "GRADE C" in grade_upper:
        color_adj = -250.0
    else:
        color_adj = 0.0

    if trash_pct <= settings.TRASH_BENCHMARK_PCT:
        d_trash = 0.0
    else:
        d_trash = (trash_pct - settings.TRASH_BENCHMARK_PCT) * 0.012 * p_base

    if moisture_pct <= settings.MOISTURE_BENCHMARK_PCT:
        d_moisture = 0.0
    else:
        d_moisture = (moisture_pct - settings.MOISTURE_BENCHMARK_PCT) * 0.015 * p_base

    final_price = round(p_base + m_staple + color_adj - d_trash - d_moisture, 2)
    walkaway_price = round(max(6200.0, final_price - 140.0), 0)

    tips: list[str] = [
        f"Do not sell below Rs {int(walkaway_price):,}/qtl to local traders!"
    ]
    if moisture_pct > 9.5:
        recoverable = round(d_moisture * 0.75)
        tips.append(
            f"Drying in shade for 2 more days can recover ~Rs {recoverable}/qtl in moisture deductions."
        )
    elif moisture_pct <= 8.5:
        tips.append(
            f"Verified moisture ({moisture_pct:.1f}%) is near the 8% benchmark—reject arbitrary 12-15% trader moisture cuts."
        )
    tips.append("Pool your lot in the 5km Village Cluster to unlock direct Gin Mill pickup bids.")

    return {
        "msp_class": msp_class,
        "staple_category": classify_staple_category(staple_mm),
        "base_msp_price": round(p_base, 2),
        "staple_adjustment": round(m_staple, 2),
        "color_adjustment": round(color_adj, 2),
        "trash_deduction": round(d_trash, 2),
        "moisture_deduction": round(d_moisture, 2),
        "final_fair_price_per_qtl": final_price,
        "minimum_walkaway_price_per_qtl": walkaway_price,
        "negotiation_tip": " ".join(tips),
    }

