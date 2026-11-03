import React from 'react';
import {
  Award,
  CheckCircle2,
  Ruler,
  Sparkles,
  Leaf,
  Droplets,
  ShieldAlert,
  Bluetooth,
  RotateCcw,
} from 'lucide-react';

export default function GradeCertificate({ t, assay, onStartNewAssay }) {
  if (!assay) return null;

  const formatSignedInr = (val) => {
    const num = Number(val || 0);
    if (Math.abs(num) < 0.01) return '₹0';
    return num > 0 ? `+₹${Math.round(num).toLocaleString('en-IN')}` : `-₹${Math.round(Math.abs(num)).toLocaleString('en-IN')}`;
  };

  return (
    <section className="space-y-4">
      {/* Certificate Card */}
      <div className="bg-white rounded-2xl border-2 border-emerald-700/30 shadow-md overflow-hidden">
        {/* Certificate Top Ribbon */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 px-4 py-4 text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-300 shrink-0" />
              <h2 className="text-lg sm:text-xl font-black tracking-tight">{t.certHeader}</h2>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              Assay #{assay.id} • {assay.farmer_name} • {assay.village_name}, {assay.district}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {t.verifiedBadge}
          </span>
        </div>

        {/* Side-by-Side OpenCV Annotated Verification Overlays */}
        <div className="p-4 bg-stone-900 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assay.annotated_pile_base64 && (
            <div className="rounded-xl overflow-hidden border border-emerald-500/40 bg-black">
              <img
                src={assay.annotated_pile_base64}
                alt="Calibrated Bulk Cotton Pile Overlay"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="px-3 py-1.5 bg-slate-950 text-emerald-300 text-xs font-bold flex items-center justify-between">
                <span>{t.overlay1Caption}</span>
                <span className="text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded">
                  {assay.white_card_detected ? 'White Card OK' : 'Auto-CLAHE'}
                </span>
              </div>
            </div>
          )}

          {assay.annotated_halo_base64 && (
            <div className="rounded-xl overflow-hidden border border-cyan-500/40 bg-black">
              <img
                src={assay.annotated_halo_base64}
                alt="Calibrated Seed Halo Staple Overlay"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="px-3 py-1.5 bg-slate-950 text-cyan-300 text-xs font-bold flex items-center justify-between">
                <span>{t.overlay2Caption}</span>
                <span className="text-[11px] bg-cyan-900/60 px-2 py-0.5 rounded">
                  {assay.coin_detected ? '23mm Coin OK' : 'Calibrated FOV'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4 Core Quality Metrics with HVI Benchmark Badges */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Color Grade */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                {t.metricColorGrade}
              </span>
              <span className="bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded font-mono">
                Rd: {assay.reflectance_rd} | +b: {assay.yellowness_plus_b}
              </span>
            </div>
            <div className="text-base font-black text-slate-900 mt-1.5 leading-snug">
              {assay.color_grade}
            </div>
          </div>

          {/* 2. Staple Length */}
          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
            <div className="flex items-center justify-between text-xs font-bold text-sky-900">
              <span className="flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-sky-700" />
                {t.metricStaple}
              </span>
              <span className="bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded font-extrabold">
                {t.coinScaleBadge}
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 mt-1.5">
              {assay.staple_length_mm} mm{' '}
              <span className="text-sm font-bold text-sky-800">({assay.staple_category})</span>
            </div>
          </div>

          {/* 3. Trash Content */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-700" />
                {t.metricTrash}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  assay.trash_percent <= 3.0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {assay.trash_percent <= 3.0 ? t.lowTrash : t.highTrash}
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 mt-1.5">{assay.trash_percent}%</div>
          </div>

          {/* 4. Moisture Content + Hardware Hook Pill */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-blue-600" />
                {t.metricMoisture}
              </span>
              <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                RH {assay.relative_humidity_pct}% • {assay.ambient_temp_c}°C
              </span>
            </div>
            <div className="text-lg font-black text-slate-900 mt-1">
              {assay.moisture_percent}%{' '}
              <span className="text-xs font-bold text-slate-600">
                ({assay.moisture_source === 'BLE_SENSOR' ? 'BLE Capacitive Probe' : 'Agronomic Weather Proxy'})
              </span>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
              <Bluetooth className="w-3 h-3 text-blue-600" />
              {assay.moisture_source === 'BLE_SENSOR'
                ? t.bleConnected
                : t.bleNotConnected}
            </div>
          </div>
        </div>
      </div>

      {/* Transparent 2026-27 MSP & Mandi Fair Price Breakdown Card */}
      <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-md p-4 sm:p-5">
        <h3 className="text-base sm:text-lg font-black text-slate-900 border-b border-stone-200 pb-2.5">
          {t.priceCardTitle}
        </h3>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>{t.baseMspLabel}</span>
            <span className="font-bold text-slate-900">
              ₹{Math.round(assay.base_msp_price).toLocaleString('en-IN')}/qtl
            </span>
          </div>

          <div className="flex justify-between font-semibold text-slate-700">
            <span>{t.stapleAdjLabel} ({assay.staple_length_mm} mm)</span>
            <span
              className={`font-bold ${
                assay.staple_adjustment >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatSignedInr(assay.staple_adjustment)}/qtl
            </span>
          </div>

          <div className="flex justify-between font-semibold text-slate-700">
            <span>{t.colorAdjLabel}</span>
            <span
              className={`font-bold ${
                assay.color_adjustment >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatSignedInr(assay.color_adjustment)}/qtl
            </span>
          </div>

          <div className="flex justify-between font-semibold text-slate-700">
            <span>{t.trashDedLabel} ({assay.trash_percent}%)</span>
            <span className="font-bold text-red-600">
              {assay.trash_deduction > 0
                ? `-₹${Math.round(assay.trash_deduction).toLocaleString('en-IN')}/qtl`
                : '₹0'}
            </span>
          </div>

          <div className="flex justify-between font-semibold text-slate-700">
            <span>{t.moistureDedLabel} ({assay.moisture_percent}%)</span>
            <span className="font-bold text-red-600">
              {assay.moisture_deduction > 0
                ? `-₹${Math.round(assay.moisture_deduction).toLocaleString('en-IN')}/qtl`
                : '₹0'}
            </span>
          </div>
        </div>

        {/* Net Fair Farm-Gate Price Highlight */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-700 text-white flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              {t.netFairPriceLabel}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-0.5">
              ₹{Math.round(assay.final_fair_price_per_qtl).toLocaleString('en-IN')}{' '}
              <span className="text-sm font-bold text-white">{t.perQuintal}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-emerald-200">
              {t.expectedBatchTotal} ({assay.quantity_quintals} Qtl)
            </div>
            <div className="text-xl font-black text-white">
              ₹{Math.round(assay.expected_batch_value_inr).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Bold Trader Negotiation Protection Banner */}
        <div className="mt-3.5 p-3.5 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-extrabold leading-snug">
            {assay.negotiation_tip}
          </p>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onStartNewAssay}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 text-xs sm:text-sm font-bold flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            {t.newAssayBtn}
          </button>
        </div>
      </div>
    </section>
  );
}

