import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Factory, Wifi, ShieldCheck, IndianRupee } from 'lucide-react';
import LiveLintScanner from './components/LiveLintScanner';
import VirtualPlcHalWidget from './components/VirtualPlcHalWidget';
import VillageLotMap from './components/VillageLotMap';
import ContaminationLog from './components/ContaminationLog';
import {
  fetchHalStatus,
  fetchHalEvents,
  resetHalActuator,
  setHalHardwareMode,
  toggleFalsePositiveEvent,
  fetchVillagePools,
  submitGinMillBid,
  createGinnerStreamSocket,
} from './services/api';
import { industrialSiren } from './utils/sirenAudio';

export default function App() {
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [halStatus, setHalStatus] = useState({
    conveyor_state: 'RUNNING',
    air_jet_diverter_state: 'IDLE',
    strobe_siren_state: 'SILENT',
    hardware_mode: 'VIRTUAL_SIMULATOR',
    connected_hardware_driver: 'SOFTWARE_VIRTUAL_PLC_V1',
    hold_remaining_ms: 0,
    total_interlocks_session: 0,
  });
  const [latestTelemetry, setLatestTelemetry] = useState({
    inference_latency_ms: 11.8,
    fps: 30.0,
    engine: 'YOLOv8n-ONNX Local (Spectral-Edge Active)',
    contaminants_detected: [],
  });
  const [halEvents, setHalEvents] = useState([]);
  const [pools, setPools] = useState([]);
  const [isResetting, setIsResetting] = useState(false);
  const [bannerAlert, setBannerAlert] = useState('');

  const flashBanner = (text) => {
    setBannerAlert(text);
    setTimeout(() => setBannerAlert(''), 4500);
  };

  const refreshData = useCallback(async () => {
    try {
      const [statusData, eventsData, poolsData] = await Promise.all([
        fetchHalStatus(),
        fetchHalEvents(30),
        fetchVillagePools(),
      ]);
      setHalStatus(statusData);
      setHalEvents(eventsData);
      setPools(poolsData);
    } catch {
      // Backend starting up
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Live 30 FPS WebSocket Connection + HAL & Pool Event Listener
  useEffect(() => {
    let reconnectTimer;
    const connect = () => {
      const ws = createGinnerStreamSocket(
        (msg) => {
          if (msg.hal_status) {
            setHalStatus(msg.hal_status);
          }
          if (msg.type === 'FRAME_RESULT') {
            setLatestTelemetry({
              inference_latency_ms: msg.inference_latency_ms,
              fps: msg.fps,
              engine: msg.engine,
              contaminants_detected: msg.contaminants_detected || [],
            });
            if (msg.trigger_hal_relay) {
              industrialSiren.triggerKlaxon(2600);
              fetchHalEvents(30).then(setHalEvents).catch(() => {});
            }
          } else if (msg.type === 'HAL_ACTUATOR_TRIGGERED') {
            industrialSiren.triggerKlaxon(2600);
            fetchHalEvents(30).then(setHalEvents).catch(() => {});
          } else if (msg.type === 'HAL_LINE_RESET' || msg.type === 'HAL_AUTO_RESUMED') {
            industrialSiren.stop();
            setLatestTelemetry((prev) => ({ ...prev, contaminants_detected: [] }));
            fetchHalEvents(30).then(setHalEvents).catch(() => {});
          } else if (
            msg.type === 'POOL_READY_FOR_BIDDING' ||
            msg.type === 'POOL_UPDATED' ||
            msg.type === 'NEW_MILL_BID' ||
            msg.type === 'BID_ACCEPTED'
          ) {
            fetchVillagePools().then(setPools).catch(() => {});
            if (msg.type === 'POOL_READY_FOR_BIDDING' && msg.pool) {
              flashBanner(
                `LIVE MANDI ALERT: ${msg.pool.village_cluster_name} crossed 30 Quintals (${msg.pool.total_quintals} Qtl) — Ready for Direct Mill Pickup Bidding!`
              );
            }
          }
        },
        (connected) => {
          setWsConnected(connected);
          if (!connected) {
            reconnectTimer = setTimeout(connect, 2500);
          }
        }
      );
      wsRef.current = ws;
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Smooth local countdown tick while conveyor is in 5s hold
  useEffect(() => {
    if (halStatus?.conveyor_state !== 'PAUSED_BY_AI') return undefined;
    const t = setInterval(() => {
      fetchHalStatus().then(setHalStatus).catch(() => {});
    }, 350);
    return () => clearInterval(t);
  }, [halStatus?.conveyor_state]);

  const handleResetLine = async (markFalsePositive) => {
    setIsResetting(true);
    try {
      industrialSiren.stop();
      const res = await resetHalActuator(halStatus?.active_event_id, markFalsePositive);
      setHalStatus(res.hal_status);
      setLatestTelemetry((prev) => ({ ...prev, contaminants_detected: [] }));
      const updatedEvents = await fetchHalEvents(30);
      setHalEvents(updatedEvents);
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleHardwareMode = async (nextMode) => {
    const updated = await setHalHardwareMode(nextMode);
    setHalStatus(updated);
  };

  const handleBidSubmit = async (poolId, bidPayload) => {
    await submitGinMillBid(poolId, bidPayload);
    const updatedPools = await fetchVillagePools();
    setPools(updatedPools);
    flashBanner(
      `Direct Pickup Bid (₹${bidPayload.bid_price_per_qtl}/qtl) broadcasted to farmer phones!`
    );
  };

  const handleToggleFp = async (eventId) => {
    await toggleFalsePositiveEvent(eventId);
    const updatedEvents = await fetchHalEvents(30);
    setHalEvents(updatedEvents);
  };

  const viewportAlarm = halStatus?.strobe_siren_state === 'ACTIVE_ALARM';

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 pb-12 transition-all ${
        viewportAlarm ? 'ring-8 ring-inset ring-red-600/80' : ''
      }`}
    >
      {/* Top Industrial B2B Console Header */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 text-slate-950 flex items-center justify-center font-black shadow">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  KapasSetu Mill Console
                </h1>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  EDGE AI + DIRECT MANDI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sub-35ms Lint Contamination Interlock &amp; Pre-Graded Village Truckload Procurement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
              <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
              <span>B2B SaaS: ₹4,500/mo per line • 0.5% Pool Clearing</span>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl border font-mono font-bold flex items-center gap-1.5 ${
                wsConnected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              {wsConnected ? 'WS STREAM: 30 FPS LIVE' : 'RECONNECTING WS...'}
            </div>
          </div>
        </div>
      </header>

      {/* Live Push Notification Banner */}
      {bannerAlert && (
        <div className="max-w-7xl mx-auto px-4 mt-3">
          <div className="p-3 rounded-xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{bannerAlert}</span>
          </div>
        </div>
      )}

      {/* Main Mission-Control Workspace */}
      <main className="max-w-7xl mx-auto px-4 pt-4 space-y-5">
        {/* Top Row: 30 FPS Lint Scanner + Virtual PLC HAL Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7">
            <LiveLintScanner
              wsRef={wsRef}
              wsConnected={wsConnected}
              halStatus={halStatus}
              latestTelemetry={latestTelemetry}
            />
          </div>
          <div className="lg:col-span-5">
            <VirtualPlcHalWidget
              halStatus={halStatus}
              onResetLine={handleResetLine}
              onToggleHardwareMode={handleToggleHardwareMode}
              isResetting={isResetting}
            />
          </div>
        </div>

        {/* Middle Row: Direct 5km Village Cotton Pool Marketplace & Spatial Map */}
        <VillageLotMap pools={pools} onSubmitBid={handleBidSubmit} />

        {/* Bottom Row: Bale QA Compliance & False-Positive Audit Ledger */}
        <ContaminationLog events={halEvents} onToggleFalsePositive={handleToggleFp} />
      </main>
    </div>
  );
}

