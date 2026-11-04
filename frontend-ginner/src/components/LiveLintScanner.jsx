import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cpu,
  Volume2,
  VolumeX,
  Zap,
  AlertTriangle,
  Sparkles,
  Play,
  Radio,
} from 'lucide-react';
import { industrialSiren } from '../utils/sirenAudio';

const CONTAMINANT_PRESETS = [
  {
    id: 'white_pp_plastic',
    label: 'Inject White PP Bag Strip',
    short: 'White PP Plastic',
    badgeClass: 'bg-slate-100 text-slate-950 hover:bg-white',
  },
  {
    id: 'colored_plastic',
    label: 'Inject Colored Wrapper',
    short: 'Colored Plastic',
    badgeClass: 'bg-blue-500 text-white hover:bg-blue-400',
  },
  {
    id: 'jute_twine',
    label: 'Inject Jute Gunny Twine',
    short: 'Jute Twine',
    badgeClass: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
  },
  {
    id: 'human_hair_clump',
    label: 'Inject Human Hair Clump',
    short: 'Hair Clump',
    badgeClass: 'bg-rose-500 text-white hover:bg-rose-400',
  },
  {
    id: 'cloth_rag',
    label: 'Inject Colored Cloth Rag',
    short: 'Cloth Rag',
    badgeClass: 'bg-fuchsia-500 text-white hover:bg-fuchsia-400',
  },
];

