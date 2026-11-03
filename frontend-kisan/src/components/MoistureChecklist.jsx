import React from 'react';
import { Sun, CloudRain, Droplets, MapPin, Scale, Bluetooth, Sparkles, Loader2 } from 'lucide-react';
import { VIDARBHA_VILLAGES } from '../i18n/translations';

export default function MoistureChecklist({
  t,
  formState,
  setFormState,
  onRunAssay,
  isAnalyzing,
}) {
  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleVillageChange = (villageId) => {
    const found = VIDARBHA_VILLAGES.find((v) => v.id === villageId) || VIDARBHA_VILLAGES[0];
    setFormState((prev) => ({
      ...prev,
      villageId: found.id,
      village_name: found.village_name,
      district: found.district,
      latitude: found.lat,
      longitude: found.lon,
    }));
  };

  return (
    <section className="bg-white rounded-2xl border-2 border-emerald-700/20 shadow-sm p-4 sm:p-5 space-y-5">
      <div>
        <span className="inline-block text-xs font-extrabold uppercase tracking-wider text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md">
          {t.step3Badge}
        </span>
        <h2 className="text-lg font-extrabold text-slate-900 mt-1 flex items-center gap-2">
          <Droplets className="w-5 h-5 text-emerald-700 shrink-0" />
          {t.step3Title}
        </h2>
      </div>

      {/* Toggle 1: Picking Session */}
      <div>
        <label className="block text-sm font-extrabold text-slate-800 mb-2">
          {t.pickingTimeLabel}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => updateField('picking_session', 'MORNING_DEW')}
            className={`min-h-[56px] p-3 rounded-xl border-2 text-left flex items-center gap-3 transition ${
              formState.picking_session === 'MORNING_DEW'
                ? 'bg-amber-50 border-amber-500 text-slate-900 shadow-sm'
                : 'bg-stone-50 border-stone-200 text-slate-700 hover:border-stone-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-amber-200/80 text-amber-900">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold">{t.morningDew}</div>
              <div className="text-xs text-slate-600">{t.morningDewSub}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateField('picking_session', 'AFTERNOON_SUN')}
            className={`min-h-[56px] p-3 rounded-xl border-2 text-left flex items-center gap-3 transition ${
              formState.picking_session === 'AFTERNOON_SUN'
                ? 'bg-emerald-50 border-emerald-600 text-slate-900 shadow-sm'
                : 'bg-stone-50 border-stone-200 text-slate-700 hover:border-stone-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-emerald-200/80 text-emerald-900">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold">{t.afternoonSun}</div>
              <div className="text-xs text-slate-600">{t.afternoonSunSub}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Toggle 2: Shade Drying Days */}
      <div>
        <label className="block text-sm font-extrabold text-slate-800 mb-2">
          {t.shadeDryingLabel}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { days: 0, label: t.dried0 },
            { days: 2, label: t.dried2 },
            { days: 3, label: t.dried3 },
          ].map((opt) => {
            const active = formState.shade_dried_days === opt.days;
            return (
              <button
                key={opt.days}
                type="button"
                onClick={() => updateField('shade_dried_days', opt.days)}
                className={`min-h-[52px] px-2.5 py-2 rounded-xl border-2 text-xs sm:text-sm font-extrabold transition ${
                  active
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                    : 'bg-stone-50 text-slate-800 border-stone-200 hover:border-emerald-500'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Harvest Quantity Slider + Stepper */}
      <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-700" />
            {t.quantityLabel}
          </label>
          <span className="text-lg font-black text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-lg">
            {Number(formState.quantity_quintals).toFixed(1)} Qtl
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              updateField(
                'quantity_quintals',
                Math.max(1.0, Number((formState.quantity_quintals - 0.5).toFixed(1)))
              )
            }
            className="w-12 h-12 rounded-xl bg-white border-2 border-stone-300 font-black text-xl text-slate-800 active:bg-stone-200"
          >
            −
          </button>
          <input
            type="range"
            min="1.0"
            max="25.0"
            step="0.5"
            value={formState.quantity_quintals}
            onChange={(e) => updateField('quantity_quintals', parseFloat(e.target.value))}
            className="flex-1 h-3 bg-emerald-200 rounded-lg accent-emerald-700 cursor-pointer"
          />
          <button
            type="button"
            onClick={() =>
              updateField(
                'quantity_quintals',
                Math.min(25.0, Number((formState.quantity_quintals + 0.5).toFixed(1)))
              )
            }
            className="w-12 h-12 rounded-xl bg-white border-2 border-stone-300 font-black text-xl text-slate-800 active:bg-stone-200"
          >
            +
          </button>
        </div>
      </div>

      {/* Village Cluster & Farmer Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            {t.villageLabel}
          </label>
          <select
            value={formState.villageId}
            onChange={(e) => handleVillageChange(e.target.value)}
            className="w-full min-h-[48px] px-3 py-2.5 rounded-xl bg-white border-2 border-stone-300 text-sm font-bold text-slate-900 focus:border-emerald-700 focus:outline-none"
          >
            {VIDARBHA_VILLAGES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
            {t.farmerNameLabel}
          </label>
          <input
            type="text"
            value={formState.farmer_name}
            onChange={(e) => updateField('farmer_name', e.target.value)}
            className="w-full min-h-[48px] px-3 py-2.5 rounded-xl bg-white border-2 border-stone-300 text-sm font-bold text-slate-900 focus:border-emerald-700 focus:outline-none"
            placeholder="Rameshwar Deshmukh"
          />
        </div>
      </div>

      {/* Hardware Abstraction Hook: Optional Phase-2 BLE Capacitive Probe Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Bluetooth className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {formState.bleEnabled
              ? `${t.bleConnected} (${formState.bleMoisturePct}%)`
              : t.bleNotConnected}
          </span>
        </div>
        <button
          type="button"
          onClick={() => updateField('bleEnabled', !formState.bleEnabled)}
          className={`px-3 py-1.5 rounded-lg font-bold border transition ${
            formState.bleEnabled
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {formState.bleEnabled ? 'Disable BLE Sim' : 'Test Phase-2 BLE'}
        </button>
      </div>

      {/* Primary CTA Button */}
      <button
        type="button"
        disabled={isAnalyzing}
        onClick={onRunAssay}
        className="w-full min-h-[56px] bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-60 text-white text-base sm:text-lg font-black rounded-2xl px-6 py-3.5 shadow-md flex items-center justify-center gap-2.5 transition"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
            <span>{t.analyzingBtn}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-amber-300" />
            <span>{t.runAssayBtn}</span>
          </>
        )}
      </button>
    </section>
  );
}

