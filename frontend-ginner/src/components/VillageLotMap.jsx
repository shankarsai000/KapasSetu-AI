import React, { useState } from 'react';
import {
  MapPin,
  Truck,
  Calculator,
  CheckCircle2,
  Send,
  TrendingUp,
  Layers,
} from 'lucide-react';

// Normalized schematic coordinates for Vidarbha Cotton Belt Map (SVG 560x260)
const DISTRICT_COORDS = {
  Amravati: { x: 145, y: 68 },
  Yavatmal: { x: 185, y: 185 },
  Wardha: { x: 335, y: 145 },
  Nagpur: { x: 445, y: 82 },
};

export default function VillageLotMap({ pools, onSubmitBid }) {
  const [selectedPoolId, setSelectedPoolId] = useState(null);
  const [millName, setMillName] = useState('Mahalaxmi Ginning & Pressing');
  const [millLocation, setMillLocation] = useState('Hinganghat MIDC, Wardha');
  const [bidPrice, setBidPrice] = useState('');
  const [pickupDate, setPickupDate] = useState('Tomorrow, 10:00 AM');
  const [submitting, setSubmitting] = useState(false);

  const selectedPool =
    pools.find((p) => p.id === selectedPoolId) ||
    pools.find((p) => p.status === 'READY_FOR_BIDDING') ||
    pools[0];

  const effectiveBidPrice =
    bidPrice !== ''
      ? Number(bidPrice)
      : Math.round((selectedPool?.ask_price_per_qtl || 7600) + 45);

  // Automatic Gin Mill Direct Procurement ROI Calculator
  const poolQty = selectedPool?.total_quintals || 30.0;
  const grossLotValue = poolQty * effectiveBidPrice;
  const traditionalCommission = grossLotValue * 0.03; // 3.0% traditional arhatiya/middleman cut
  const kapassetuFee = grossLotValue * 0.005; // 0.5% KapasSetu clearing fee
  const trashBonusSavings =
    selectedPool && selectedPool.avg_trash_pct < 3.0
      ? poolQty * (3.2 - selectedPool.avg_trash_pct) * 65
      : poolQty * 55;
  const netMillSavingsInr = Math.max(
    0,
    Math.round(traditionalCommission - kapassetuFee + trashBonusSavings)
  );

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!selectedPool) return;
    setSubmitting(true);
    try {
      await onSubmitBid(selectedPool.id, {
        gin_mill_name: millName,
        gin_mill_location: millLocation,
        bid_price_per_qtl: effectiveBidPrice,
        pickup_date: pickupDate,
        free_farm_gate_pickup: true,
      });
      setBidPrice('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-4 sm:p-5 space-y-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Vidarbha 5km Geo-Clustered Cotton Pool Marketplace
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Source uniform, pre-graded 30+ quintal village truckloads directly from FPO clusters (0.5% clearing fee vs. 3% trader commission).
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
          PostGIS / Haversine 5,000m Spatial Engine
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Interactive Vidarbha Spatial Radar Map + Pool Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Vidarbha Spatial Radar SVG */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>VIDARBHA COTTON BELT • 50 KM MILL PROCUREMENT RADAR</span>
              <span className="text-amber-300">● READY (&ge;30 Qtl) &nbsp; ○ COLLECTING</span>
            </div>

            <svg viewBox="0 0 560 230" className="w-full h-48 sm:h-52">
              {/* Radar Grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(51,65,85,0.35)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="560" height="230" fill="url(#grid)" rx="8" />

              {/* 50km Gin Mill Radius Ring around Wardha/Hinganghat Hub */}
              <circle
                cx="335"
                cy="145"
                r="95"
                fill="rgba(6, 182, 212, 0.05)"
                stroke="rgba(34, 211, 238, 0.25)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />

              {/* Plot Village Pools */}
              {pools.map((pool, idx) => {
                const base = DISTRICT_COORDS[pool.district] || {
                  x: 220 + idx * 55,
                  y: 120,
                };
                const isSelected = selectedPool?.id === pool.id;
                const isReady = pool.status === 'READY_FOR_BIDDING';
                const color =
                  pool.status === 'LOCKED_BY_MILL'
                    ? '#10b981'
                    : isReady
                    ? '#fbbf24'
                    : '#38bdf8';

                return (
                  <g
                    key={pool.id}
                    onClick={() => {
                      setSelectedPoolId(pool.id);
                      setBidPrice('');
                    }}
                    className="cursor-pointer"
                  >
                    {/* 5km Spatial Cluster Ring */}
                    <circle
                      cx={base.x}
                      cy={base.y}
                      r={isSelected ? 30 : 22}
                      fill={`${color}22`}
                      stroke={color}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                    />
                    <circle cx={base.x} cy={base.y} r="7" fill={color} />
                    <text
                      x={base.x}
                      y={base.y - 14}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {pool.village_cluster_name}
                    </text>
                    <text
                      x={base.x}
                      y={base.y + 22}
                      textAnchor="middle"
                      fill={color}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {pool.total_quintals.toFixed(1)} Qtl ({pool.avg_staple_mm}mm)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Pool Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pools.map((pool) => {
              const active = selectedPool?.id === pool.id;
              return (
                <button
                  key={pool.id}
                  type="button"
                  onClick={() => {
                    setSelectedPoolId(pool.id);
                    setBidPrice('');
                  }}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${
                    active
                      ? 'bg-slate-800/90 border-cyan-400 shadow-md'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-white flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      {pool.village_cluster_name}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                        pool.status === 'READY_FOR_BIDDING'
                          ? 'bg-amber-400 text-slate-950'
                          : pool.status === 'LOCKED_BY_MILL'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {pool.status}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Weight</span>
                      <strong className="text-white">{pool.total_quintals} Qtl</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Staple</span>
                      <strong className="text-cyan-300">{pool.avg_staple_mm} mm</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Trash/Mst</span>
                      <strong>
                        {pool.avg_trash_pct}% / {pool.avg_moisture_pct}%
                      </strong>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{pool.farmer_count} Farmers Pooled</span>
                    <span className="font-mono font-bold text-emerald-400">
                      Ask: ₹{Math.round(pool.ask_price_per_qtl)}/qtl
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Direct Pickup Bid Console & Automatic Mill ROI Calculator (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col justify-between space-y-4">
          {selectedPool ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-cyan-400 font-bold">
                    Direct Mill Bid Desk
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Pool #{selectedPool.id} • {selectedPool.district}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {selectedPool.village_cluster_name} ({selectedPool.total_quintals} Quintals)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tier: {selectedPool.quality_tier} • Avg Rd: {selectedPool.avg_rd} • Staple:{' '}
                  {selectedPool.avg_staple_mm} mm • Trash: {selectedPool.avg_trash_pct}%
                </p>

                {/* Automatic Gin Mill ROI Calculator Box */}
                <div className="mt-3 p-3 rounded-xl bg-emerald-950/35 border border-emerald-500/30 space-y-1.5">
                  <div className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4" />
                    Estimated Gin Mill Direct-Sourcing ROI:
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Arhatiya Commission Saved (2.5% net):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +₹{Math.round(traditionalCommission - kapassetuFee).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Verified Low-Trash Outturn Gain:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +₹{Math.round(trashBonusSavings).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-emerald-800/60 flex justify-between text-xs font-black text-white">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      Net Mill Savings on Truckload:
                    </span>
                    <span className="font-mono text-amber-300 text-sm">
                      ₹{netMillSavingsInr.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Bid Form */}
                <form onSubmit={handlePlaceBid} className="mt-3.5 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Ginning Mill Name
                    </label>
                    <input
                      type="text"
                      required
                      value={millName}
                      onChange={(e) => setMillName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Offer Price (₹ / Quintal)
                      </label>
                      <input
                        type="number"
                        step="5"
                        required
                        value={effectiveBidPrice}
                        onChange={(e) => setBidPrice(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono font-bold text-amber-300 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Tractor Pickup Slot
                      </label>
                      <input
                        type="text"
                        required
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || selectedPool.status === 'LOCKED_BY_MILL'}
                    className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow transition"
                  >
                    {selectedPool.status === 'LOCKED_BY_MILL' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Pool Locked by Accepted Bid
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {submitting
                          ? 'Broadcasting Bid to Farmers...'
                          : `Submit Direct Pickup Bid (₹${effectiveBidPrice}/qtl)`}
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Existing Bids on Selected Pool */}
              <div className="pt-3 border-t border-slate-800">
                <div className="text-[11px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-cyan-400" />
                  Active Mill Bids on {selectedPool.village_cluster_name} (
                  {selectedPool.bids?.length || 0})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(selectedPool.bids || []).map((b) => (
                    <div
                      key={b.id}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{b.gin_mill_name}</div>
                        <div className="text-[11px] text-slate-400">{b.pickup_date}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-black text-emerald-400">₹{b.bid_price_per_qtl}/qtl</div>
                        <div className="text-[10px] text-slate-400">{b.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-400">Loading active Vidarbha pools...</div>
          )}
        </div>
      </div>
    </section>
  );
}