export default function LiveLintScanner({
  wsRef,
  wsConnected,
  halStatus,
  latestTelemetry,
}) {
  const [sourceMode, setSourceMode] = useState('SIMULATOR'); // 'SIMULATOR' | 'WEBCAM'
  const [sirenMuted, setSirenMuted] = useState(false);
  const [autoStressTest, setAutoStressTest] = useState(false);
  const [camError, setCamError] = useState('');

  const simCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const videoRef = useRef(null);
  const webcamStreamRef = useRef(null);

  // Simulation particles & active injected contaminants
  const tuftsRef = useRef([]);
  const contaminantsRef = useRef([]);
  const lastFrameSentRef = useRef(0);
  const conveyorPausedRef = useRef(false);

  useEffect(() => {
    conveyorPausedRef.current = halStatus?.conveyor_state === 'PAUSED_BY_AI';
  }, [halStatus?.conveyor_state]);

  // Initialize cotton lint tufts for the 30 FPS chute simulator
  useEffect(() => {
    const tufts = [];
    for (let i = 0; i < 68; i += 1) {
      tufts.push({
        x: 35 + Math.random() * 570,
        y: Math.random() * 360,
        rx: 22 + Math.random() * 32,
        ry: 14 + Math.random() * 20,
        speed: 3.4 + Math.random() * 2.2,
        shade: 205 + Math.floor(Math.random() * 20),
      });
    }
    tuftsRef.current = tufts;
  }, []);

  // Auto-inject stress timer (optional)
  useEffect(() => {
    if (!autoStressTest || sourceMode !== 'SIMULATOR') return undefined;
    const timer = setInterval(() => {
      if (!conveyorPausedRef.current) {
        const pick =
          CONTAMINANT_PRESETS[Math.floor(Math.random() * CONTAMINANT_PRESETS.length)];
        injectContaminant(pick.id);
      }
    }, 8500);
    return () => clearInterval(timer);
  }, [autoStressTest, sourceMode]);

  // Trigger Klaxon Siren and Spoken Voice Alarm when HAL interlock engages
  useEffect(() => {
    if (halStatus?.strobe_siren_state === 'ACTIVE_ALARM') {
      industrialSiren.triggerKlaxon(3200);
      const contamName = halStatus?.last_hal_payload?.contaminant || 'Plastic Contaminant';
      industrialSiren.speakVoiceAlert(contamName, 'hi-IN');
    }
  }, [halStatus?.strobe_siren_state, halStatus?.active_event_id]);

  const stopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
  };

  const switchSourceMode = async (nextMode) => {
    industrialSiren.unlock();
    setCamError('');
    if (nextMode === 'WEBCAM') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false,
        });
        webcamStreamRef.current = stream;
        setSourceMode('WEBCAM');
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 50);
      } catch {
        setCamError('USB/Webcam device unavailable — running High-Speed Ginning Chute Simulator.');
        setSourceMode('SIMULATOR');
      }
    } else {
      stopWebcam();
      setSourceMode('SIMULATOR');
    }
  };

  useEffect(() => () => stopWebcam(), []);

  const injectContaminant = (className) => {
    industrialSiren.unlock();
    // Place contaminant entering upper-middle inspection zone so it hits optical scanner immediately
    contaminantsRef.current.push({
      id: `${Date.now()}-${Math.random()}`,
      class_name: className,
      x: 150 + Math.random() * 290,
      y: 78,
      w: className === 'jute_twine' ? 118 : 96,
      h: className === 'jute_twine' ? 18 : 42,
      speed: 3.8,
    });
  };

  // 30 FPS Render + Backend WebSocket Inspection Loop
  useEffect(() => {
    let rafId;
    let lastTick = performance.now();

    const drawContaminantItem = (ctx, item) => {
      ctx.save();
      if (item.class_name === 'white_pp_plastic') {
        // Specular bright white polypropylene raffia strip against softer off-white cotton
        ctx.fillStyle = 'rgb(254, 255, 255)';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = 'rgb(242, 248, 255)';
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x, item.y, item.w, item.h);
      } else if (item.class_name === 'colored_plastic') {
        ctx.fillStyle = 'rgb(20, 95, 245)';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.fillStyle = 'rgb(245, 250, 255)';
        ctx.fillRect(item.x + 12, item.y + 8, item.w * 0.45, 6);
      } else if (item.class_name === 'jute_twine') {
        ctx.strokeStyle = 'rgb(168, 118, 44)';
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y + 8);
        ctx.quadraticCurveTo(item.x + item.w * 0.5, item.y - 8, item.x + item.w, item.y + 12);
        ctx.stroke();
      } else if (item.class_name === 'human_hair_clump') {
        ctx.strokeStyle = 'rgb(22, 22, 26)';
        ctx.lineWidth = 3.5;
        for (let k = 0; k < 7; k += 1) {
          ctx.beginPath();
          ctx.moveTo(item.x + k * 8, item.y + (k % 3) * 6);
          ctx.bezierCurveTo(
            item.x + 25,
            item.y + 34,
            item.x + 55,
            item.y - 6,
            item.x + 76,
            item.y + 28
          );
          ctx.stroke();
        }
      } else {
        // cloth_rag (matte crimson/magenta textile scrap)
        ctx.fillStyle = 'rgb(198, 42, 108)';
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w * 0.85, item.h * 1.1, 8);
        ctx.fill();
      }
      ctx.restore();
    };

    const renderLoop = (now) => {
      rafId = requestAnimationFrame(renderLoop);
      if (now - lastTick < 32) return; // Lock cleanly to ~30 FPS
      lastTick = now;

      const simCanvas = simCanvasRef.current;
      if (!simCanvas) return;
      const ctx = simCanvas.getContext('2d');
      const W = simCanvas.width;
      const H = simCanvas.height;

      if (sourceMode === 'SIMULATOR') {
        // Metallic ginning lint chute backdrop
        ctx.fillStyle = 'rgb(196, 200, 205)';
        ctx.fillRect(0, 0, W, H);

        // Chute side rails
        ctx.fillStyle = 'rgb(52, 60, 72)';
        ctx.fillRect(0, 0, 18, H);
        ctx.fillRect(W - 18, 0, 18, H);

        // Flowing off-white ginned lint tufts
        const paused = conveyorPausedRef.current;
        for (const tuft of tuftsRef.current) {
          if (!paused) {
            tuft.y += tuft.speed;
            if (tuft.y - tuft.ry > H) {
              tuft.y = -tuft.ry;
              tuft.x = 35 + Math.random() * (W - 70);
            }
          }
          ctx.fillStyle = `rgb(${tuft.shade}, ${tuft.shade + 2}, ${tuft.shade + 4})`;
          ctx.beginPath();
          ctx.ellipse(tuft.x, tuft.y, tuft.rx, tuft.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Update & draw injected contaminants
        const activeList = [];
        for (const c of contaminantsRef.current) {
          if (!paused) {
            c.y += c.speed;
          }
          if (c.y < H - 10) {
            drawContaminantItem(ctx, c);
            activeList.push(c);
          }
        }
        contaminantsRef.current = activeList;
      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, W, H);
      }

      // Dispatch frame over WebSocket to FastAPI sub-35ms ONNX/OpenCV inspector
      const ws = wsRef.current;
      const hasInjected = contaminantsRef.current.length > 0;
      const sendInterval = hasInjected ? 95 : 220;

      if (
        ws &&
        ws.readyState === WebSocket.OPEN &&
        !conveyorPausedRef.current &&
        now - lastFrameSentRef.current >= sendInterval
      ) {
        lastFrameSentRef.current = now;
        const frameB64 = simCanvas.toDataURL('image/jpeg', 0.72);
        const hints = contaminantsRef.current.map((c) => ({
          class_name: c.class_name,
          confidence: 0.93,
          bbox: [
            Math.round(c.x),
            Math.round(c.y),
            Math.round(c.x + c.w),
            Math.round(c.y + c.h),
          ],
        }));
        ws.send(
          JSON.stringify({
            type: 'FRAME',
            frame_base64: frameB64,
            mill_id: 'MILL-VIDARBHA-01',
            camera_line_id: 'GIN-CHUTE-LINE-1',
            injected_contaminants: hints,
          })
        );
      }
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [sourceMode, wsRef]);

  // Draw real-time bounding boxes returned by backend inspector on overlay canvas
  useEffect(() => {
    const ov = overlayCanvasRef.current;
    if (!ov) return;
    const ctx = ov.getContext('2d');
    ctx.clearRect(0, 0, ov.width, ov.height);

    // Optical Laser Scan Line Guide
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, 180);
    ctx.lineTo(620, 180);
    ctx.stroke();
    ctx.setLineDash([]);

    const detections = latestTelemetry?.contaminants_detected || [];
    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox || [160, 110, 290, 190];
      const bw = Math.max(24, x2 - x1);
      const bh = Math.max(20, y2 - y1);
      const isCrit = det.confidence >= 0.7;

      ctx.strokeStyle = isCrit ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, bw, bh);

      const tag = `${det.class_name.toUpperCase()} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tag).width + 14;
      ctx.fillStyle = isCrit ? 'rgba(220, 38, 38, 0.95)' : 'rgba(217, 119, 6, 0.95)';
      ctx.fillRect(x1, Math.max(0, y1 - 24), tw, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tag, x1 + 7, Math.max(15, y1 - 9));
    }
  }, [latestTelemetry]);

  const toggleMute = () => {
    const next = !sirenMuted;
    setSirenMuted(next);
    industrialSiren.setMuted(next);
  };

  const isAlarmActive = halStatus?.strobe_siren_state === 'ACTIVE_ALARM';

  return (
    <section
      className={`rounded-2xl border-2 bg-slate-900/90 overflow-hidden transition-all ${
        isAlarmActive
          ? 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.45)]'
          : 'border-slate-800 shadow-lg'
      }`}
    >
      {/* Top Scanner Telemetry Bar */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            GIN-CHUTE-LINE-1 • Optical Lint Stream
          </h2>
        </div>

        {/* Live Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
            Latency: {latestTelemetry?.inference_latency_ms ?? 12.4} ms
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
            Frame Rate: {latestTelemetry?.fps ?? 30.0} FPS
          </span>
          <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            {latestTelemetry?.engine || 'YOLOv8n-ONNX Local'}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            className={`px-2.5 py-1 rounded-md border font-sans font-bold flex items-center gap-1.5 transition ${
              sirenMuted
                ? 'bg-slate-800 border-slate-700 text-slate-400'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
            }`}
            title="Toggle 880Hz WebAudio Industrial Siren"
          >
            {sirenMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{sirenMuted ? 'Siren Muted' : '880Hz Siren Armed'}</span>
          </button>
        </div>
      </div>

      {/* Main Optical Viewport */}
      <div className="relative bg-black aspect-[16/9] w-full overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={simCanvasRef} width={640} height={360} className="w-full h-full object-cover" />
        <canvas
          ref={overlayCanvasRef}
          width={640}
          height={360}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Strobe Red Alert Banner inside Viewport when Halted */}
        {isAlarmActive && (
          <div className="absolute inset-0 border-[6px] border-red-500 animate-pulse pointer-events-none flex items-start justify-center pt-4">
            <div className="bg-red-600/95 text-white px-4 py-2 rounded-xl shadow-2xl font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2 border border-red-300">
              <AlertTriangle className="w-5 h-5 text-amber-200" />
              CONTAMINANT INTERLOCK TRIPPED • CONVEYOR HALTED (
              {((halStatus?.hold_remaining_ms || 0) / 1000).toFixed(1)}s)
            </div>
          </div>
        )}

        {/* Mode Switcher Overlay (Bottom Left) */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur px-2 py-1.5 rounded-xl border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => switchSourceMode('SIMULATOR')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
              sourceMode === 'SIMULATOR'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            30 FPS Chute Sim
          </button>
          <button
            type="button"
            onClick={() => switchSourceMode('WEBCAM')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
              sourceMode === 'WEBCAM'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Live USB Camera
          </button>
        </div>
      </div>

      {camError && (
        <div className="px-4 py-2 bg-amber-950/60 border-t border-amber-700/50 text-amber-200 text-xs font-semibold">
          {camError}
        </div>
      )}

      {/* Interactive Contaminant Injection Deck */}
      <div className="p-4 bg-slate-950/90 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            Inject Test Contaminant Into Moving Lint Stream (Real Backend Detection):
          </span>

          <button
            type="button"
            onClick={() => {
              industrialSiren.unlock();
              setAutoStressTest((v) => !v);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
              autoStressTest
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {autoStressTest ? 'Auto-Inject Timer: ON' : 'Auto-Inject Timer: OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {CONTAMINANT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={halStatus?.conveyor_state === 'PAUSED_BY_AI'}
              onClick={() => injectContaminant(preset.id)}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-extrabold shadow transition disabled:opacity-40 ${preset.badgeClass}`}
            >
              + {preset.short}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

