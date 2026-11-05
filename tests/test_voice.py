"""
KapasSetu AI — Multilingual Voice Assistant ("Kapas Sahayak") Test Suite (`tests/test_voice.py`).

Verifies:
1. Spoken currency, percentage, and agronomic unit normalization across Indian languages.
2. In-memory LRU audio caching and fallback tone WAV synthesis.
3. Conversational Intent Handler recognizing farmer queries:
   - "How to use app?" (camera guidance)
   - "Is this app free?" (trust & zero fee assurance)
   - "Trader offering low price?" (negotiation script with dynamic grade context)
   - "What is village pool?" (5km spatial clustering)
4. FastAPI Voice Endpoints:
   - POST /api/v1/voice/tts
   - POST /api/v1/voice/ask
   - POST /api/v1/voice/narrate-grade
   - GET  /api/v1/voice/onboarding-audio
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT_DIR))

os.environ["USE_SQLITE_FALLBACK"] = "True"
os.environ["SQLITE_URL"] = f"sqlite:///{(BACKEND_DIR / 'test_voice.db').as_posix()}"

from app.main import app
from app.services.voice_service import TextNormalizer, voice_service


def teardown_module() -> None:
    test_db = BACKEND_DIR / "test_voice.db"
    if test_db.exists():
        try:
            test_db.unlink()
        except OSError:
            pass


def test_1_text_normalizer_currency_and_units():
    """Verify that symbols like ₹, /qtl, and % are converted to natural spoken regional words."""
    norm = TextNormalizer()

    # Marathi normalization
    mr_text = "हमीभाव ₹8,300/qtl आहे आणि कचरा 2.5% आहे."
    mr_norm = norm.normalize_for_speech(mr_text, "mr-IN")
    assert "8300 रुपये प्रति क्विंटल" in mr_norm
    assert "2.5 टक्के" in mr_norm
    assert "₹" not in mr_norm

    # Hindi normalization
    hi_text = "मंडी भाव ₹7,868/quintal है और कचरा 3% है।"
    hi_norm = norm.normalize_for_speech(hi_text, "hi-IN")
    assert "7868 रुपये प्रति क्विंटल" in hi_norm
    assert "3 प्रतिशत" in hi_norm

    # English normalization
    en_text = "Fair price is ₹7,521/qtl with 2% trash."
    en_norm = norm.normalize_for_speech(en_text, "en-IN")
    assert "7521 rupees per quintal" in en_norm
    assert "2 percent" in en_norm


def test_2_voice_synthesis_and_lru_caching():
    """Verify speech synthesis returns valid playable audio bytes and caches repeated queries."""
    sample_text = "कापूस सेतू ॲप कसे वापरायचे?"
    audio_1, mime_1, engine_1 = voice_service.synthesize_speech(sample_text, lang_code="mr-IN")
    assert len(audio_1) > 100, "Audio bytes must not be empty"
    assert mime_1 in ["audio/mpeg", "audio/wav"]

    # Second call for identical text and language MUST hit the cache
    audio_2, mime_2, engine_2 = voice_service.synthesize_speech(sample_text, lang_code="mr-IN")
    assert audio_1 == audio_2
    assert engine_2 in ["gnani_cache", "gnani_timbre_v3.0", "browser_fallback"]


def test_3_conversational_intent_handler():
    """Verify intent mapping and localized responses for farmer core concerns."""
    # 1. Cost & Free Intent
    res_cost = voice_service.answer_farmer_query("हे ॲप मोफत आहे का?", lang_code="mr-IN")
    assert res_cost["intent"] == "COST_AND_FREE"
    assert "१०० टक्के मोफत" in res_cost["reply_text"]
    assert len(res_cost["audio_base64"]) > 50

    # 2. How to Use Intent
    res_use = voice_service.answer_farmer_query("कापसाचा फोटो कसा काढायचा?", lang_code="hi-IN")
    assert res_use["intent"] == "HOW_TO_USE"
    assert "सफेद कागज" in res_use["reply_text"] or "सिक्का" in res_use["reply_text"]

    # 3. Negotiation Intent with Dynamic Grade Context
    mock_context = {
        "color_grade": "Grade A",
        "trash_percent": 1.9,
        "final_fair_price_per_qtl": 8300.0,
        "village_name": "Kalamb",
    }
    res_neg = voice_service.answer_farmer_query(
        "व्यापारी 7000 रुपये देतोय, काय करू?",
        lang_code="mr-IN",
        current_grade_context=mock_context,
    )
    assert res_neg["intent"] == "NEGOTIATION_AND_PRICE"
    assert "8300 रुपये" in res_neg["reply_text"]
    assert "8150" in res_neg["reply_text"]  # min threshold check


def test_4_fastapi_voice_endpoints():
    """Verify HTTP API endpoints for TTS, Q&A, and grade narration."""
    with TestClient(app) as client:
        # 1. POST /api/v1/voice/tts
        tts_res = client.post(
            "/api/v1/voice/tts",
            json={"text": "राम राम शेतकरी मित्रांनो!", "language": "mr-IN"},
        )
        assert tts_res.status_code == 200
        assert len(tts_res.content) > 100

        # 2. POST /api/v1/voice/ask (JSON format)
        ask_res = client.post(
            "/api/v1/voice/ask",
            json={
                "query_text": "गाव समूह म्हणजे काय?",
                "language": "mr-IN",
            },
        )
        assert ask_res.status_code == 200
        data = ask_res.json()
        assert data["status"] == "success"
        assert data["intent"] == "VILLAGE_POOL_INFO"
        assert "audio_base64" in data

        # 3. POST /api/v1/voice/narrate-grade
        narrate_res = client.post(
            "/api/v1/voice/narrate-grade",
            json={
                "color_grade": "Grade A - Superior White",
                "trash_percent": 2.1,
                "final_fair_price_per_qtl": 8150.0,
                "village_name": "Kalamb",
                "language": "mr-IN",
            },
        )
        assert narrate_res.status_code == 200
        narrate_data = narrate_res.json()
        assert "8150 रुपये" in narrate_data["narration_text"]
        assert "audio_base64" in narrate_data

        # 4. GET /api/v1/voice/onboarding-audio
        onboarding_res = client.get("/api/v1/voice/onboarding-audio?language=mr-IN")
        assert onboarding_res.status_code == 200
        assert "guide_text" in onboarding_res.json()


def test_5_language_switching_and_silence_handling():
    """Verify voice-driven language switching and silent speech handling to prevent loops."""
    # 1. Voice language switch detection
    res_hi = voice_service.answer_farmer_query("हिंदी में बोलो", lang_code="mr-IN")
    assert res_hi["intent"] == "SWITCH_LANGUAGE"
    assert res_hi["switched_language"] == "hi-IN"
    assert res_hi["language"] == "hi-IN"
    assert "किसान भाई" in res_hi["reply_text"]

    res_mr = voice_service.answer_farmer_query("मराठीत बोला", lang_code="hi-IN")
    assert res_mr["intent"] == "SWITCH_LANGUAGE"
    assert res_mr["switched_language"] == "mr-IN"
    assert "शेतकरी दादा" in res_mr["reply_text"]

    # 2. Agronomic pest advisory intent
    res_pest = voice_service.answer_farmer_query("गुलाबी बोंड अळीसाठी काय फवारावे?", lang_code="mr-IN")
    assert res_pest["intent"] == "PEST_AND_DISEASE"
    assert "फेरोमोन ट्रॅप" in res_pest["reply_text"] or "निंबोळी" in res_pest["reply_text"]

    # 3. Silence / Empty voice query via FastAPI router: must return 'no_speech' instead of infinite Namaste loop
    with TestClient(app) as client:
        silence_res = client.post(
            "/api/v1/voice/ask",
            json={"query_text": "", "language": "mr-IN"},
        )
        assert silence_res.status_code == 200
        data = silence_res.json()
        assert data["status"] == "no_speech"
        assert data["intent"] == "SILENCE"
        assert data["reply_text"] == ""


