import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw,
  CheckCircle2,
  Radio,
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
    { label: 'फोटो कसा काढायचा?', q: 'फोटो कसा काढायचा?' },
    { label: 'गाव समूह काय आहे?', q: 'गाव समूह काय आहे?' },
  ],
  'hi-IN': [
    { label: 'क्या ऐप फ्री है?', q: 'क्या यह ऐप पूरी तरह फ्री है?' },
    { label: 'व्यापारी कम भाव दे तो?', q: 'व्यापारी कम भाव दे रहा है क्या करूँ?' },
    { label: 'फोटो कैसे लें?', q: 'कपास का फोटो कैसे लें?' },
    { label: 'गांव समूह क्या है?', q: 'गांव समूह क्या है?' },
  ],
  'te-IN': [
    { label: 'యాప్ ఉచితమేనా?', q: 'ఈ యాప్ పూర్తిగా ఉచితమేనా?' },
    { label: 'వ్యాపారి తక్కువ ధర ఇస్తే?', q: 'వ్యాపారి తక్కువ ధర ఇస్తే ఏమి చేయాలి?' },
    { label: 'ఫోటో ఎలా తీయాలి?', q: 'ఫోటో ఎలా తీయాలి?' },
  ],
  'en-IN': [
    { label: 'Is this app free?', q: 'Is this app free for farmers?' },
    { label: 'Trader offering low price?', q: 'Trader is offering low price, what to do?' },
    { label: 'How to take photo?', q: 'How to take cotton photo?' },
    { label: 'What is village pool?', q: 'What is village pool?' },
  ],
};

