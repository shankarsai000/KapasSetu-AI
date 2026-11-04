import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  Play,
  Square,
  HelpCircle,
  Radio,
  Send,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Headphones,
} from 'lucide-react';
import {
  askVoiceCopilot,
  fetchOnboardingAudio,
  narrateGradingResult,
} from '../services/api';

const VOICE_LANGUAGES = [
  { code: 'mr-IN', label: 'मराठी', short: 'मरा' },
  { code: 'hi-IN', label: 'हिन्दी', short: 'हिन्' },
  { code: 'te-IN', label: 'తెలుగు', short: 'తెలు' },
  { code: 'gu-IN', label: 'ગુજરાતી', short: 'ગુજ' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', short: 'ಕನ್ನ' },
  { code: 'en-IN', label: 'English', short: 'ENG' },
];

const QUICK_QUESTIONS = {
  'mr-IN': [
    { label: 'हे ॲप मोफत आहे का?', q: 'हे ॲप मोफत आहे का?' },
    { label: 'व्यापारी कमी भाव देतोय?', q: 'व्यापारी कमी भाव देतोय काय करू?' },
    { label: 'फोटो कसा काढायचा?', q: 'कापसाचा फोटो कसा काढायचा?' },
    { label: 'गाव समूह काय आहे?', q: 'गाव समूह म्हणजे काय?' },
    { label: 'पैसे कसे मिळतील?', q: 'पैसे थेट खात्यात जमा होणार का?' },
  ],
  'hi-IN': [
    { label: 'क्या ऐप फ्री है?', q: 'क्या यह ऐप पूरी तरह फ्री है?' },
    { label: 'व्यापारी कम भाव दे तो?', q: 'व्यापारी कम भाव दे रहा है क्या करूँ?' },
    { label: 'फोटो कैसे लें?', q: 'कपास का फोटो कैसे लें?' },
    { label: 'गांव समूह क्या है?', q: 'गांव समूह क्या है?' },
    { label: 'भुगतान कैसे होगा?', q: 'भुगतान सीधे बैंक खाते में मिलेगा?' },
  ],
  'te-IN': [
    { label: 'యాప్ ఉచితమేనా?', q: 'ఈ యాప్ పూర్తిగా ఉచితమేనా?' },
    { label: 'వ్యాపారి తక్కువ ధర ఇస్తే?', q: 'వ్యాపారి తక్కువ ధర ఇస్తే ఏమి చేయాలి?' },
    { label: 'ఫోటో ఎలా తీయాలి?', q: 'ఫోటో ఎలా తీయాలి?' },
    { label: 'గ్రామ సమూహం ఏమిటి?', q: 'గ్రామ సమూహం అంటే ఏమిటి?' },
  ],
  'gu-IN': [
    { label: 'શું એપ મફત છે?', q: 'શું આ એપ ખેડૂતો માટે મફત છે?' },
    { label: 'વેપારી ઓછો ભાવ આપે તો?', q: 'વેપારી ઓછો ભાવ આપે તો શું કરવું?' },
    { label: 'ફોટો કેવી રીતે લેવો?', q: 'કપાસનો ફોટો કેવી રીતે લેવો?' },
  ],
  'kn-IN': [
    { label: 'ಆ್ಯಪ್ ಉಚಿತವೇ?', q: 'ಈ ಆ್ಯಪ್ ಸಂಪೂರ್ಣ ಉಚಿತವೇ?' },
    { label: 'ವ್ಯಾಪಾರಿ ಕಡಿಮೆ ಬೆಲೆ ಕೊಟ್ಟರೆ?', q: 'ವ್ಯಾಪಾರಿ ಕಡಿಮೆ ಬೆಲೆ ಕೊಟ್ಟರೆ ಏನು ಮಾಡಬೇಕು?' },
    { label: 'ಫೋಟೋ ತೆಗೆಯುವುದು ಹೇಗೆ?', q: 'ಹತ್ತಿಯ ಫೋಟೋ ತೆಗೆಯುವುದು ಹೇಗೆ?' },
  ],
  'en-IN': [
    { label: 'Is this app free?', q: 'Is this app free for farmers?' },
    { label: 'Trader offering low price?', q: 'Trader is offering low price, what to do?' },
    { label: 'How to take photo?', q: 'How to take cotton photo?' },
    { label: 'What is village pool?', q: 'What is village pool?' },
    { label: 'How is payment made?', q: 'Is payment transferred directly to bank?' },
  ],
};

export default function VoiceSahayak({
  lang = 'mr',
  onLanguageChange,
  assay = null,
  activeView = 'capture',
}) {
  const currentLangCode =
    VOICE_LANGUAGES.find((l) => l.code.startsWith(lang))?.code || 'mr-IN';

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState('');
  const [dialogHistory, setDialogHistory] = useState([]);
  const [engineBadge, setEngineBadge] = useState('कापूस सहाय्यक व्हॉइस');
  const [textInput, setTextInput] = useState('');
  const [activeFollowups, setActiveFollowups] = useState([]);

  const audioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Mutable refs to prevent stale closure bugs in async events
  const isHandsFreeRef = useRef(isHandsFree);
  const isPlayingRef = useRef(isPlaying);
  const isRecordingRef = useRef(isRecording);
  const dialogHistoryRef = useRef(dialogHistory);

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
  }, [isHandsFree]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    dialogHistoryRef.current = dialogHistory;
  }, [dialogHistory]);

  // Preload system voices for speech synthesis fallback
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      stopAudio();
    };
  }, []);

  // Stop any active audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  // Browser Text-To-Speech (Native Offline Fallback)
  const speakWithBrowserTTS = useCallback(
    (text, langCode, onEndedCallback = null) => {
      if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
        setIsPlaying(false);
        if (onEndedCallback) onEndedCallback();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const targetPrefix = (langCode || 'mr-IN').split('-')[0].toLowerCase();

        // Find best regional voice
        const bestVoice =
          voices.find((v) => v.lang.toLowerCase() === (langCode || '').toLowerCase()) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix)) ||
          (targetPrefix === 'mr'
            ? voices.find((v) => v.lang.toLowerCase().startsWith('hi'))
            : null) ||
          voices.find((v) => v.lang.toLowerCase().includes('in')) ||
          voices[0];

        if (bestVoice) {
          utterance.voice = bestVoice;
          utterance.lang = bestVoice.lang;
        } else {
          utterance.lang = langCode || 'mr-IN';
        }

        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          setIsPlaying(true);
          setEngineBadge('Regional Speech Engine');
        };
        utterance.onend = () => {
          setIsPlaying(false);
          if (onEndedCallback) onEndedCallback();
        };
        utterance.onerror = () => {
          setIsPlaying(false);
          if (onEndedCallback) onEndedCallback();
        };

        setIsPlaying(true);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsPlaying(false);
        if (onEndedCallback) onEndedCallback();
      }
    },
    []
  );

  // Play audio helper with completion callback for hands-free loop
  const playAudio = useCallback(
    async (
      audioBase64,
      mimeType = 'audio/mpeg',
      text = '',
      engine = '',
      onEndedCallback = null
    ) => {
      stopAudio();

      if (audioBase64 && audioBase64.length > 200) {
        try {
          const audioSrc = `data:${mimeType || 'audio/mpeg'};base64,${audioBase64}`;
          audioRef.current.src = audioSrc;
          audioRef.current.onended = () => {
            setIsPlaying(false);
            if (onEndedCallback) onEndedCallback();
          };
          audioRef.current.onerror = () => {
            speakWithBrowserTTS(text, currentLangCode, onEndedCallback);
          };
          await audioRef.current.play();
          setIsPlaying(true);
          setEngineBadge(
            engine === 'gnani_timbre_v3.0'
              ? 'Gnani Timbre v3.0 (HD)'
              : 'Neural Voice AI (HD)'
          );
          return;
        } catch {
          // If browser blocked autoplay, fall back
        }
      }

      speakWithBrowserTTS(text, currentLangCode, onEndedCallback);
    },
    [currentLangCode, speakWithBrowserTTS, stopAudio]
  );

  // Continuous Conversation Trigger
  const handleAssistantFinished = useCallback(
    (isConversationEnd = false) => {
      if (isHandsFreeRef.current && !isConversationEnd) {
        // Short pause between speaking and listening
        setTimeout(() => {
          if (
            isHandsFreeRef.current &&
            !isPlayingRef.current &&
            !isRecordingRef.current
          ) {
            startListening();
          }
        }, 500);
      }
    },
    []
  );

  // Ask Voice Question Core Handler
  const handleAskQuestion = async (queryText, audioBlob = null) => {
    setIsLoading(true);
    setDrawerOpen(true);
    try {
      const historyPayload = dialogHistoryRef.current.map((item) => ({
        role: item.role || 'user',
        content: item.query || item.reply,
        intent: item.intent,
      }));

      const res = await askVoiceCopilot({
        audioBlob,
        queryText: queryText || 'कापूस सेतू ॲप कसे वापरायचे?',
        language: currentLangCode,
        gradeContext: assay,
        conversationHistory: historyPayload,
      });

      const newEntry = {
        id: Date.now(),
        query: res.query_text || queryText,
        reply: res.reply_text,
        audioBase64: res.audio_base64,
        audioMime: res.audio_mime,
        engine: res.engine,
        intent: res.intent,
        isEnd: res.is_conversation_end,
        suggestedFollowups: res.suggested_followups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setDialogHistory((prev) => [newEntry, ...prev.slice(0, 6)]);
      setActiveSpeechText(res.reply_text);
      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setActiveFollowups(res.suggested_followups);
      }

      await playAudio(
        res.audio_base64,
        res.audio_mime,
        res.reply_text,
        res.engine,
        () => handleAssistantFinished(res.is_conversation_end)
      );
    } catch {
      const errReply = currentLangCode.startsWith('mr')
        ? 'कापूस सेतू ॲप शेतकऱ्यांसाठी १०० टक्के मोफत आहे. कापसाचा ढीग आणि ५ रुपयांचे नाणे ठेवून अचूक हमीभाव तपासा.'
        : currentLangCode.startsWith('hi')
        ? 'कपास सेतू ऐप किसानों के लिए १०० प्रतिशत बिल्कुल मुफ्त है। पांच रुपये का सिक्का रखकर अपनी फसल का सही भाव जांचें।'
        : 'KapasSetu AI is 100% free forever for all farmers!';
      setActiveSpeechText(errReply);
      speakWithBrowserTTS(errReply, currentLangCode, () => handleAssistantFinished(false));
    } finally {
      setIsLoading(false);
    }
  };

  // Start Speech Recognition
  const startListening = () => {
    if (isRecordingRef.current) return;

    // Web Speech API recognition (zero latency)
    const SpeechRecClass =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecClass) {
      try {
        const recognition = new SpeechRecClass();
        recognitionRef.current = recognition;
        recognition.lang = currentLangCode;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsRecording(true);
        };
        recognition.onresult = (event) => {
          const spoken = event.results[0]?.[0]?.transcript;
          setIsRecording(false);
          if (spoken && spoken.trim()) {
            handleAskQuestion(spoken.trim());
          }
        };
        recognition.onerror = () => {
          setIsRecording(false);
          startMediaRecorder();
        };
        recognition.onend = () => {
          setIsRecording(false);
        };
        recognition.start();
        return;
      } catch {
        // Fallback to MediaRecorder below
      }
    }

    startMediaRecorder();
  };

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((track) => track.stop());
        await handleAskQuestion(null, audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      handleAskQuestion('कापूस सेतू ॲप कसे वापरायचे?');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      stopAudio();
      startListening();
    }
  };

  // 1. One-Click "Guide Me" Audio
  const handlePlayGuideMe = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchOnboardingAudio(currentLangCode);
      setActiveSpeechText(data.guide_text);
      await playAudio(
        data.audio_base64,
        data.audio_mime,
        data.guide_text,
        data.engine,
        () => handleAssistantFinished(false)
      );
    } catch {
      const fallbackMsg = currentLangCode.startsWith('mr')
        ? 'राम राम शेतकरी मित्रांनो! कापसाच्या ढिगाऱ्याशेजारी पांढरा कागद आणि पाच रुपयांचे नाणे ठेवून फोटो काढा. पाच सेकंदात हमीभाव मिळवा.'
        : currentLangCode.startsWith('hi')
        ? 'राम राम किसान भाई! कपास के पास सफेद कागज और पांच रुपये का सिक्का रखकर फोटो लें। सिर्फ ५ सेकंड में सही ग्रेड और मंडी भाव पाएं।'
        : 'Welcome farmer brother! Place a white paper and 5-rupee coin next to your cotton pile to get your fair MSP price in 5 seconds.';
      setActiveSpeechText(fallbackMsg);
      speakWithBrowserTTS(fallbackMsg, currentLangCode, () => handleAssistantFinished(false));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Auto-Narrate Cotton Grade Result
  const handleNarrateAssay = useCallback(async () => {
    if (!assay) return;
    if (isPlaying) {
      stopAudio();
      return;
    }
    setIsLoading(true);
    try {
      const data = await narrateGradingResult(assay, currentLangCode);
      setActiveSpeechText(data.narration_text);
      await playAudio(
        data.audio_base64,
        data.audio_mime,
        data.narration_text,
        data.engine,
        () => handleAssistantFinished(false)
      );
    } catch {
      const fallbackScript = `Farmer brother! Your cotton is ${assay.color_grade} with only ${assay.trash_percent} percent trash. Today's fair market price is ${Math.round(assay.final_fair_price_per_qtl)} rupees per quintal. Do not sell below ${Math.round(assay.final_fair_price_per_qtl) - 150} rupees!`;
      setActiveSpeechText(fallbackScript);
      speakWithBrowserTTS(fallbackScript, currentLangCode, () => handleAssistantFinished(false));
    } finally {
      setIsLoading(false);
    }
  }, [assay, currentLangCode, handleAssistantFinished, isPlaying, playAudio, speakWithBrowserTTS, stopAudio]);

  // Auto-trigger narration when entering certificate view
  useEffect(() => {
    if (activeView === 'certificate' && assay) {
      const timer = setTimeout(() => {
        handleNarrateAssay();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [activeView, assay, handleNarrateAssay]);

  const questionsList =
    QUICK_QUESTIONS[currentLangCode] || QUICK_QUESTIONS['mr-IN'] || [];

  return (
    <div className="space-y-3">
      {/* 1. Multilingual Audio Bar & Language Switcher */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-2xl p-3 shadow-md border-2 border-emerald-600/40">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Audio Brand & Live Engine Indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400"></span>
                </span>
              )}
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-black tracking-wide text-amber-300">
                  कापूस सहाय्यक (Kapas Sahayak)
                </span>
                <span className="text-[9px] font-extrabold bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-600">
                  {isPlaying ? 'Speaking...' : isRecording ? 'Listening...' : 'Voice Co-Pilot'}
                </span>
              </div>
              <p className="text-[10px] text-emerald-300 font-medium">
                {currentLangCode.startsWith('mr')
                  ? 'मराठी व्हॉइस को-पायलट • शुद्ध आवाजात ऐका व सतत बोला'
                  : currentLangCode.startsWith('hi')
                  ? 'हिन्दी वॉइस को-पायलट • स्पष्ट आवाज़ में सुनें व लगातार बात करें'
                  : 'Multilingual Voice Co-Pilot • Crystal Clear Voice & Hands-Free Conversation'}
              </p>
            </div>
          </div>

          {/* 6-Language Quick Toggle Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {VOICE_LANGUAGES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  stopAudio();
                  if (onLanguageChange) {
                    onLanguageChange(item.code.split('-')[0]);
                  }
                }}
                className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-black transition ${
                  currentLangCode === item.code
                    ? 'bg-amber-400 text-emerald-950 shadow-sm font-black'
                    : 'bg-emerald-900/80 text-emerald-100 hover:bg-emerald-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Row: Guide Me button + Push-To-Talk Mic + Hands-Free Toggle */}
        <div className="mt-2.5 pt-2 border-t border-emerald-800/80 flex flex-wrap items-center justify-between gap-2">
          {/* Left Controls: Guide Me & Hands-Free Mode Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Guide Me Button */}
            <button
              type="button"
              onClick={handlePlayGuideMe}
              disabled={isLoading}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm ${
                isPlaying
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-amber-400 hover:bg-amber-300 text-emerald-950'
              }`}
            >
              {isPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>आवाज थांबवा</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {currentLangCode.startsWith('mr')
                      ? 'आवाजात ऐका (Guide Me)'
                      : currentLangCode.startsWith('hi')
                      ? 'आवाज़ में समझें (Guide Me)'
                      : 'Guide Me'}
                  </span>
                </>
              )}
            </button>

            {/* Hands-Free Continuous Voice Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextVal = !isHandsFree;
                setIsHandsFree(nextVal);
                if (nextVal && !isPlaying && !isRecording) {
                  startListening();
                }
              }}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition border ${
                isHandsFree
                  ? 'bg-emerald-500 text-emerald-950 border-emerald-300 shadow-md ring-2 ring-emerald-400/50 font-black'
                  : 'bg-emerald-900/90 text-emerald-200 border-emerald-700 hover:bg-emerald-800'
              }`}
              title="Hands-free continuous conversation mode: Assistant auto-listens after speaking"
            >
              <Headphones className={`w-3.5 h-3.5 ${isHandsFree ? 'animate-bounce' : ''}`} />
              <span>
                {isHandsFree
                  ? currentLangCode.startsWith('mr')
                    ? 'हात मोकळे मोड चालू ✓'
                    : 'Hands-Free ON ✓'
                  : currentLangCode.startsWith('mr')
                  ? 'हात मोकळे संवाद (Hands-Free)'
                  : 'Hands-Free Mode'}
              </span>
            </button>
          </div>

          {/* Right Controls: Push-To-Talk Mic & Dialog Drawer Toggle */}
          <div className="flex items-center gap-2">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse border-2 border-white'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-amber-200 border border-emerald-600'
              }`}
            >
              <Mic className={`w-4 h-4 ${isRecording ? 'animate-bounce' : ''}`} />
              <span>
                {isRecording
                  ? 'ऐकत आहे... बोला (Listening...)'
                  : currentLangCode.startsWith('mr')
                  ? 'माईक चालू करा'
                  : currentLangCode.startsWith('hi')
                  ? 'माइक चालू करें'
                  : 'Tap to Speak'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 text-xs font-extrabold border border-emerald-700 flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {drawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Live Audio Equalizer & Speaking Indicator */}
        {(isPlaying || isRecording) && (
          <div className="mt-2 pt-2 border-t border-emerald-800/60 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              {isPlaying && (
                <div className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-amber-400 rounded-full animate-bounce"></span>
                  <span className="w-1 h-5 bg-amber-300 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                  <span className="w-1 h-4 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                  <span className="w-1 h-2 bg-amber-200 rounded-full animate-bounce [animation-delay:0.45s]"></span>
                  <span className="text-[11px] font-bold text-amber-200 ml-1">
                    {currentLangCode.startsWith('mr')
                      ? 'सहाय्यक उत्तर वाचत आहे...'
                      : currentLangCode.startsWith('hi')
                      ? 'सहायक उत्तर बोल रहा है...'
                      : 'Assistant speaking aloud...'}
                  </span>
                </div>
              )}
              {isRecording && (
                <div className="flex items-center gap-1 text-rose-300">
                  <span className="w-1 h-3 bg-rose-400 rounded-full animate-pulse"></span>
                  <span className="w-1 h-5 bg-rose-500 rounded-full animate-pulse [animation-delay:0.15s]"></span>
                  <span className="w-1 h-4 bg-rose-400 rounded-full animate-pulse [animation-delay:0.3s]"></span>
                  <span className="text-[11px] font-bold text-white ml-1">
                    {currentLangCode.startsWith('mr')
                      ? 'माईक चालू आहे, स्पष्ट बोला...'
                      : currentLangCode.startsWith('hi')
                      ? 'माइक खुला है, बोलिए...'
                      : 'Listening to your question...'}
                  </span>
                </div>
              )}
            </div>
            {isHandsFree && (
              <span className="text-[10px] font-black bg-emerald-800/90 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600">
                सतत संवाद मोड (Auto-Listening)
              </span>
            )}
          </div>
        )}

        {/* Quick Question Chips */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-black text-emerald-300 uppercase shrink-0">
            {currentLangCode.startsWith('mr')
              ? 'प्रश्न निवडा:'
              : 'Quick Prompts:'}
          </span>
          {questionsList.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAskQuestion(item.q)}
              className="text-[10px] font-extrabold bg-emerald-950/90 text-amber-200 hover:bg-amber-400 hover:text-emerald-950 px-2.5 py-1 rounded-full whitespace-nowrap border border-emerald-700 transition"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Interactive Dialog & Audio Player Drawer */}
      {(drawerOpen || dialogHistory.length > 0 || isPlaying || isHandsFree) && (
        <div className="bg-white rounded-2xl border-2 border-emerald-700/20 shadow-sm p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-700 animate-pulse" />
              <span className="text-xs font-black text-slate-900">
                कापूस सहाय्यक थेट संवाद (Live Voice Conversation)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                {engineBadge}
              </span>
              {isPlaying && (
                <button
                  type="button"
                  onClick={stopAudio}
                  className="text-xs text-rose-600 font-extrabold hover:underline flex items-center gap-1"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  थांबवा
                </button>
              )}
            </div>
          </div>

          {/* Currently Spoken / Latest Answer Box */}
          {activeSpeechText && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3.5 border-2 border-emerald-200 text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 font-black text-xs shadow-sm">
                  AI
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{activeSpeechText}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
                    {isPlaying ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-black">
                        <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                        <span>आवाज सुरू आहे (Speaking HD)...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          playAudio(
                            dialogHistory[0]?.audioBase64,
                            dialogHistory[0]?.audioMime,
                            activeSpeechText,
                            dialogHistory[0]?.engine
                          )
                        }
                        className="text-[11px] text-emerald-800 font-extrabold hover:underline flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        पुन्हा ऐका (Replay Voice)
                      </button>
                    )}

                    {isHandsFree && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        उत्तर संपताच माईक पुन्हा सुरू होईल
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Follow-Up Suggestions (One-Click Dialogue Chips) */}
          {activeFollowups.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                {currentLangCode.startsWith('mr')
                  ? 'पुढील प्रश्न विचारा (Follow-Up):'
                  : 'Suggested Follow-Up Questions:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeFollowups.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskQuestion(q)}
                    className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-emerald-950 px-3 py-1.5 rounded-xl border border-amber-300 transition shadow-2xs text-left"
                  >
                    ↳ {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Turn Dialog History (Chat Stream) */}
          {dialogHistory.length > 0 && (
            <div className="space-y-2 pt-2 max-h-60 overflow-y-auto pr-1">
              {dialogHistory.map((item) => (
                <div
                  key={item.id}
                  className="text-xs bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="font-black text-emerald-800">
                      👨‍🌾 शेतकरी ({item.timestamp || 'आत्ता'}):
                    </span>
                    <span className="text-[9px] font-mono bg-stone-200 px-1.5 py-0.2 rounded">
                      {item.intent || 'Q&A'}
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800 pl-2 border-l-2 border-emerald-500">
                    {item.query}
                  </p>

                  <div className="text-[11px] text-slate-700 leading-relaxed pl-2 pt-1">
                    <span className="font-extrabold text-amber-800">🤖 सहाय्यक: </span>
                    {item.reply}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        playAudio(item.audioBase64, item.audioMime, item.reply, item.engine)
                      }
                      className="text-[10px] text-emerald-700 font-black hover:underline flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      पुन्हा ऐका (Replay)
                    </button>
                    {item.engine && (
                      <span className="text-[9px] text-stone-400">
                        {item.engine}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Query Input (When mic is inconvenient) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                handleAskQuestion(textInput.trim());
                setTextInput('');
              }
            }}
            className="pt-2 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                currentLangCode.startsWith('mr')
                  ? 'येथे प्रश्न टाइप करा किंवा बोला...'
                  : currentLangCode.startsWith('hi')
                  ? 'यहाँ सवाल टाइप करें या बोलें...'
                  : 'Type your question or use microphone...'
              }
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1 transition"
            >
              <Send className="w-3 h-3" />
              <span>विचारा</span>
            </button>
          </form>
        </div>
      )}

      {/* 3. Automatic Spoken Result Narration Card (When assay is on screen) */}
      {assay && (
        <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Sparkles className="w-4 h-4 text-emerald-950" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-tight">
                {currentLangCode.startsWith('mr')
                  ? 'कापूस ग्रेड व हमीभाव आवाज सारांश'
                  : currentLangCode.startsWith('hi')
                  ? 'कपास ग्रेड व मंडी भाव आवाज़ सारांश'
                  : 'Spoken Grade & APMC Mandi Summary'}
              </p>
              <p className="text-[11px] text-amber-900 font-bold">
                {assay.color_grade} • कचरा {assay.trash_percent}% • ₹
                {Math.round(assay.final_fair_price_per_qtl)}/qtl
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNarrateAssay}
            className="min-h-[36px] px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>थांबवा (Stop)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>आवाजात ऐका (Speak Result)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
