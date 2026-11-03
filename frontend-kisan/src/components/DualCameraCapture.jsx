import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, Sparkles, VideoOff, ArrowRight, RotateCcw, UploadCloud, Database } from 'lucide-react';

export default function DualCameraCapture({
  t,
  samples,
  selectedPreset,
  onSelectPreset,
  pileImage,
  setPileImage,
  haloImage,
  setHaloImage,
  isMock,
  setIsMock,
}) {
  const [activeStep, setActiveStep] = useState(1); // 1 = Bulk Pile + White Card, 2 = Seed Halo + Rs 5 Coin
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startLiveCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch (err) {
      setCameraError(
        'Live camera permission unavailable on this device — use Upload Photo or 1-Tap Sample Presets below.'
      );
    }
  };

  const captureFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    if (activeStep === 1) {
      setPileImage(dataUrl);
      stopCamera();
      setActiveStep(2);
    } else {
      setHaloImage(dataUrl);
      stopCamera();
    }
  };

  const SAMPLE_INPUT_PRESETS = [
    {
      id: 'circot_clean',
      title: 'CIRCOT Clean Cotton (Dataset Mode)',
      badge: 'Dataset (No Card/Coin)',
      pileUrl: '/sample_inputs/04_circot_dataset_clean_seed_cotton.jpg',
      haloUrl: '/sample_inputs/06_circot_dataset_combed_halo_pure.jpg',
      isMock: true,
    },
    {
      id: 'kaggle_trash',
      title: 'Kaggle Field Cotton (High Trash)',
      badge: 'Dataset (High Trash)',
      pileUrl: '/sample_inputs/05_kaggle_dataset_high_trash_field_cotton.jpg',
      haloUrl: '/sample_inputs/06_circot_dataset_combed_halo_pure.jpg',
      isMock: true,
    },
    {
      id: 'physical_kalamb_a',
      title: 'Kalamb Calibrated (White Card + ₹5 Coin)',
      badge: 'Calibrated Physical',
      pileUrl: '/sample_inputs/01_calibrated_pile_gradeA_whitecard_coin.jpg',
      haloUrl: '/sample_inputs/01_calibrated_halo_rs5coin_28mm.jpg',
      isMock: false,
    },
  ];

  const loadSamplePreset = async (preset) => {
    setIsMock(preset.isMock);
    try {
      const [resPile, resHalo] = await Promise.all([
        fetch(preset.pileUrl),
        fetch(preset.haloUrl),
      ]);
      const blobPile = await resPile.blob();
      const blobHalo = await resHalo.blob();

      const rPile = new FileReader();
      rPile.onload = () => setPileImage(String(rPile.result));
      rPile.readAsDataURL(blobPile);

      const rHalo = new FileReader();
      rHalo.onload = () => setHaloImage(String(rHalo.result));
      rHalo.readAsDataURL(blobHalo);
    } catch {
      // Fallback if local fetch fails
    }
  };

  const processFile = (file, stepNum) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Flag as mock dataset upload (CIRCOT / Kaggle demo mode)
      setIsMock(true);
      if (stepNum === 1) {
        setPileImage(String(reader.result));
        setActiveStep(2);
      } else {
        setHaloImage(String(reader.result));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e, stepNum) => {
    const file = e.target.files?.[0];
    processFile(file, stepNum);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file, activeStep);
  };

  const currentPreview = activeStep === 1 ? pileImage : haloImage;

  return (
    <section className="bg-white rounded-2xl border-2 border-emerald-700/20 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 px-4 py-3.5 text-white">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-300 shrink-0" />
            {t.wizardTitle}
          </h2>
          <div className="flex items-center gap-2">
            {isMock && (
              <span className="text-[11px] font-black bg-blue-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Database className="w-3 h-3" />
                DATASET MODE (is_mock)
              </span>
            )}
            <span className="text-xs font-bold bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full shrink-0">
              {activeStep === 1 ? '1 / 2' : '2 / 2'}
            </span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-emerald-100 mt-1 leading-snug">{t.wizardSubtitle}</p>
      </div>

      {/* Quick Judge / Field Sample Preset Selector */}
      <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-3">
        <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>1-Click Test Image Presets (Calibrated &amp; Dataset Mode):</span>
          </div>
          <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-mono">
            sample_inputs/
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {SAMPLE_INPUT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadSamplePreset(p)}
              className="min-h-[48px] px-3 py-2 rounded-xl text-left text-xs font-extrabold bg-white border-2 border-amber-300 hover:border-emerald-600 active:bg-amber-100 text-slate-800 transition flex flex-col justify-center"
            >
              <span className="line-clamp-1">{p.title}</span>
              <span className="text-[10px] text-emerald-800 font-bold mt-0.5">{p.badge}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step Pill Switcher */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-stone-100 border-b border-stone-200">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            setActiveStep(1);
          }}
          className={`min-h-[48px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-2 transition ${
            activeStep === 1
              ? 'bg-white border-emerald-700 text-emerald-900 shadow-sm'
              : 'bg-stone-50 border-transparent text-slate-600'
          }`}
        >
          <span>1. Bulk Pile + White Slip</span>
          {pileImage && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setActiveStep(2);
          }}
          className={`min-h-[48px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-2 transition ${
            activeStep === 2
              ? 'bg-white border-emerald-700 text-emerald-900 shadow-sm'
              : 'bg-stone-50 border-transparent text-slate-600'
          }`}
        >
          <span>2. Seed Halo + ₹5 Coin</span>
          {haloImage && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
        </button>
      </div>

      {/* Guided Viewport with Physics SVG Target Overlay */}
      <div className="p-4">
        <div className="mb-2.5">
          <span className="inline-block text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md">
            {activeStep === 1 ? t.step1Badge : t.step2Badge}
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
            {activeStep === 1 ? t.step1Title : t.step2Title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {activeStep === 1 ? t.step1Hint : t.step2Hint}
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border-2 shadow-inner transition-all ${
            isDragging
              ? 'border-blue-400 ring-4 ring-blue-500/30'
              : 'border-slate-800'
          }`}
        >
          {cameraOpen ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : currentPreview ? (
            <img
              src={currentPreview}
              alt={activeStep === 1 ? 'Bulk Cotton Pile Preview' : 'Seed Halo Preview'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Camera className="w-10 h-10 mb-2 text-emerald-400" />
              <p className="text-sm font-semibold text-slate-200">
                {activeStep === 1 ? t.step1Title : t.step2Title}
              </p>
            </div>
          )}

          {/* Drag and Drop Active Overlay Prompt */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 pointer-events-none">
              <UploadCloud className="w-12 h-12 text-blue-300 animate-bounce mb-2" />
              <p className="text-sm font-black uppercase tracking-wider">Drop CIRCOT / Kaggle Cotton Image Here</p>
              <p className="text-xs text-blue-200 mt-1">Automatically switches to Dataset Mode (is_mock: true)</p>
            </div>
          )}

          {/* On-Screen Guided Physics Calibration SVG Overlays */}
          {activeStep === 1 ? (
            <svg
              viewBox="0 0 640 480"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Outer Pile Frame */}
              <rect
                x="24"
                y="24"
                width="592"
                height="432"
                rx="16"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="2"
              />
              {/* White Paper Reference Card Target */}
              <rect
                x="68"
                y="68"
                width="160"
                height="150"
                rx="8"
                fill="rgba(16, 185, 129, 0.14)"
                stroke="#34d399"
                strokeWidth="3.5"
                strokeDasharray="10 6"
              />
              <circle
                cx="148"
                cy="143"
                r="26"
                fill="rgba(251, 191, 36, 0.18)"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
              <rect x="64" y="34" width="380" height="28" rx="6" fill="rgba(6, 78, 59, 0.88)" />
              <text x="76" y="53" fill="#ecfdf5" fontSize="14" fontWeight="700">
                {t.step1Guide}
              </text>
            </svg>
          ) : (
            <svg
              viewBox="0 0 640 480"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Left Target: Rs 5 Coin (23.0 mm Scale) */}
              <circle
                cx="148"
                cy="240"
                r="50"
                fill="rgba(251, 191, 36, 0.14)"
                stroke="#fbbf24"
                strokeWidth="3.5"
                strokeDasharray="8 5"
              />
              <rect x="44" y="160" width="210" height="26" rx="6" fill="rgba(120, 53, 15, 0.9)" />
              <text x="56" y="178" fill="#fef3c7" fontSize="13" fontWeight="700">
                {t.step2CoinGuide}
              </text>

              {/* Right Target: Combed Single Seed Halo */}
              <circle
                cx="430"
                cy="240"
                r="122"
                fill="rgba(56, 189, 248, 0.1)"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="10 6"
              />
              <circle
                cx="430"
                cy="240"
                r="20"
                fill="rgba(245, 158, 11, 0.25)"
                stroke="#f59e0b"
                strokeWidth="2.5"
              />
              <rect x="276" y="86" width="332" height="26" rx="6" fill="rgba(12, 74, 110, 0.9)" />
              <text x="288" y="104" fill="#e0f2fe" fontSize="13" fontWeight="700">
                {t.step2HaloGuide}
              </text>
            </svg>
          )}

          {currentPreview && !cameraOpen && (
            <div className="absolute bottom-3 right-3 bg-emerald-900/90 text-emerald-100 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {t.sampleLoaded}
            </div>
          )}
        </div>

        {cameraError && (
          <p className="mt-2 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-xl px-3 py-2">
            {cameraError}
          </p>
        )}

        {/* Drag-and-Drop Dropzone Alongside Camera Controls */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-3 p-3.5 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
            isDragging
              ? 'bg-blue-100 border-blue-500 text-blue-900'
              : 'bg-stone-50 border-stone-300 text-slate-700 hover:border-emerald-600 hover:bg-emerald-50/50'
          }`}
          onClick={() => document.getElementById(`file-upload-input-${activeStep}`)?.click()}
        >
          <UploadCloud className="w-6 h-6 text-emerald-700 mb-1" />
          <div className="text-xs font-black text-slate-800">
            Drag & Drop CIRCOT / Kaggle Dataset Image Here
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            or click to browse from disk • Automatically sends <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">is_mock: true</code>
          </div>
          <input
            id={`file-upload-input-${activeStep}`}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, activeStep)}
            className="hidden"
          />
        </div>

        {/* High-Contrast 48px+ Outdoor Action Buttons */}
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {!cameraOpen ? (
            <button
              type="button"
              onClick={startLiveCamera}
              className="min-h-[50px] bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 shadow-sm transition"
            >
              <Camera className="w-5 h-5" />
              {t.openLiveCamera}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={captureFromVideo}
                className="flex-1 min-h-[50px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl px-4 py-3 flex items-center justify-center gap-2 shadow"
              >
                <Camera className="w-5 h-5" />
                {t.capturePhoto}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-[50px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl px-3 py-3 flex items-center justify-center"
                title={t.stopCamera}
              >
                <VideoOff className="w-5 h-5" />
              </button>
            </div>
          )}

          <label className="min-h-[50px] cursor-pointer bg-white hover:bg-stone-50 text-slate-800 border-2 border-slate-300 font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition">
            <ImagePlus className="w-5 h-5 text-emerald-700" />
            <span>{t.uploadFromGallery}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileUpload(e, activeStep)}
              className="hidden"
            />
          </label>
        </div>

        {/* Step Navigation Footer */}
        <div className="mt-3 flex justify-between items-center pt-2 border-t border-stone-200">
          {activeStep === 2 ? (
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="min-h-[44px] px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              {t.backToStep1}
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              23.0 mm Coin + White Card Protocol
            </span>
          )}

          {activeStep === 1 && (
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="min-h-[44px] px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition"
            >
              {t.nextToStep2}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

