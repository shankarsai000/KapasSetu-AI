import React from 'react';
import {
  Truck,
  Users,
  CheckCircle2,
  MapPin,
  Sparkles,
  Loader2,
  IndianRupee,
  Calendar,
} from 'lucide-react';

export default function VillagePoolCard({
  t,
  assay,
  pools,
  activePool,
  onJoinPool,
  isJoining,
  onAcceptBid,
  acceptingBidId,
}) {
  // Determine which pool to highlight at the top (joined pool, or nearby preview match, or top Kalamb pool)
  const highlightedPool =
    activePool ||
    (assay?.pool_id && pools.find((p) => p.id === assay.pool_id)) ||
    (assay?.nearby_pool_preview?.pool_id &&
      pools.find((p) => p.id === assay.nearby_pool_preview.pool_id)) ||
    pools[0];

  const renderStatusPill = (status) => {
    if (status === 'READY_FOR_BIDDING') {
      return (
        <span className="text-[11px] font-black bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full animate-pulse">
          {t.statusReady}
        </span>
      );
    }
    if (status === 'LOCKED_BY_MILL') {
      return (
        <span className="text-[11px] font-black bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-full">
          {t.statusLocked}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-extrabold bg-stone-200 text-slate-800 px-2.5 py-1 rounded-full">
        {t.statusCollecting}
      </span>
    );
  };

  return (
    <section className="space-y-4">
      {/* Primary 5km Geo-Clustered Village Pool Card */}
      <div className="bg-white rounded-2xl border-2 border-emerald-700/30 shadow-md p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-700 shrink-0" />
              {t.poolSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t.poolSectionSub}</p>
          </div>
          {highlightedPool && renderStatusPill(highlightedPool.status)}
        </div>

        {/* One-Tap Join Pool CTA if user has an unpooled assay */}
        {assay && !assay.pool_id && (
          <div className="mt-4">
            <button
              type="button"
              disabled={isJoining}
              onClick={onJoinPool}
              className="w-full min-h-[56px] bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-slate-950 font-black text-base sm:text-lg rounded-2xl px-5 py-3.5 shadow-md flex items-center justify-center gap-2 transition"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t.joiningPoolBtn}</span>
                </>
              ) : (
                <>
                  <Users className="w-6 h-6" />
                  <span>
                    {t.joinPoolCta.replace('{qty}', Number(assay.quantity_quintals).toFixed(1))}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {assay?.pool_id && (
          <div className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-sm font-extrabold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{t.alreadyPooledBadge}</span>
          </div>
        )}

        {/* Highlighted Cluster Live Truckload Progress Bar */}
        {highlightedPool && (
          <div className="mt-4 p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="font-black text-base text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" />
                {highlightedPool.village_cluster_name} ({highlightedPool.district})
              </div>
              <span className="text-xs font-extrabold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-md">
                {highlightedPool.quality_tier.replaceAll('_', ' ')} • Avg {highlightedPool.avg_staple_mm} mm
              </span>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full h-5 bg-stone-200 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  highlightedPool.total_quintals >= highlightedPool.target_threshold_quintals
                    ? 'bg-gradient-to-r from-emerald-600 to-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (highlightedPool.total_quintals / highlightedPool.target_threshold_quintals) *
                      100
                  )}%`,
                }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-slate-800">
              <span>
                {t.pooledProgressText
                  .replace('{current}', highlightedPool.total_quintals.toFixed(1))
                  .replace('{target}', highlightedPool.target_threshold_quintals.toFixed(1))
                  .replace('{farmers}', highlightedPool.farmer_count)
                  .replace('{cluster}', highlightedPool.village_cluster_name)}
              </span>
              <span className="text-emerald-800">
                Ask: ₹{Math.round(highlightedPool.ask_price_per_qtl).toLocaleString('en-IN')}/qtl
              </span>
            </div>

            {/* Live Incoming Direct Gin Mill Pickup Bids */}
            <div className="mt-4 pt-3 border-t border-stone-200">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                {t.incomingBidsTitle}
              </h3>

              {highlightedPool.bids && highlightedPool.bids.length > 0 ? (
                <div className="space-y-2.5">
                  {highlightedPool.bids.map((bid) => (
                    <div
                      key={bid.id}
                      className={`p-3.5 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        bid.status === 'ACCEPTED'
                          ? 'bg-emerald-50 border-emerald-600'
                          : 'bg-white border-amber-300 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="font-black text-slate-900 text-sm sm:text-base">
                          {bid.gin_mill_name}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{bid.gin_mill_location}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <Calendar className="w-3.5 h-3.5" />
                            {bid.pickup_date}
                          </span>
                        </div>
                        {bid.free_farm_gate_pickup && (
                          <span className="inline-block mt-1.5 text-[11px] font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                            ✓ {t.freeTractorBadge}
                          </span>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                        <div className="text-xl font-black text-emerald-800 flex items-center">
                          <IndianRupee className="w-4 h-4" />
                          {Math.round(bid.bid_price_per_qtl).toLocaleString('en-IN')}
                          <span className="text-xs font-bold text-slate-600 ml-0.5">/qtl</span>
                        </div>

                        {bid.status === 'ACCEPTED' ? (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-extrabold">
                            ✓ {t.acceptedBadge}
                          </span>
                        ) : highlightedPool.status !== 'LOCKED_BY_MILL' ? (
                          <button
                            type="button"
                            disabled={acceptingBidId === bid.id}
                            onClick={() => onAcceptBid(bid.id)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm transition"
                          >
                            {acceptingBidId === bid.id ? '...' : t.acceptBidBtn}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-600 bg-white border border-dashed border-stone-300 rounded-xl p-3">
                  {t.noBidsYet}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* All Active Vidarbha 5km Village Clusters Overview */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-3">
          {t.allVidarbhaPoolsTitle}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-sm text-slate-900">
                    {pool.village_cluster_name}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      pool.status === 'READY_FOR_BIDDING'
                        ? 'bg-amber-300 text-slate-950'
                        : pool.status === 'LOCKED_BY_MILL'
                        ? 'bg-emerald-200 text-emerald-950'
                        : 'bg-stone-200 text-slate-700'
                    }`}
                  >
                    {pool.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {pool.district} • {pool.farmer_count} Farmers • Staple {pool.avg_staple_mm} mm
                </div>
              </div>

              <div>
                <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden my-1.5">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${pool.progress_percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>
                    {pool.total_quintals.toFixed(1)} / {pool.target_threshold_quintals} Qtl
                  </span>
                  <span className="text-emerald-800">
                    {pool.highest_bid_per_qtl
                      ? `Top Bid: ₹${Math.round(pool.highest_bid_per_qtl)}/qtl`
                      : `Ask: ₹${Math.round(pool.ask_price_per_qtl)}/qtl`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

