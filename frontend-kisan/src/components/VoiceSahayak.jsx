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
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Camera,
  Layers,
  Award,
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
    { label: 'व्यापारी कमी भाव देतोय काय करू?', q: 'व्यापारी कमी भाव देतोय काय करू?' },
    { label: 'कापसाचा फोटो कसा काढायचा?', q: 'कापसाचा फोटो कसा काढायचा?' },
    { label: 'गाव समूह म्हणजे काय?', q: 'गाव समूह म्हणजे काय?' },
    { label: 'पैसे थेट खात्यात जमा होणार का?', q: 'पैसे थेट खात्यात जमा होणार का?' },
    { label: 'बोंड अळीसाठी काय फवारावे?', q: 'गुलाबी बोंड अळीसाठी काय फवारावे?' },
    { label: 'हिंदी में बोलो', q: 'हिंदी में बोलो' },
  ],
  'hi-IN': [
    { label: 'क्या यह ऐप फ्री है?', q: 'क्या यह ऐप पूरी तरह फ्री है?' },
    { label: 'व्यापारी कम भाव दे तो क्या करें?', q: 'व्यापारी कम भाव दे रहा है क्या करूँ?' },
    { label: 'कपास का फोटो कैसे लें?', q: 'कपास का फोटो कैसे लें?' },
    { label: 'गांव समूह क्या है?', q: 'गांव समूह क्या है?' },
    { label: 'भुगतान सीधे बैंक में मिलेगा?', q: 'भुगतान सीधे बैंक खाते में मिलेगा?' },
    { label: 'गुलाबी सुंडी का इलाज?', q: 'गुलाबी सुंडी के लिए क्या स्प्रे करें?' },
    { label: 'मराठीत बोला', q: 'मराठीत बोला' },
  ],
  'te-IN': [
    { label: 'ఈ యాప్ పూర్తిగా ఉచితమేనా?', q: 'ఈ యాప్ పూర్తిగా ఉచితమేనా?' },
    { label: 'వ్యాపారి తక్కువ ధర ఇస్తే ఏం చేయాలి?', q: 'వ్యాపారి తక్కువ ధర ఇస్తే ఏమి చేయాలి?' },
    { label: 'ఫోటో ఎలా తీయాలి?', q: 'ఫోటో ఎలా తీయాలి?' },
    { label: 'గ్రామ సమూహం అంటే ఏమిటి?', q: 'గ్రామ సమూహం అంటే ఏమిటి?' },
    { label: 'డబ్బులు నేరుగా బ్యాంకులో పడతాయా?', q: 'డబ్బులు నేరుగా బ్యాంకులో పడతాయా?' },
    { label: 'పురుగుల నివారణ ఎలా?', q: 'గులాబీ పురుగుల నివారణకు ఏ మందు పిచికారీ చేయాలి?' },
    { label: 'Speak in English', q: 'Speak in English' },
  ],
  'gu-IN': [
    { label: 'શું આ એપ મફત છે?', q: 'શું આ એપ ખેડૂતો માટે મફત છે?' },
    { label: 'વેપારી ઓછો ભાવ આપે તો શું કરવું?', q: 'વેપારી ઓછો ભાવ આપે તો શું કરવું?' },
    { label: 'કપાસનો ફોટો કેવી રીતે લેવો?', q: 'કપાસનો ફોટો કેવી રીતે લેવો?' },
    { label: 'ગામ સમૂહ શું છે?', q: 'ગામ સમૂહ શું છે?' },
    { label: 'પૈસા સીધા બેંકમાં મળશે?', q: 'પૈસા સીધા બેંક ખાતામાં મળશે?' },
    { label: 'ઈયળ માટે શું કરવું?', q: 'ગુલાબી ઈયળ માટે કયો છંટકાવ કરવો?' },
  ],
  'kn-IN': [
    { label: 'ಈ ಆ್ಯಪ್ ಸಂಪೂರ್ಣ ಉಚಿತವೇ?', q: 'ಈ ಆ್ಯಪ್ ಸಂಪೂರ್ಣ ಉಚಿತವೇ?' },
    { label: 'ವ್ಯಾಪಾರಿ ಕಡಿಮೆ ಬೆಲೆ ಕೊಟ್ಟರೆ?', q: 'ವ್ಯಾಪಾರಿ ಕಡಿಮೆ ಬೆಲೆ ಕೊಟ್ಟರೆ ಏನು ಮಾಡಬೇಕು?' },
    { label: 'ಹತ್ತಿಯ ಫೋಟೋ ತೆಗೆಯುವುದು ಹೇಗೆ?', q: 'ಹತ್ತಿಯ ಫೋಟೋ ತೆಗೆಯುವುದು ಹೇಗೆ?' },
    { label: 'ಗ್ರಾಮ ಸಮೂಹ ಎಂದರೇನು?', q: 'ಗ್ರಾಮ ಸಮೂಹ ಎಂದರೇನು?' },
    { label: 'ಹಣ ನೇರವಾಗಿ ಬ್ಯಾಂಕ್‌ಗೆ ಬರುತ್ತದೆಯೇ?', q: 'ಹಣ ನೇರವಾಗಿ ಬ್ಯಾಂಕ್‌ಗೆ ಬರುತ್ತದೆಯೇ?' },
    { label: 'ಹುಳು ನಿಯಂತ್ರಣ ಹೇಗೆ?', q: 'ಗುಲಾಬಿ ಹುಳು ನಿಯಂತ್ರಣಕ್ಕೆ ಏನು ಮಾಡಬೇಕು?' },
  ],
  'en-IN': [
    { label: 'Is this app free?', q: 'Is this app free for farmers?' },
    { label: 'Trader offering low price?', q: 'Trader is offering low price, what to do?' },
    { label: 'How to take photo?', q: 'How to take cotton photo?' },
    { label: 'What is village pool?', q: 'What is village pool?' },
    { label: 'How is payment made?', q: 'Is payment transferred directly to bank?' },
    { label: 'Pink bollworm control?', q: 'How to control pink bollworm and pests?' },
    { label: 'हिंदी में बोलो', q: 'हिंदी में बात करो' },
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
  const [activeAudioSource, setActiveAudioSource] = useState(null); // 'guide' | 'assay' | 'qa' | null
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState(null); // 'single' | 'handsfree' | null
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [isGuideModeActive, setIsGuideModeActive] = useState(false);
  const [dialogHistory, setDialogHistory] = useState([]);
  const [engineBadge, setEngineBadge] = useState('कापूस सहाय्यक व्हॉइस (HD)');
  const [textInput, setTextInput] = useState('');
  const [activeFollowups, setActiveFollowups] = useState([]);

  const audioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const narratedAssayIdRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const silenceCountRef = useRef(0);

  // Mutable refs to prevent stale closure bugs in async events
  const isHandsFreeRef = useRef(isHandsFree);
  const isPlayingRef = useRef(isPlaying);
  const isRecordingRef = useRef(isRecording);
  const recordingModeRef = useRef(recordingMode);
  const dialogHistoryRef = useRef(dialogHistory);
  const currentLangCodeRef = useRef(currentLangCode);

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
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);

  useEffect(() => {
    dialogHistoryRef.current = dialogHistory;
  }, [dialogHistory]);

  useEffect(() => {
    currentLangCodeRef.current = currentLangCode;
  }, [currentLangCode]);

  // Clean cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecording();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  const showNotice = (msg) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice('');
    }, 4500);
  };

  // Stop any active audio safely and clear listeners to prevent loops
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setActiveAudioSource(null);
  }, []);

  // Play direct HD MP3 audio generated by Gnani Timbre v3.0 or Neural Voice AI
  // Never falls back to robotic English browser TTS to avoid stutter loops
  const playAudio = useCallback(
    async (
      audioBase64,
      mimeType = 'audio/mpeg',
      text = '',
      engine = '',
      source = 'qa',
      onEndedCallback = null
    ) => {
      stopAudio();

      if (!audioBase64 || audioBase64.length < 100) {
        setIsPlaying(false);
        setActiveAudioSource(null);
        if (onEndedCallback) onEndedCallback();
        return;
      }

      try {
        const audioSrc = `data:${mimeType || 'audio/mpeg'};base64,${audioBase64}`;
        audioRef.current.src = audioSrc;

        audioRef.current.onended = () => {
          setIsPlaying(false);
          setActiveAudioSource(null);
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
          if (onEndedCallback) onEndedCallback();
        };

        audioRef.current.onerror = (e) => {
          console.warn('Audio playback error:', e);
          setIsPlaying(false);
          setActiveAudioSource(null);
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
        };

        await audioRef.current.play();
        setIsPlaying(true);
        setActiveAudioSource(source);
        setAutoplayBlocked(false);
        setEngineBadge(
          engine === 'gnani_timbre_v3.0'
            ? 'Gnani Timbre v3.0 (HD)'
            : 'Neural Voice AI (HD)'
        );
      } catch (err) {
        console.info('Audio autoplay blocked by browser policy, awaiting user tap:', err);
        setIsPlaying(false);
        setActiveAudioSource(null);
        setAutoplayBlocked(true);
      }
    },
    [stopAudio]
  );

  // Core Voice Q&A Handler
  const handleAskQuestion = async (queryText, audioBlob = null, mode = 'single') => {
    if (!queryText && !audioBlob) {
      setIsRecording(false);
      setRecordingMode(null);
      return;
    }

    setIsLoading(true);
    setDrawerOpen(true);
    setStatusNotice('');

    try {
      const historyPayload = dialogHistoryRef.current.map((item) => ({
        role: item.role || 'user',
        content: item.query || item.reply,
        intent: item.intent,
      }));

      const res = await askVoiceCopilot({
        audioBlob,
        queryText: queryText || '',
        language: currentLangCodeRef.current,
        gradeContext: assay,
        conversationHistory: historyPayload,
      });

      // Handle Silence response from backend
      if (res.status === 'no_speech' || res.intent === 'SILENCE') {
        const silenceMsg = currentLangCodeRef.current.startsWith('mr')
          ? 'कोणताही आवाज ऐकू आला नाही. बोलण्यासाठी माईक पुन्हा दाबा.'
          : currentLangCodeRef.current.startsWith('hi')
          ? 'कोई आवाज़ सुनाई नहीं दी। बोलने के लिए माइक दोबारा दबाएं।'
          : currentLangCodeRef.current.startsWith('te')
          ? 'ఎలాంటి శబ్దం వినబడలేదు. మాట్లాడటానికి మైక్ మళ్లీ నొక్కండి.'
          : 'No voice heard. Tap the microphone to speak again.';
        showNotice(silenceMsg);

        if (mode === 'handsfree') {
          silenceCountRef.current += 1;
          if (silenceCountRef.current >= 2) {
            setIsHandsFree(false);
            showNotice(
              currentLangCodeRef.current.startsWith('mr')
                ? 'हात मोकळे संवाद थांबवला आहे. बोलण्यासाठी पुन्हा माईक दाबा.'
                : 'Hands-free mode paused. Tap mic to speak.'
            );
          }
        }
        return;
      }

      // Reset silence count on receiving valid speech
      silenceCountRef.current = 0;

      // Spoken Language Auto-Switch Detection
      if (res.switched_language) {
        const newLangCode = res.switched_language;
        const langPrefix = newLangCode.split('-')[0];
        if (onLanguageChange) {
          onLanguageChange(langPrefix);
        }
      }

      const newEntry = {
        id: Date.now(),
        query: res.query_text || queryText || '🎤 व्हॉइस प्रश्न',
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

      // Route playback depending on mode
      if (mode === 'handsfree' && isHandsFreeRef.current && !res.is_conversation_end) {
        await playAudio(
          res.audio_base64,
          res.audio_mime,
          res.reply_text,
          res.engine,
          'qa',
          () => {
            // Next turn in hands-free mode after 750ms pause
            if (isHandsFreeRef.current) {
              setTimeout(() => {
                if (
                  isHandsFreeRef.current &&
                  !isPlayingRef.current &&
                  !isRecordingRef.current
                ) {
                  startListening('handsfree');
                }
              }, 750);
            }
          }
        );
      } else {
        // Single push-to-talk turn: NEVER re-open mic automatically
        if (res.is_conversation_end) {
          setIsHandsFree(false);
        }
        await playAudio(
          res.audio_base64,
          res.audio_mime,
          res.reply_text,
          res.engine,
          'qa',
          null
        );
      }
    } catch (err) {
      console.warn('Voice query error:', err);
      showNotice('सर्व्हरशी संपर्क होऊ शकला नाही. पुन्हा प्रयत्न करा.');
    } finally {
      setIsLoading(false);
      setIsRecording(false);
      setRecordingMode(null);
    }
  };

  // Start Speech Recognition (mode: 'single' | 'handsfree')
  const startListening = (mode = 'single') => {
    if (isRecordingRef.current) return;
    stopAudio();

    setRecordingMode(mode);
    setIsRecording(true);
    setStatusNotice('');

    // Safety silence timeout (7 seconds)
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    silenceTimeoutRef.current = setTimeout(() => {
      if (isRecordingRef.current) {
        stopRecording();
        if (mode === 'handsfree') {
          silenceCountRef.current += 1;
          if (silenceCountRef.current >= 2) {
            setIsHandsFree(false);
            showNotice(
              currentLangCodeRef.current.startsWith('mr')
                ? 'हात मोकळे संवाद थांबवला आहे. बोलण्यासाठी पुन्हा माईक दाबा.'
                : 'Hands-free mode paused due to silence.'
            );
          } else {
            // Give one more chance in hands-free mode
            setTimeout(() => {
              if (isHandsFreeRef.current && !isPlayingRef.current && !isRecordingRef.current) {
                startListening('handsfree');
              }
            }, 600);
          }
        } else {
          showNotice(
            currentLangCodeRef.current.startsWith('mr')
              ? 'कोणताही आवाज आला नाही. बोलण्यासाठी पुन्हा माईक दाबा.'
              : currentLangCodeRef.current.startsWith('hi')
              ? 'कोई आवाज़ नहीं आई। बोलने के लिए दोबारा माइक दबाएं।'
              : 'No speech detected. Tap mic to speak again.'
          );
        }
      }
    }, 7000);

    const SpeechRecClass =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecClass) {
      try {
        const recognition = new SpeechRecClass();
        recognitionRef.current = recognition;
        recognition.lang = currentLangCodeRef.current;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsRecording(true);
        };

        recognition.onresult = (event) => {
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          const spoken = event.results[0]?.[0]?.transcript?.trim();
          setIsRecording(false);
          setRecordingMode(null);

          if (spoken && spoken.length > 0) {
            handleAskQuestion(spoken, null, mode);
          } else {
            showNotice(
              currentLangCodeRef.current.startsWith('mr')
                ? 'कोणताही आवाज ऐकू आला नाही. बोलण्यासाठी पुन्हा माईक दाबा.'
                : 'No speech heard. Tap mic to speak.'
            );
          }
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e.error);
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          if (e.error === 'not-allowed') {
            setIsRecording(false);
            setRecordingMode(null);
            showNotice('कृपया ब्राउझरमध्ये माईक परवानगी द्या.');
          } else if (e.error === 'no-speech') {
            setIsRecording(false);
            setRecordingMode(null);
            showNotice('कोणताही आवाज आला नाही. बोलण्यासाठी पुन्हा माईक दाबा.');
          } else {
            // Fallback to MediaRecorder
            startMediaRecorder(mode);
          }
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

    startMediaRecorder(mode);
  };

  const startMediaRecorder = async (mode = 'single') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size < 600) {
          setIsRecording(false);
          setRecordingMode(null);
          showNotice(
            currentLangCodeRef.current.startsWith('mr')
              ? 'कोणताही आवाज ऐकू आला नाही. बोलण्यासाठी पुन्हा माईक दाबा.'
              : 'No audio captured. Tap mic to speak.'
          );
          return;
        }

        await handleAskQuestion(null, audioBlob, mode);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn('MediaRecorder error:', err);
      setIsRecording(false);
      setRecordingMode(null);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      showNotice('माईक सुरू करता आला नाही. कृपया ब्राउझरमध्ये माईक परवानगी द्या.');
    }
  };

  const stopRecording = () => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
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
    setRecordingMode(null);
  };

  // Toggle for Single-Turn "Tap to Speak"
  const toggleSingleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      stopAudio();
      startListening('single');
    }
  };

  // Toggle for Continuous "Hands-Free Mode"
  const toggleHandsFreeMode = () => {
    if (isHandsFree) {
      setIsHandsFree(false);
      stopRecording();
      stopAudio();
      showNotice(
        currentLangCode.startsWith('mr')
          ? 'हात मोकळे संवाद बंद केला.'
          : 'Hands-Free mode turned off.'
      );
    } else {
      stopAudio();
      stopRecording();
      setIsHandsFree(true);
      silenceCountRef.current = 0;
      setDrawerOpen(true);

      const introMsg = currentLangCode.startsWith('mr')
        ? 'हात मोकळे संवाद चालू झाला आहे दादा. तुम्ही प्रश्न विचारा, मी ऐकत आहे.'
        : currentLangCode.startsWith('hi')
        ? 'हैंड्स-फ्री मोड चालू हो गया है किसान भाई। आप सवाल पूछिए, मैं सुन रहा हूँ।'
        : currentLangCode.startsWith('te')
        ? 'హ్యాండ్స్-ఫ్రీ మోడ్ ప్రారంభమైంది సోదరా. మీరు ప్రశ్న అడగండి, నేను వింటున్నాను.'
        : 'Hands-free mode active. Please ask your question, I am listening.';

      setActiveSpeechText(introMsg);

      // Start listening directly in hands-free mode
      startListening('handsfree');
    }
  };

  // 1. One-Click "Guide Me" Audio (Step-by-step masterclass with visual cards)
  const isGuidePlaying = isPlaying && activeAudioSource === 'guide';
  const handlePlayGuideMe = async () => {
    if (isGuidePlaying) {
      stopAudio();
      setIsGuideModeActive(false);
      return;
    }

    stopAudio();
    stopRecording();
    setIsLoading(true);
    setDrawerOpen(true);
    setIsGuideModeActive(true);

    try {
      const data = await fetchOnboardingAudio(currentLangCode);
      setActiveSpeechText(data.guide_text);
      await playAudio(
        data.audio_base64,
        data.audio_mime,
        data.guide_text,
        data.engine,
        'guide',
        null // Guide Me plays once and never loops into mic
      );
    } catch (err) {
      console.warn('Guide Me audio error:', err);
      showNotice('मार्गदर्शन ऑडिओ लोड करता आला नाही.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Play Cotton Grade Summary Narration
  const isAssayPlaying = isPlaying && activeAudioSource === 'assay';
  const playAssayNarration = useCallback(
    async (targetAssay) => {
      if (!targetAssay) return;
      setIsLoading(true);
      try {
        const data = await narrateGradingResult(targetAssay, currentLangCodeRef.current);
        setActiveSpeechText(data.narration_text);
        await playAudio(
          data.audio_base64,
          data.audio_mime,
          data.narration_text,
          data.engine,
          'assay',
          null // Summary narration plays once and NEVER auto-listens
        );
      } catch (err) {
        console.warn('Could not fetch narration audio:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [playAudio]
  );

  // Toggle button for summary card
  const handleToggleNarrateAssay = () => {
    if (isAssayPlaying) {
      stopAudio();
    } else if (assay) {
      setAutoplayBlocked(false);
      playAssayNarration(assay);
    }
  };

  // Auto-trigger narration EXACTLY ONCE per assay when entering certificate view
  useEffect(() => {
    if (activeView === 'certificate' && assay?.id) {
      if (narratedAssayIdRef.current === assay.id) {
        return;
      }
      narratedAssayIdRef.current = assay.id;

      const timer = setTimeout(() => {
        playAssayNarration(assay);
      }, 400);

      return () => clearTimeout(timer);
    }

    if (activeView !== 'certificate') {
      stopAudio();
    }
  }, [activeView, assay?.id, playAssayNarration, stopAudio]);

  const questionsList =
    QUICK_QUESTIONS[currentLangCode] || QUICK_QUESTIONS['mr-IN'] || [];

  return (
    <div className="space-y-3">
      {/* 1. Multilingual Voice Assistant Header Bar */}
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
                  {isPlaying ? 'Speaking...' : isRecording ? 'Listening...' : 'Family Co-Pilot'}
                </span>
              </div>
              <p className="text-[10px] text-emerald-300 font-medium">
                {currentLangCode.startsWith('mr')
                  ? 'घरच्या माणसासारखा संवाद • मराठी व्हॉइस को-पायलट'
                  : currentLangCode.startsWith('hi')
                  ? 'परिवार जैसा साथ • हिन्दी वॉइस को-पायलट'
                  : currentLangCode.startsWith('te')
                  ? 'కుటుంబ సభ్యుడిలా సహాయం • తెలుగు వాయిస్ కో-పైలట్'
                  : currentLangCode.startsWith('gu')
                  ? 'પોતાના દીકરા જેવો સાથ • ગુજરાતી વોઈસ કો-પાયલટ'
                  : currentLangCode.startsWith('kn')
                  ? 'ಮನೆಯ ಮಗನಂತೆ ಸಲಹೆ • ಕನ್ನಡ ಧ್ವನಿ ಸಹಾಯಕ'
                  : 'Agricultural Voice Co-Pilot • Natural Spoken Dialogue'}
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
                  stopRecording();
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

        {/* Action Row: Distinct Guide Me, Hands-Free Mode, and Tap-to-Speak Mic */}
        <div className="mt-2.5 pt-2 border-t border-emerald-800/80 flex flex-wrap items-center justify-between gap-2">
          {/* Left Controls: Guide Me & Hands-Free Mode Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Guide Me Button (Step-By-step masterclass) */}
            <button
              type="button"
              onClick={handlePlayGuideMe}
              disabled={isLoading}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-sm ${
                isGuidePlaying
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-amber-400 hover:bg-amber-300 text-emerald-950'
              }`}
              title="Listen to full step-by-step camera and grading instructions"
            >
              {isGuidePlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>आवाज थांबवा (Stop Guide)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {currentLangCode.startsWith('mr')
                      ? 'आवाजात समजावून सांगा (Guide Me)'
                      : currentLangCode.startsWith('hi')
                      ? 'आवाज़ में समझें (Guide Me)'
                      : currentLangCode.startsWith('te')
                      ? 'వాయిస్‌లో గైడ్ చేయండి (Guide Me)'
                      : 'Guide Me (Audio)'}
                  </span>
                </>
              )}
            </button>

            {/* Hands-Free Continuous Voice Toggle */}
            <button
              type="button"
              onClick={toggleHandsFreeMode}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition border ${
                isHandsFree
                  ? 'bg-emerald-500 text-emerald-950 border-emerald-300 shadow-md ring-2 ring-emerald-400/50 font-black'
                  : 'bg-emerald-900/90 text-emerald-200 border-emerald-700 hover:bg-emerald-800'
              }`}
              title="Continuous dialogue mode: Speaks answer and automatically listens for follow-ups"
            >
              <Headphones className={`w-3.5 h-3.5 ${isHandsFree ? 'animate-bounce' : ''}`} />
              <span>
                {isHandsFree
                  ? currentLangCode.startsWith('mr')
                    ? 'हात मोकळे मोड चालू ✓'
                    : currentLangCode.startsWith('hi')
                    ? 'हैंड्स-फ्री मोड चालू ✓'
                    : 'Hands-Free ON ✓'
                  : currentLangCode.startsWith('mr')
                  ? 'हात मोकळे संवाद (Hands-Free)'
                  : currentLangCode.startsWith('hi')
                  ? 'हैंड्स-फ्री संवाद (Hands-Free)'
                  : 'Hands-Free Mode'}
              </span>
            </button>
          </div>

          {/* Right Controls: Single-Turn Push-To-Talk Mic & Drawer Toggle */}
          <div className="flex items-center gap-2">
            {/* Single Push-To-Talk Microphone Button */}
            <button
              type="button"
              onClick={toggleSingleRecording}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                isRecording && recordingMode === 'single'
                  ? 'bg-rose-600 text-white animate-pulse border-2 border-white'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-amber-200 border border-emerald-600'
              }`}
              title="Single-turn push-to-talk: Listens once, answers, and stops"
            >
              <Mic className={`w-4 h-4 ${isRecording && recordingMode === 'single' ? 'animate-bounce' : ''}`} />
              <span>
                {isRecording && recordingMode === 'single'
                  ? 'ऐकत आहे... (Listening)'
                  : currentLangCode.startsWith('mr')
                  ? 'बोलण्यासाठी माईक दाबा'
                  : currentLangCode.startsWith('hi')
                  ? 'बोलने के लिए माइक दबाएं'
                  : currentLangCode.startsWith('te')
                  ? 'మాట్లాడటానికి మైక్ నొక్కండి'
                  : 'Tap to Speak'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 text-xs font-extrabold border border-emerald-700 flex items-center gap-1"
              title="Toggle Assistant Dialog Drawer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              {drawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Status / Feedback Banner (Toast without loops) */}
        {statusNotice && (
          <div className="mt-2 p-2 bg-amber-400 text-emerald-950 rounded-xl text-xs font-black flex items-center gap-2 animate-fadeIn">
            <Info className="w-4 h-4 shrink-0 text-emerald-900" />
            <span>{statusNotice}</span>
          </div>
        )}

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
                    {activeAudioSource === 'guide'
                      ? 'मार्गदर्शन ऑडिओ सुरू आहे...'
                      : activeAudioSource === 'assay'
                      ? 'तपासणी निकाल वाचत आहे...'
                      : 'घरचा सहाय्यक उत्तर सांगत आहे...'}
                  </span>
                </div>
              )}
              {isRecording && (
                <div className="flex items-center gap-1 text-rose-300">
                  <span className="w-1 h-3 bg-rose-400 rounded-full animate-pulse"></span>
                  <span className="w-1 h-5 bg-rose-500 rounded-full animate-pulse [animation-delay:0.15s]"></span>
                  <span className="w-1 h-4 bg-rose-400 rounded-full animate-pulse [animation-delay:0.3s]"></span>
                  <span className="text-[11px] font-bold text-white ml-1">
                    {recordingMode === 'handsfree'
                      ? 'हात मोकळे संवाद: प्रश्न स्पष्ट बोला...'
                      : 'माईक चालू आहे, स्पष्ट बोला...'}
                  </span>
                </div>
              )}
            </div>
            {isHandsFree && (
              <span className="text-[10px] font-black bg-emerald-800/90 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600">
                सतत संवाद चालू (Continuous)
              </span>
            )}
          </div>
        )}

        {/* Quick Question Chips */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-black text-emerald-300 uppercase shrink-0">
            {currentLangCode.startsWith('mr')
              ? 'प्रश्न निवडा:'
              : currentLangCode.startsWith('hi')
              ? 'सवाल चुनें:'
              : 'Quick Prompts:'}
          </span>
          {questionsList.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAskQuestion(item.q, null, 'single')}
              className="text-[10px] font-extrabold bg-emerald-950/90 text-amber-200 hover:bg-amber-400 hover:text-emerald-950 px-2.5 py-1 rounded-full whitespace-nowrap border border-emerald-700 transition"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Autoplay Gentle Tap Banner (Appears ONLY if browser autoplay was blocked by OS/browser policy) */}
      {autoplayBlocked && (
        <div className="bg-amber-100 border-2 border-amber-400 text-amber-950 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-tight">
                {currentLangCode.startsWith('mr')
                  ? 'कापूस तपासणीचा निकाल आवाजात ऐका'
                  : currentLangCode.startsWith('hi')
                  ? 'कपास जांच का परिणाम आवाज़ में सुनें'
                  : 'Listen to spoken cotton grading result'}
              </p>
              <p className="text-[11px] text-amber-900 font-bold">
                {currentLangCode.startsWith('mr')
                  ? 'आवाज ऐकण्यासाठी येथे १ टॅप करा'
                  : currentLangCode.startsWith('hi')
                  ? 'आवाज़ सुनने के लिए यहाँ १ बार टैप करें'
                  : 'Tap once to play spoken audio summary'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAutoplayBlocked(false);
              if (audioRef.current && audioRef.current.src) {
                audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              } else if (assay) {
                playAssayNarration(assay);
              }
            }}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition whitespace-nowrap"
          >
            ▶ आवाज ऐका
          </button>
        </div>
      )}

      {/* 2. Interactive Dialog & Audio Player Drawer */}
      {(drawerOpen || dialogHistory.length > 0 || isPlaying || isHandsFree) && (
        <div className="bg-white rounded-2xl border-2 border-emerald-700/20 shadow-sm p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-700 animate-pulse" />
              <span className="text-xs font-black text-slate-900">
                {currentLangCode.startsWith('mr')
                  ? 'कापूस सहाय्यक थेट संवाद (Live Family Voice)'
                  : currentLangCode.startsWith('hi')
                  ? 'कपास सहायक सीधा संवाद (Live Family Voice)'
                  : 'Kapas Sahayak Voice Dialogue'}
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

          {/* Visual Step-by-Step Onboarding Cards (Shown during Guide Me) */}
          {isGuideModeActive && (
            <div className="bg-emerald-950/5 border-2 border-emerald-300 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  {currentLangCode.startsWith('mr')
                    ? '३ सोप्या पायऱ्यांमध्ये हमीभाव मिळवा:'
                    : currentLangCode.startsWith('hi')
                    ? '३ आसान चरणों में सही भाव जानें:'
                    : '3-Step Photo Calibration Guide:'}
                </span>
                <span className="text-[10px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded-full">
                  १००% मोफत (Free)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-white rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <div className="font-black text-emerald-900 text-xs flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>फोटो १: ढीग + ₹५ नाणे</span>
                  </div>
                  <p className="text-[10px] text-stone-600 mt-1">पांढऱ्या कागदावर ५ चे नाणे ठेवून उजेडात कापसाचा फोटो घ्या.</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <div className="font-black text-emerald-900 text-xs flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>फोटो २: सरकी धागा (हॅलो)</span>
                  </div>
                  <p className="text-[10px] text-stone-600 mt-1">काळ्या कापडावर सरकीचा धागा ५ च्या नाण्याशेजारी पसरवून लांबी मोजा.</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <div className="font-black text-emerald-900 text-xs flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>५ सेकंदात ग्रेड व भाव</span>
                  </div>
                  <p className="text-[10px] text-stone-600 mt-1">ओलावा प्रश्न निवडून 'प्रत तपासा' दाबा. AI आवाजात हमीभाव सांगेल!</p>
                </div>
              </div>
            </div>
          )}

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
                            dialogHistory[0]?.engine,
                            'qa'
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
                  : currentLangCode.startsWith('hi')
                  ? 'आगे का सवाल पूछें:'
                  : 'Suggested Follow-Up Questions:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeFollowups.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskQuestion(q, null, isHandsFree ? 'handsfree' : 'single')}
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
                      👨‍🌾 {currentLangCode.startsWith('mr') ? 'शेतकरी दादा' : 'किसान ভাই'} ({item.timestamp || 'आत्ता'}):
                    </span>
                    <span className="text-[9px] font-mono bg-stone-200 px-1.5 py-0.2 rounded">
                      {item.intent || 'Q&A'}
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800 pl-2 border-l-2 border-emerald-500">
                    {item.query}
                  </p>

                  <div className="text-[11px] text-slate-700 leading-relaxed pl-2 pt-1">
                    <span className="font-extrabold text-amber-800">🤖 कापूस सहाय्यक: </span>
                    {item.reply}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        playAudio(item.audioBase64, item.audioMime, item.reply, item.engine, 'qa')
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
                handleAskQuestion(textInput.trim(), null, isHandsFree ? 'handsfree' : 'single');
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
                  : currentLangCode.startsWith('te')
                  ? 'ఇక్కడ ప్రశ్నను టైప్ చేయండి లేదా మాట్లాడండి...'
                  : 'Type your question or use microphone...'
              }
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1 transition shadow-xs"
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
                  : currentLangCode.startsWith('te')
                  ? 'పత్తి గ్రేడ్ మరియు ధర వాయిస్ సారాంశం'
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
            onClick={handleToggleNarrateAssay}
            className="min-h-[36px] px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
          >
            {isAssayPlaying ? (
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
