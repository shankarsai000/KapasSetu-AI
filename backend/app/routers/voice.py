"""
KapasSetu AI — Multilingual Voice Assistant & Gnani Speech APIs Router.

Endpoints:
- POST /api/v1/voice/tts: Synthesize speech via Gnani Timbre v3.0 (with LRU cache & offline tone fallback)
- POST /api/v1/voice/ask: Conversational voice Q&A (Prisma STT -> Intent Handler -> Timbre TTS)
- POST /api/v1/voice/narrate-grade: Natural spoken voice narration of cotton grading results
- GET  /api/v1/voice/onboarding-audio: Pre-cached onboarding audio for instant IndexedDB offline playback
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field

from app.services.voice_service import SUPPORTED_LANGUAGES, voice_service

router = APIRouter(prefix="/api/v1/voice", tags=["Multilingual Voice Assistant (Kapas Sahayak)"])


class VoiceTtsRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize")
    language: str = Field("mr-IN", description="Language code (mr-IN, hi-IN, te-IN, en-IN, etc.)")
    speed: str = Field("medium", description="Playback speed: slow | medium | fast")


class VoiceAskJsonRequest(BaseModel):
    query_text: str | None = Field(None, description="Optional text query if already transcribed")
    audio_base64: str | None = Field(None, description="Optional base64 encoded audio bytes")
    language: str = Field("mr-IN", description="Language code")
    grade_context: dict[str, Any] | None = Field(None, description="Current assay details for dynamic answer")
    conversation_history: list[dict[str, Any]] | None = Field(
        None, description="Previous dialog turns for multi-turn conversational context"
    )


class NarrateGradeRequest(BaseModel):
    color_grade: str = Field("Grade A", description="Cotton color grade")
    trash_percent: float = Field(2.2, description="Trash %")
    final_fair_price_per_qtl: float = Field(7868.0, description="Fair price per quintal in INR")
    village_name: str | None = Field("Kalamb", description="Village cluster name")
    language: str = Field("mr-IN", description="Language code")


@router.get("/languages")
def get_supported_languages() -> dict[str, Any]:
    """Return all supported Indian languages with native scripts and codes."""
    return {"languages": list(SUPPORTED_LANGUAGES.values())}


@router.post("/tts")
def synthesize_text_to_speech(
    payload: VoiceTtsRequest,
    request: Request,
    format: str | None = Query(None, description="Return 'json' with base64 audio or direct binary audio"),
) -> Response:
    """
    Accepts text and language, synthesizes speech via Gnani Timbre v3.0 TTS,
    and returns binary audio/mpeg or JSON with base64 audio.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    audio_bytes, mime, engine = voice_service.synthesize_speech(
        text=payload.text,
        lang_code=payload.language,
        speed=payload.speed,
    )

    accept_header = request.headers.get("accept", "")
    if format == "json" or "application/json" in accept_header:
        import base64

        return Response(
            content=json.dumps(
                {
                    "language": payload.language,
                    "mime_type": mime,
                    "engine": engine,
                    "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                }
            ),
            media_type="application/json",
        )

    return Response(
        content=audio_bytes,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/ask")
async def ask_voice_copilot(
    request: Request,
    file: UploadFile | None = File(None),
    query_text: str | None = Form(None),
    language: str = Form("mr-IN"),
    grade_context: str | None = Form(None),
    conversation_history: str | None = Form(None),
) -> dict[str, Any]:
    """
    Accepts either multipart audio upload OR JSON payload, executes:
    1. Gnani Prisma STT (speech-to-text) if audio provided
    2. Conversational Intent Handler for farmer questions with multi-turn history
    3. Gnani Timbre v3.0 TTS / Neural Regional Voice Synthesis
    Returns localized transcript, answer text, base64 audio, suggested followups, and engine badge.
    """
    # Check if request was sent as application/json
    content_type = request.headers.get("content-type", "")
    raw_audio_bytes = b""
    actual_query = query_text or ""
    actual_lang = language
    parsed_context: dict[str, Any] = {}
    parsed_history: list[dict[str, Any]] = []

    if "application/json" in content_type:
        try:
            body = await request.json()
            actual_query = body.get("query_text") or ""
            actual_lang = body.get("language") or "mr-IN"
            parsed_context = body.get("grade_context") or {}
            parsed_history = body.get("conversation_history") or []
            audio_b64 = body.get("audio_base64")
            if audio_b64:
                import base64

                raw_audio_bytes = base64.b64decode(audio_b64)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc
    else:
        if file is not None:
            raw_audio_bytes = await file.read()
        if grade_context:
            try:
                parsed_context = json.loads(grade_context)
            except Exception:
                parsed_context = {}
        if conversation_history:
            try:
                parsed_history = json.loads(conversation_history)
            except Exception:
                parsed_history = []

    # Transcribe audio if provided and query_text is empty
    stt_engine = "text_provided"
    if raw_audio_bytes and not actual_query:
        actual_query, stt_engine = voice_service.transcribe_farmer_query(
            audio_bytes=raw_audio_bytes,
            lang_code=actual_lang,
        )

    if not actual_query or not actual_query.strip():
        return {
            "status": "no_speech",
            "reply_text": "",
            "audio_base64": "",
            "audio_mime": "audio/mpeg",
            "engine": "none",
            "stt_engine": stt_engine,
            "transcription": "",
            "intent": "SILENCE",
            "suggested_followups": [],
            "is_conversation_end": False,
            "message": "कोणताही आवाज ऐकू आला नाही. बोलण्यासाठी माईक पुन्हा दाबा.",
        }

    result = voice_service.answer_farmer_query(
        query_text=actual_query.strip(),
        lang_code=actual_lang,
        current_grade_context=parsed_context,
        conversation_history=parsed_history,
    )
    result["stt_engine"] = stt_engine
    return result


@router.post("/narrate-grade")
def narrate_cotton_grade(payload: NarrateGradeRequest) -> dict[str, Any]:
    """Generate spoken voice narration of cotton assay results to read aloud upon inference completion."""
    return voice_service.generate_grading_narration(
        assay=payload.model_dump(),
        lang_code=payload.language,
    )


@router.get("/onboarding-audio")
def get_onboarding_audio(language: str = Query("mr-IN")) -> dict[str, Any]:
    """Return pre-synthesized onboarding audio and guide text for frontend pre-caching."""
    result = voice_service.answer_farmer_query(
        query_text="कसे वापरायचे",
        lang_code=language,
    )
    return {
        "status": "success",
        "language": language,
        "guide_text": result["reply_text"],
        "audio_base64": result["audio_base64"],
        "audio_mime": result["audio_mime"],
        "engine": result["engine"],
    }

