"""
KapasSetu AI — Backend Voice Service Module Alias.
Directly re-exports GnaniVoiceService and voice_service from app.services.voice_service.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.voice_service import (  # noqa: E402
    GnaniVoiceService,
    SUPPORTED_LANGUAGES,
    TextNormalizer,
    voice_service,
)

# Export functions matching master prompt signature
synthesize_speech = voice_service.synthesize_speech
transcribe_farmer_query = voice_service.transcribe_farmer_query
answer_farmer_query = voice_service.answer_farmer_query
generate_grading_narration = voice_service.generate_grading_narration

__all__ = [
    "GnaniVoiceService",
    "SUPPORTED_LANGUAGES",
    "TextNormalizer",
    "voice_service",
    "synthesize_speech",
    "transcribe_farmer_query",
    "answer_farmer_query",
    "generate_grading_narration",
]