export default function VoiceSahayak({
  lang = 'mr',
  onLanguageChange,
  assay = null,
  activeView = 'capture',
}) {
  // Map parent short lang ('mr', 'hi', 'en') to full speech code
  const currentLangCode =
    VOICE_LANGUAGES.find((l) => l.code.startsWith(lang))?.code || 'mr-IN';

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState('');
  const [dialogHistory, setDialogHistory] = useState([]);
  const [engineBadge, setEngineBadge] = useState('Gnani Timbre v3.0');

  const audioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Stop audio on unmount or view change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Play audio bytes or fallback to browser SpeechSynthesis
  const playAudio = async (audioBase64, mimeType = 'audio/mpeg', fallbackText = '') => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      if (audioBase64 && audioBase64.length > 100) {
        const audioSrc = `data:${mimeType};base64,${audioBase64}`;
        audioRef.current.src = audioSrc;
        audioRef.current.onended = () => {
          setIsPlaying(false);
        };
        audioRef.current.onerror = () => {
          fallbackBrowserTTS(fallbackText, currentLangCode);
        };
        await audioRef.current.play();
        setIsPlaying(true);
      } else {
        fallbackBrowserTTS(fallbackText, currentLangCode);
      }
    } catch {
      fallbackBrowserTTS(fallbackText, currentLangCode);
    }
  };

  const fallbackBrowserTTS = (text, langCode) => {
    if (!window.speechSynthesis || !text) {
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    setEngineBadge('Browser Voice (Offline Fallback)');
    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
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
      setEngineBadge(data.engine?.includes('gnani') ? 'Gnani Timbre v3.0' : 'Gnani Voice API');
      await playAudio(data.audio_base64, data.audio_mime, data.guide_text);
    } catch {
      const fallbackMsg =
        currentLangCode.startsWith('mr')
          ? 'राम राम शेतकरी मित्रांनो! कापसाच्या ढिगाऱ्याशेजारी पांढरा कागद आणि पाच रुपयांचे नाणे ठेवून फोटो काढा. पाच सेकंदात हमीभाव मिळवा.'
          : 'राम राम किसान भाई! कपास के पास सफेद कागज और पांच रुपये का सिक्का रखकर फोटो लें, या अपलोड करें।';
      setActiveSpeechText(fallbackMsg);
      fallbackBrowserTTS(fallbackMsg, currentLangCode);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Auto-Narrate Cotton Grade Result
  const handleNarrateAssay = async () => {
    if (!assay) return;
    if (isPlaying) {
      stopAudio();
      return;
    }
    setIsLoading(true);
    try {
      const data = await narrateGradingResult(assay, currentLangCode);
      setActiveSpeechText(data.narration_text);
      setEngineBadge(data.engine?.includes('gnani') ? 'Gnani Timbre v3.0' : 'Gnani Voice API');
      await playAudio(data.audio_base64, data.audio_mime, data.narration_text);
    } catch {
      const fallbackScript = `Brother, your cotton is ${assay.color_grade} with only ${assay.trash_percent} percent trash. Today's fair price is ${Math.round(assay.final_fair_price_per_qtl)} rupees per quintal. Do not sell below ${Math.round(assay.final_fair_price_per_qtl) - 150} rupees!`;
      setActiveSpeechText(fallbackScript);
      fallbackBrowserTTS(fallbackScript, currentLangCode);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger narration when entering certificate view
  useEffect(() => {
    if (activeView === 'certificate' && assay && !isPlaying) {
      const timer = setTimeout(() => {
        handleNarrateAssay();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [activeView, assay?.id]);

  // 3. Ask Voice Question (Text or Voice)
  const handleAskQuestion = async (queryText, audioBlob = null) => {
    setIsLoading(true);
    setDrawerOpen(true);
    try {
      const res = await askVoiceCopilot({
        audioBlob,
        queryText: queryText || 'ॲप कसे वापरायचे?',
        language: currentLangCode,
        gradeContext: assay,
      });

      const newEntry = {
        id: Date.now(),
        query: res.query_text || queryText,
        reply: res.reply_text,
        audioBase64: res.audio_base64,
        audioMime: res.audio_mime,
        engine: res.engine,
      };

      setDialogHistory((prev) => [newEntry, ...prev.slice(0, 4)]);
      setActiveSpeechText(res.reply_text);
      setEngineBadge(res.engine?.includes('gnani') ? 'Gnani Timbre v3.0' : 'Gnani Voice API');
      await playAudio(res.audio_base64, res.audio_mime, res.reply_text);
    } catch (err) {
      const errReply =
        currentLangCode.startsWith('mr')
          ? 'कापूस सेतू ॲप शेतकऱ्यांसाठी १०० टक्के मोफत आहे. कापसाचा ढीग आणि ५ रुपयांचे नाणे ठेवून अचूक हमीभाव तपासा.'
          : 'कपास सेतू किसानों के लिए १०० प्रतिशत बिल्कुल मुफ्त है।';
      setDialogHistory((prev) => [
        {
          id: Date.now(),
          query: queryText || 'कापूस सेतू',
          reply: errReply,
        },
        ...prev,
      ]);
      fallbackBrowserTTS(errReply, currentLangCode);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Microphone Recording (MediaRecorder API)
  const startRecording = async () => {
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
      // If mic permission denied, ask default question
      handleAskQuestion('कापूस सेतू ॲप कसे वापरायचे?');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-wide text-amber-300">
                  कापूस सहाय्यक (Kapas Sahayak)
                </span>
                <span className="text-[9px] font-extrabold bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-600">
                  Gnani.ai Voice
                </span>
              </div>
              <p className="text-[10px] text-emerald-300">
                {currentLangCode.startsWith('mr')
                  ? 'मराठी व्हॉइस को-पायलट • आवाजात माहिती ऐका'
                  : currentLangCode.startsWith('hi')
                  ? 'हिन्दी वॉइस को-पायलट • आवाज़ में सुनें'
                  : 'Multilingual Voice Co-Pilot • Powered by Gnani Timbre'}
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
                  if (onLanguageChange) {
                    onLanguageChange(item.code.split('-')[0]);
                  }
                }}
                className={`min-h-[30px] px-2 py-0.5 rounded-lg text-[11px] font-black transition ${
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

        {/* Action Row: Guide Me button + Push-To-Talk Mic */}
        <div className="mt-2.5 pt-2 border-t border-emerald-800/80 flex flex-wrap items-center justify-between gap-2">
          {/* Guide Me Button */}
          <button
            type="button"
            onClick={handlePlayGuideMe}
            disabled={isLoading}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 transition shadow-sm ${
              isPlaying
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                : 'bg-amber-400 hover:bg-amber-300 text-emerald-950'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>आवाज थांबवा (Stop Audio)</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>
                  {currentLangCode.startsWith('mr')
                    ? 'आवाजात ऐका (Guide Me)'
                    : currentLangCode.startsWith('hi')
                    ? 'आवाज़ में समझें (Guide Me)'
                    : 'Guide Me (Spoken Voice)'}
                </span>
              </>
            )}
          </button>

          {/* Ask Question / Microphone Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                isRecording
                  ? 'bg-rose-600 text-white animate-bounce'
                  : 'bg-emerald-800 hover:bg-emerald-700 text-amber-200 border border-emerald-600'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>
                {isRecording
                  ? 'ऐकत आहे... (Listening)'
                  : currentLangCode.startsWith('mr')
                  ? 'माईक दाबून बोला'
                  : currentLangCode.startsWith('hi')
                  ? 'माइक दबाकर बोलें'
                  : 'Hold to Speak'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-800 text-emerald-200 text-xs font-extrabold border border-emerald-700 flex items-center gap-1"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">प्रश्न विचारा</span>
            </button>
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-black text-emerald-300 uppercase shrink-0">
            {currentLangCode.startsWith('mr') ? 'वारंवार विचारलेले प्रश्न:' : 'Quick Questions:'}
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
      {(drawerOpen || dialogHistory.length > 0 || isPlaying) && (
        <div className="bg-white rounded-2xl border-2 border-emerald-700/20 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-700 animate-pulse" />
              <span className="text-xs font-black text-slate-900">
                कापूस सहाय्यक संभाषण (Live Voice Assistant)
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
            <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-200/80 text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 font-black text-[10px]">
                  AI
                </div>
                <div className="flex-1">
                  <p className="font-bold">{activeSpeechText}</p>
                  {isPlaying && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 font-black">
                      <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                      <span>आवाज सुरू आहे (Speaking with Gnani Timbre TTS)...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dialog History Accordion */}
          {dialogHistory.length > 0 && (
            <div className="space-y-2 pt-1 max-h-52 overflow-y-auto pr-1">
              {dialogHistory.map((item) => (
                <div
                  key={item.id}
                  className="text-xs bg-stone-50 rounded-xl p-2.5 border border-stone-200 space-y-1"
                >
                  <p className="font-black text-slate-800">
                    <span className="text-emerald-700">शेतकरी प्रश्न: </span>
                    {item.query}
                  </p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    <span className="font-extrabold text-amber-800">सहाय्यक: </span>
                    {item.reply}
                  </p>
                  {item.audioBase64 && (
                    <button
                      type="button"
                      onClick={() => playAudio(item.audioBase64, item.audioMime, item.reply)}
                      className="text-[10px] text-emerald-700 font-black hover:underline flex items-center gap-1 pt-0.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      पुन्हा ऐका (Replay Voice)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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
                {assay.color_grade} • कचरा {assay.trash_percent}% • ₹{Math.round(assay.final_fair_price_per_qtl)}/qtl
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

