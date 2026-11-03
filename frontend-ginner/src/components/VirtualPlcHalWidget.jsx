import React from 'react';
import {
  Cpu,
  Wind,
  Power,
  Terminal,
  CheckCircle2,
  Flag,
  ShieldAlert,
  Cog,
} from 'lucide-react';

export default function VirtualPlcHalWidget({
  halStatus,
  onResetLine,
  onToggleHardwareMode,
  isResetting,
}) {
  const isPaused = halStatus?.conveyor_state === 'PAUSED_BY_AI';
  const isValveFiring = halStatus?.air_jet_diverter_state === 'FIRING_VALVE';
  const isPhysicalMode = halStatus?.hardware_mode === 'PHYSICAL_PLC_GPIO';
  const holdSeconds = ((halStatus?.hold_remaining_ms || 0) / 1000).toFixed(1);

  const sampleOrLivePayload = halStatus?.last_hal_payload || {
    event_id: 'HAL-2026-READY',
    protocol: 'KAPASSETU_HAL_V1',
    gpio_pin_target: 'RELAY_CH1_24V_NC',
    air_valve_pin: 'SOLENOID_CH2_8BAR',
    command: 'STANDBY_MONITORING',
    hold_duration_ms: 5000,
    hardware_driver: halStatus?.connected_hardware_driver || 'SOFTWARE_VIRTUAL_PLC_V1',
  };

  return (
    <section className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-4 sm:p-5 space-y-4 shadow-lg">
      {/* Header + Phase-2 Hardware Driver Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Hardware Abstraction Layer (HAL) & Virtual PLC Relay
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Webhook Bus: <code className="text-cyan-300">POST /api/v1/hal/actuator-trigger</code>
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onToggleHardwareMode(isPhysicalMode ? 'VIRTUAL_SIMULATOR' : 'PHYSICAL_PLC_GPIO')
          }
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition flex items-center gap-2 ${
            isPhysicalMode
              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>
            {isPhysicalMode
              ? 'Mode: Phase 2 ESP32 / Jetson 24V GPIO'
              : 'Mode: Software Virtual PLC Simulator'}
          </span>
        </button>
      </div>

      {/* Live Actuator Schematics: Conveyor Relay CH1 + Pneumatic Air-Jet Solenoid CH2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Feeder Conveyor Motor (Relay CH1 - 24V NC) */}
        <div
          className={`p-3.5 rounded-xl border-2 transition ${
            isPaused
              ? 'bg-red-950/40 border-red-500'
              : 'bg-slate-950/80 border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-bold">RELAY_CH1_24V_NC</span>
            <span
              className={`px-2 py-0.5 rounded font-black ${
                isPaused ? 'bg-red-600 text-white' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isPaused ? 'HALTED BY AI' : 'RUNNING'}
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400 mb-2">
            Feeder Conveyor Motor Interlock
          </div>

          {/* Animated Belt Visualizer */}
          <div className="relative h-10 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-between px-3">
            <div
              className={`absolute inset-0 ${
                isPaused
                  ? 'conveyor-halted-stripes'
                  : 'conveyor-stripes animate-conveyor'
              }`}
            />
            <Cog
              className={`relative z-10 w-5 h-5 ${
                isPaused ? 'text-red-400' : 'text-emerald-400 animate-spin'
              }`}
            />
            <span className="relative z-10 font-mono text-[11px] font-black tracking-wider bg-slate-950/85 px-2.5 py-0.5 rounded text-slate-100">
              {isPaused ? `INTERLOCK HOLD (${holdSeconds}s)` : 'BELT SPEED: 1.8 m/s'}
            </span>
            <Cog
              className={`relative z-10 w-5 h-5 ${
                isPaused ? 'text-red-400' : 'text-emerald-400 animate-spin'
              }`}
            />
          </div>
        </div>

        {/* 2. Pneumatic Air-Jet Diverter (Solenoid CH2 - 8 Bar) */}
        <div
          className={`p-3.5 rounded-xl border-2 transition ${
            isValveFiring
              ? 'bg-amber-950/40 border-amber-400'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-bold">SOLENOID_CH2_8BAR</span>
            <span
              className={`px-2 py-0.5 rounded font-black ${
                isValveFiring
                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isValveFiring ? 'EJECTING CONTAMINANT' : 'MANIFOLD IDLE'}
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400 mb-2">
            Pneumatic Air-Knife Diverter Valve (8.0 Bar)
          </div>

          <div className="h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind
                className={`w-5 h-5 ${
                  isValveFiring ? 'text-amber-300 animate-bounce' : 'text-slate-500'
                }`}
              />
              <span className="font-mono text-xs font-bold text-slate-200">
                {isValveFiring ? 'NOZZLE BLAST ACTIVE' : 'PRESSURE: 8.2 BAR OK'}
              </span>
            </div>
            {isValveFiring && (
              <span className="font-mono text-sm font-black text-amber-300">{holdSeconds}s</span>
            )}
          </div>
        </div>
      </div>

      {/* Live HAL JSON / MQTT Telemetry Terminal */}
      <div className="rounded-xl bg-black border border-slate-800 overflow-hidden">
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Terminal className="w-3.5 h-3.5" />
            LIVE HAL WEBHOOK / MQTT PAYLOAD (KAPASSETU_HAL_V1)
          </span>
          <span>Interlocks Triggered: {halStatus?.total_interlocks_session ?? 0}</span>
        </div>
        <pre className="p-3 text-[11px] sm:text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
          {JSON.stringify(sampleOrLivePayload, null, 2)}
        </pre>
      </div>

      {/* Operator Interlock Resolution Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          disabled={isResetting}
          onClick={() => onResetLine(false)}
          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          Confirm Contaminant Removed & Resume Line
        </button>

        <button
          type="button"
          disabled={isResetting}
          onClick={() => onResetLine(true)}
          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
        >
          <Flag className="w-4 h-4" />
          Flag False Positive (Retrain Model)
        </button>
      </div>

      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>
          Phase-2 Hardware Ready: Connect an ESP32 or NVIDIA Jetson Orin GPIO listener to{' '}
          <code className="text-slate-200">EXTERNAL_PLC_WEBHOOK_URL</code> to trip physical 24V
          relays with zero code changes.
        </span>
      </div>
    </section>
  );
}

