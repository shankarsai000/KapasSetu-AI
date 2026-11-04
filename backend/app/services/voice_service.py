"""
KapasSetu AI — Multilingual Voice Assistant Service ("Kapas Sahayak").

Integrates Gnani.ai Speech APIs:
- Gnani Timbre v3.0 TTS (Text-to-Speech)
- Gnani Prisma STT (Speech-to-Text)

Features:
1. 10 Indian Languages (`mr-IN` Marathi, `hi-IN` Hindi, `te-IN` Telugu, `gu-IN` Gujarati,
   `kn-IN` Kannada, `ta-IN` Tamil, `pa-IN` Punjabi, `bn-IN` Bengali, `ml-IN` Malayalam, `en-IN` English).
2. Spoken Currency and Unit Normalization (e.g. ₹8,300/qtl -> "8300 रुपये प्रति क्विंटल").
3. Automatic Exponential Backoff Retry on 429 (RATE_LIMITED) errors.
4. In-Memory LRU Prompt Caching (instant playback with zero API quota burn).
5. Offline / Zero-Key Fallback with standard tone audio and browser SpeechSynthesis support.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import math
import os
import re
import struct
import time
import wave
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("kapassetu.voice")

# Supported language codes and labels
SUPPORTED_LANGUAGES = {
    "mr-IN": {"name": "Marathi", "native": "मराठी", "code": "mr-IN"},
    "hi-IN": {"name": "Hindi", "native": "हिन्दी", "code": "hi-IN"},
    "te-IN": {"name": "Telugu", "native": "తెలుగు", "code": "te-IN"},
    "gu-IN": {"name": "Gujarati", "native": "ગુજરાતી", "code": "gu-IN"},
    "kn-IN": {"name": "Kannada", "native": "ಕನ್ನಡ", "code": "kn-IN"},
    "ta-IN": {"name": "Tamil", "native": "தமிழ்", "code": "ta-IN"},
    "pa-IN": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "code": "pa-IN"},
    "bn-IN": {"name": "Bengali", "native": "বাংলা", "code": "bn-IN"},
    "ml-IN": {"name": "Malayalam", "native": "മലയാളം", "code": "ml-IN"},
    "en-IN": {"name": "Indian English", "native": "English", "code": "en-IN"},
}

# In-memory LRU prompt cache: key -> (audio_bytes, mime_type, engine)
_TTS_CACHE: dict[str, tuple[bytes, str, str]] = {}
_MAX_CACHE_ENTRIES = 512


def _make_cache_key(lang_code: str, text: str, speed: str) -> str:
    raw = f"{lang_code}:{speed}:{text.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def generate_fallback_tone_wav(duration_sec: float = 0.5, freq: float = 523.25) -> bytes:
    """
    Synthesize lightweight, valid WAV audio bytes in pure Python standard library.
    Used when Gnani API key is not configured or offline fallback is active.
    """
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        frames = []
        for i in range(num_samples):
            t = float(i) / sample_rate
            # Smooth gentle chime with exponential fade-out
            decay = math.exp(-3.5 * t / duration_sec)
            val = int(32767.0 * 0.25 * decay * math.sin(2.0 * math.pi * freq * t))
            frames.append(struct.pack("<h", max(-32768, min(32767, val))))
        w.writeframes(b"".join(frames))
    return buf.getvalue()


class TextNormalizer:
    """Normalizes Indian currency, agronomic units, and technical acronyms for natural TTS pronunciation."""

    @staticmethod
    def normalize_for_speech(text: str, lang_code: str) -> str:
        s = text
        # Remove markdown bold/italics
        s = re.sub(r"[*_#`]", "", s)
        # Strip commas in numbers like 8,300 -> 8300
        s = re.sub(r"(\d+),(\d+)", r"\1\2", s)

        # Currency and unit replacements
        if lang_code.startswith("mr"):
            s = s.replace("₹", "")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal|/क्विंटल)", r"\1 रुपये प्रति क्विंटल", s)
            s = re.sub(r"(\d+)\s*%", r"\1 टक्के", s)
            s = s.replace("UHML", "स्टेपल लांबी")
            s = s.replace("MSP", "हमीभाव")
            s = s.replace("APMC", "बाजार समिती")
        elif lang_code.startswith("hi"):
            s = s.replace("₹", "")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal|/क्विंटल)", r"\1 रुपये प्रति क्विंटल", s)
            s = re.sub(r"(\d+)\s*%", r"\1 प्रतिशत", s)
            s = s.replace("UHML", "स्टेपल लंबाई")
            s = s.replace("MSP", "एमएसपी समर्थन मूल्य")
            s = s.replace("APMC", "मंडी समिति")
        elif lang_code.startswith("te"):
            s = s.replace("₹", "")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal)", r"\1 రూపాయలు క్వింటాల్‌కు", s)
            s = re.sub(r"(\d+)\s*%", r"\1 శాతం", s)
        elif lang_code.startswith("gu"):
            s = s.replace("₹", "")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal)", r"\1 રૂપિયા પ્રતિ ક્વિન્ટલ", s)
            s = re.sub(r"(\d+)\s*%", r"\1 ટકા", s)
        elif lang_code.startswith("kn"):
            s = s.replace("₹", "")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal)", r"\1 ರೂಪಾಯಿ ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ", s)
            s = re.sub(r"(\d+)\s*%", r"\1 ಶೇಕಡಾ", s)
        else:
            s = s.replace("₹", "rupees ")
            s = re.sub(r"(\d+)\s*(?:/qtl|/quintal)", r"\1 rupees per quintal", s)
            s = re.sub(r"(\d+)\s*%", r"\1 percent", s)
            s = s.replace("UHML", "staple length")
            s = s.replace("MSP", "minimum support price")

        # Strip repeated spaces
        return re.sub(r"\s+", " ", s).strip()


class GnaniVoiceService:
    """Voice service managing Gnani Timbre v3.0 TTS and Prisma STT integration with local fallback."""

    def __init__(self) -> None:
        self.normalizer = TextNormalizer()

    @property
    def api_key(self) -> str:
        return (
            os.environ.get("GNANI_API_KEY", "")
            or getattr(settings, "GNANI_API_KEY", "")
        ).strip()

    def synthesize_speech(
        self,
        text: str,
        lang_code: str = "mr-IN",
        speed: str = "medium",
    ) -> tuple[bytes, str, str]:
        """
        Synthesize spoken audio from text using Gnani Timbre v3.0 TTS.
        Returns: (audio_bytes, mime_type, engine_used)
        """
        normalized_text = self.normalizer.normalize_for_speech(text, lang_code)
        cache_key = _make_cache_key(lang_code, normalized_text, speed)

        # 1. Check in-memory cache
        if cache_key in _TTS_CACHE:
            cached_bytes, cached_mime, _ = _TTS_CACHE[cache_key]
            return cached_bytes, cached_mime, "gnani_cache"

        # 2. Call live Gnani Timbre v3.0 TTS if API key is configured
        if self.api_key:
            endpoint = getattr(
                settings,
                "GNANI_TTS_ENDPOINT",
                "https://api.vachana.ai/api/v1/tts/inference",
            )
            headers = {
                "X-API-Key-ID": self.api_key,
                "Content-Type": "application/json",
            }
            payload = {
                "model": "timbre-v3.0",
                "language": lang_code,
                "text": normalized_text,
                "audio_config": {
                    "sample_rate": 22050,
                    "container": "mp3",
                    "encoding": "linear_pcm",
                    "bitrate": "128k",
                    "speaking_rate": 1.0 if speed == "medium" else (1.15 if speed == "fast" else 0.88),
                },
            }

            max_retries = 3
            backoff_sec = 1.5
            for attempt in range(max_retries):
                try:
                    with httpx.Client(timeout=8.0) as client:
                        resp = client.post(endpoint, headers=headers, json=payload)

                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type", "")
                        if "json" in content_type:
                            data = resp.json()
                            raw_b64 = (
                                data.get("audio")
                                or data.get("audioContent")
                                or data.get("data", "")
                            )
                            audio_bytes = base64.b64decode(raw_b64) if raw_b64 else b""
                        else:
                            audio_bytes = resp.content

                        if audio_bytes:
                            if len(_TTS_CACHE) >= _MAX_CACHE_ENTRIES:
                                _TTS_CACHE.pop(next(iter(_TTS_CACHE)))
                            _TTS_CACHE[cache_key] = (audio_bytes, "audio/mpeg", "gnani_timbre_v3.0")
                            return audio_bytes, "audio/mpeg", "gnani_timbre_v3.0"

                    elif resp.status_code == 429:
                        logger.warning(
                            "Gnani TTS HTTP 429 Rate-Limited on attempt %d/%d. Backing off %.1fs...",
                            attempt + 1,
                            max_retries,
                            backoff_sec,
                        )
                        time.sleep(backoff_sec)
                        backoff_sec *= 1.8
                        continue
                    else:
                        logger.warning(
                            "Gnani TTS returned HTTP %d: %s", resp.status_code, resp.text[:200]
                        )
                        break
                except Exception as exc:
                    logger.warning("Gnani TTS network exception: %s", exc)
                    break

        # 3. Fallback: Pure Python audio tone + browser SpeechSynthesis fallback
        fallback_bytes = generate_fallback_tone_wav(duration_sec=0.35, freq=587.33)
        return fallback_bytes, "audio/wav", "browser_fallback"

    def transcribe_farmer_query(
        self,
        audio_bytes: bytes,
        lang_code: str = "mr-IN",
    ) -> tuple[str, str]:
        """
        Transcribe spoken audio from smartphone microphone using Gnani Prisma STT.
        Returns: (transcribed_text, engine_used)
        """
        if not audio_bytes:
            return "", "empty_audio"

        if self.api_key:
            endpoint = getattr(
                settings,
                "GNANI_STT_ENDPOINT",
                "https://api.vachana.ai/api/v1/stt/inference",
            )
            headers = {
                "X-API-Key-ID": self.api_key,
            }
            try:
                files = {"file": ("query.wav", audio_bytes, "audio/wav")}
                data = {"language": lang_code, "model": "prisma-v1.0"}
                with httpx.Client(timeout=8.0) as client:
                    resp = client.post(endpoint, headers=headers, data=data, files=files)
                if resp.status_code == 200:
                    result = resp.json()
                    transcript = (
                        result.get("transcript")
                        or result.get("text")
                        or result.get("results", [{}])[0].get("transcript", "")
                    )
                    if transcript:
                        return transcript.strip(), "gnani_prisma_stt"
            except Exception as exc:
                logger.warning("Gnani STT API exception: %s", exc)

        # Smart fallback if audio cannot be remotely decoded
        return "ॲप कसे वापरायचे आणि कापसाचा योग्य भाव काय आहे?", "fallback_intent"

    def answer_farmer_query(
        self,
        query_text: str,
        lang_code: str = "mr-IN",
        current_grade_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Conversational Intent Handler:
        Maps farmer voice questions into localized regional explanations with dynamic assay context.
        """
        q_lower = query_text.lower().strip()
        context = current_grade_context or {}

        # 1. Identify Intent
        intent = "GENERAL_HELP"
        if any(w in q_lower for w in ["वापर", "कसे", "use", "photo", "फोटो", "guide", "कसा", "కలా", "કેવી", "ಹೇಗೆ"]):
            intent = "HOW_TO_USE"
        elif any(w in q_lower for w in ["पैसे", "फी", "cost", "free", "मोफत", "charges", "चार्ज", "ముచితం", "મફત", "ಉಚಿತ"]):
            intent = "COST_AND_FREE"
        elif any(w in q_lower for w in ["भाव", "दाम", "price", "rate", "व्यापारी", "trader", "कमी", "विकू", "मंडी", "दर", "బేరం", "બજાર", "ಬೆಲೆ"]):
            intent = "NEGOTIATION_AND_PRICE"
        elif any(w in q_lower for w in ["पूल", "pool", "समूह", "cluster", "गाव", "ट्रक", "४ क्विंटल"]):
            intent = "VILLAGE_POOL_INFO"

        # 2. Extract context variables
        grade_label = context.get("color_grade", "Grade A (उत्कृष्ट प्रत)")
        trash_pct = context.get("trash_percent", 2.2)
        price_val = int(context.get("final_fair_price_per_qtl", 7868.0))
        min_negotiation = price_val - 150
        village_name = context.get("village_name", "कळंब")

        # 3. Formulate localized response
        responses_by_lang = {
            "mr-IN": {
                "HOW_TO_USE": (
                    "राम राम शेतकरी बंधूंनो! कापसाचा अचूक भाव काढणे खूप सोपे आहे. "
                    "कापसाच्या ढिगाऱ्याशेजारी पांढरा कागद आणि पाच रुपयांचे नाणे ठेवा आणि कॅमेऱ्याने फोटो काढा. "
                    "किंवा तुम्ही चाचणीसाठी थेट फोटो अपलोड करू शकता. "
                    "अवघ्या ५ सेकंदात आमचे AI तुम्हाला कापसाचा खरा ग्रेड आणि योग्य हमीभाव सांगेल!"
                ),
                "COST_AND_FREE": (
                    "शेतकरी मित्रांनो, कापूस सेतू ॲप तुमच्यासाठी १०० टक्के मोफत आहे आणि नेहमी मोफत राहील! "
                    "याचे कोणतेही शुल्क किंवा छुपे पैसे नाहीत. जिनिंग आणि स्पिनिंग मिल आम्हाला सेवा शुल्क देतात "
                    "कारण त्यांना स्वच्छ आणि प्रमाणित कापूस मिळतो. शेतकऱ्यांवर कोणताही भुर्दंड नाही."
                ),
                "NEGOTIATION_AND_PRICE": (
                    f"भाऊ, तुमच्या कापसाचा ग्रेड {grade_label} असून कचरा फक्त {trash_pct} टक्के आहे. "
                    f"आजचा वाजवी बाजारभाव {price_val} रुपये प्रति क्विंटल आहे. "
                    f"व्यापाऱ्याला ठामपणे सांगा, {min_negotiation} रुपयांपेक्षा कमी भावात माल देणार नाही! "
                    f"स्थानिक व्यापारी भाव पाडत असेल, तर लगेच ५ किमी गाव समूहात सामील व्हा; मिल थेट तुमच्या बांधावर ट्रॅक्टर पाठवेल!"
                ),
                "VILLAGE_POOL_INFO": (
                    f"गाव समूह (व्हिलेज पूल) म्हणजे ५ किलोमीटर परिसरातील शेतकऱ्यांची ताकद! "
                    f"तुमच्याकडे फक्त ४ क्विंटल कापूस असला तरी शेजाऱ्यांसोबत मिळून ३० क्विंटलचा ट्रक भरतो. "
                    f"३० क्विंटल पूर्ण होताच जिनिंग मिल थेट तुमच्या गावातून मोफत ट्रॅक्टरने माल उचलते आणि प्रति क्विंटल ३०० ते ४०० रुपये जास्त भाव मिळतो!"
                ),
                "GENERAL_HELP": (
                    "राम राम! मी आपला कापूस सहाय्यक आहे. "
                    "तुम्ही मला ॲप कसा वापरायचा, कापसाचा योग्य भाव, किंवा व्यापारी कमी भाव देत असल्यास काय करावे हे विचारू शकता."
                ),
            },
            "hi-IN": {
                "HOW_TO_USE": (
                    "राम राम किसान भाई! कपास की सही गुणवत्ता और भाव जानना बहुत आसान है। "
                    "कपास के ढेर के पास एक सादा सफेद कागज और पांच रुपये का सिक्का रखकर फोटो लें, "
                    "या फोन से सीधे फोटो अपलोड करें। सिर्फ ५ सेकंड में लैब-जैसी ग्रेडिंग और एमएसपी उचित मूल्य मिल जाएगा!"
                ),
                "COST_AND_FREE": (
                    "किसान भाइयों, कपास सेतू ऐप किसानों के लिए १०० प्रतिशत बिल्कुल मुफ्त है! "
                    "इसका कोई भी शुल्क नहीं है। स्पिनिंग और जिनिंग मिलें हमें भुगतान करती हैं क्योंकि उन्हें साफ कपास मिलता है। "
                    "किसानों से एक भी रुपया नहीं लिया जाता।"
                ),
                "NEGOTIATION_AND_PRICE": (
                    f"भाई, आपकी कपास का ग्रेड {grade_label} है और कचरा सिर्फ {trash_pct} प्रतिशत है। "
                    f"आज का उचित मंडी भाव {price_val} रुपये प्रति क्विंटल है। "
                    f"व्यापारी से साफ कहें कि {min_negotiation} रुपये से कम में नहीं बेचेंगे! "
                    f"अगर व्यापारी कम दे, तो अपने ५ किमी गांव समूह में शामिल हों, मिल सीधे खेत से माल उठाएगी!"
                ),
                "VILLAGE_POOL_INFO": (
                    "गांव समूह ५ किलोमीटर के दायरे में किसानों का सामूहिक मंच है। "
                    "यदि आपके पास सिर्फ ४-५ क्विंटल कपास है, तो पड़ोसियों के साथ मिलकर ३० क्विंटल का ट्रक लोड बनता है। "
                    "इससे मिलें सीधे आपके खेत से ऊंचे दाम पर कपास उठाती हैं और आढ़ती कमीशन बचता है!"
                ),
                "GENERAL_HELP": (
                    "नमस्ते! मैं आपका कपास सहायक हूँ। "
                    "आप मुझसे ऐप का उपयोग, अपनी फसल का सही भाव या व्यापारी से मोलभाव के बारे में पूछ सकते हैं।"
                ),
            },
            "te-IN": {
                "HOW_TO_USE": (
                    "నమస్కారం రైతు సోదరులారా! పత్తి గ్రేడ్ మరియు ధర తెలుసుకోవడం చాలా సులభం. "
                    "పత్తి రాశి పక్కన తెల్ల కాగితం మరియు ఐదు రూపాయల నాణెం ఉంచి ఫోటో తీయండి. "
                    "కేవలం 5 సెకన్లలో సరైన గ్రేడ్ మరియు సరసమైన మార్కెట్ ధరను పొందండి!"
                ),
                "COST_AND_FREE": (
                    "రైతు సోదరులారా, కపాస్‌సేతు యాప్ రైతుల కోసం 100 శాతం ఉచితం! "
                    "జిన్నింగ్ మిల్లులు దీని ఖర్చును భరిస్తాయి. రైతుల నుండి ఎటువంటి రుసుము తీసుకోబడదు."
                ),
                "NEGOTIATION_AND_PRICE": (
                    f"సోదరా, మీ పత్తి గ్రేడ్ {grade_label}, వ్యర్థాలు కేవలం {trash_pct} శాతం మాత్రమే ఉన్నాయి. "
                    f"ఈరోజు సరసమైన ధర క్వింటాల్‌కు {price_val} రూపాయలు. "
                    f"{min_negotiation} రూపాయల కంటే తక్కువకు అమ్మవద్దు! గ్రామ సమూహంలో చేరితే మిల్లులే నేరుగా కొనుగోలు చేస్తాయి!"
                ),
                "VILLAGE_POOL_INFO": (
                    "5 కిలోమీటర్ల పరిధిలోని రైతులు కలిసి 30 క్వింటాళ్ల లారీ లోడ్ చేయడం ద్వారా "
                    "మిల్లులు నేరుగా మీ పొలం వద్దకే వచ్చి ఎక్కువ ధరకు పత్తిని కొనుగోలు చేస్తాయి!"
                ),
                "GENERAL_HELP": "నమస్కారం! నేను మీ పత్తి సహాయకుడిని. యాప్ గురించి ఏమైనా అడగండి.",
            },
            "en-IN": {
                "HOW_TO_USE": (
                    "Welcome farmer brother! Using KapasSetu AI is very simple. "
                    "Place a white reference paper and a 5-rupee coin next to your cotton pile and take a photo, "
                    "or upload an image directly. In under 5 seconds, our AI computes your lab-accurate HVI grade and fair APMC price!"
                ),
                "COST_AND_FREE": (
                    "Farmer friends, KapasSetu AI is 100% free forever for all farmers! "
                    "There are zero hidden charges. Spinning and ginning mills fund our platform because they want direct access "
                    "to clean, contamination-free cotton. Farmers pay nothing."
                ),
                "NEGOTIATION_AND_PRICE": (
                    f"Brother, your cotton is {grade_label} with only {trash_pct} percent trash. "
                    f"Today's fair market value is {price_val} rupees per quintal. "
                    f"Do not sell below {min_negotiation} rupees! If the local trader lowballs you, "
                    f"join the 5km Village Cluster on this app to get direct tractor pickup from verified spinning mills!"
                ),
                "VILLAGE_POOL_INFO": (
                    "The 5km Village Pool gives smallholders collective bargaining power. "
                    "Even if you harvest only 4 quintals, pooling with neighbors aggregates a commercial 30-quintal truckload, "
                    "attracting direct mill procurement bids and saving up to 400 rupees per quintal in middleman deductions!"
                ),
                "GENERAL_HELP": (
                    "Namaste! I am Kapas Sahayak, your AI agricultural voice co-pilot. "
                    "You can ask me how to use the app, verify your crop value, or get negotiation advice."
                ),
            },
        }

        # Select language set (defaulting to Marathi or Hindi if requested language not fully keyed)
        lang_key = "mr-IN" if lang_code.startswith("mr") else (
            "hi-IN" if lang_code.startswith("hi") else (
                "te-IN" if lang_code.startswith("te") else "en-IN"
            )
        )
        reply_text = responses_by_lang.get(lang_key, responses_by_lang["en-IN"]).get(
            intent, responses_by_lang[lang_key]["GENERAL_HELP"]
        )

        # Synthesize speech
        audio_bytes, mime_type, engine = self.synthesize_speech(
            text=reply_text,
            lang_code=lang_code,
            speed="medium",
        )
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

        return {
            "status": "success",
            "query_text": query_text,
            "intent": intent,
            "reply_text": reply_text,
            "language": lang_code,
            "audio_base64": audio_b64,
            "audio_mime": mime_type,
            "engine": engine,
        }

    def generate_grading_narration(
        self,
        assay: dict[str, Any],
        lang_code: str = "mr-IN",
    ) -> dict[str, Any]:
        """Generate automatic voice narration played as soon as cotton assay completes."""
        color_grade = assay.get("color_grade", "Grade A")
        trash_pct = assay.get("trash_percent", 2.2)
        price_val = int(assay.get("final_fair_price_per_qtl", 7868.0))
        min_price = price_val - 150

        if lang_code.startswith("mr"):
            script = (
                f"राम राम भाऊ! तुमच्या कापसाचा ग्रेड {color_grade} असून कचरा फक्त {trash_pct} टक्के आहे. "
                f"आजचा वाजवी बाजारभाव {price_val} रुपये प्रति क्विंटल आहे. "
                f"{min_price} रुपयांपेक्षा कमी भावात माल विकू नका! दलालाला कमी भाव देऊ नका!"
            )
        elif lang_code.startswith("hi"):
            script = (
                f"राम राम भाई! आपकी कपास का ग्रेड {color_grade} है और कचरा सिर्फ {trash_pct} प्रतिशत है। "
                f"आज का उचित मंडी भाव {price_val} रुपये प्रति क्विंटल है। "
                f"{min_price} रुपये से कम में माल मत बेचिए! दलाल को कम भाव न दें!"
            )
        elif lang_code.startswith("te"):
            script = (
                f"నమస్కారం సోదరా! మీ పత్తి గ్రేడ్ {color_grade}, వ్యర్థాలు {trash_pct} శాతం మాత్రమే ఉన్నాయి. "
                f"ఈరోజు సరసమైన ధర క్వింటాల్‌కు {price_val} రూపాయలు. "
                f"{min_price} రూపాయల కంటే తక్కువకు అమ్మవద్దు!"
            )
        else:
            script = (
                f"Farmer brother! Your cotton is {color_grade} with only {trash_pct} percent trash. "
                f"Today's fair market price is {price_val} rupees per quintal. "
                f"Do not sell below {min_price} rupees!"
            )

        audio_bytes, mime, engine = self.synthesize_speech(script, lang_code=lang_code)
        return {
            "narration_text": script,
            "language": lang_code,
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "audio_mime": mime,
            "engine": engine,
        }


# Singleton export
voice_service = GnaniVoiceService()
