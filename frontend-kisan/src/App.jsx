import React, { useEffect, useState, useCallback } from 'react';
import { Sprout, Wifi, WifiOff, Globe, Award, Camera, Truck } from 'lucide-react';
import { TRANSLATIONS } from './i18n/translations';
import DualCameraCapture from './components/DualCameraCapture';
import MoistureChecklist from './components/MoistureChecklist';
import GradeCertificate from './components/GradeCertificate';
import VillagePoolCard from './components/VillagePoolCard';
import {
  fetchDemoSamples,
  submitCottonAssay,
  fetchVillagePools,
  joinVillagePool,
  acceptGinMillBid,
  connectRealtimeSocket,
} from './services/api';
import {
  cacheAssayCertificate,
  getLastCachedCertificate,
  enqueueOfflinePoolJoin,
  flushOfflinePoolQueue,
} from './services/offlineSync';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const [activeView, setActiveView] = useState('capture'); // 'capture' | 'certificate' | 'pools'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [samples, setSamples] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('kalamb_long_grade_a');
  const [isMock, setIsMock] = useState(false);
  const [pileImage, setPileImage] = useState(null);
  const [haloImage, setHaloImage] = useState(null);

  const [formState, setFormState] = useState({
    farmer_name: 'Rameshwar Deshmukh',
    farmer_phone: '9823012345',
    villageId: 'kalamb',
    village_name: 'Kalamb',
    district: 'Yavatmal',
    latitude: 20.4456,
    longitude: 78.3264,
    picking_session: 'AFTERNOON_SUN',
    shade_dried_days: 2,
    quantity_quintals: 4.5,
    bleEnabled: false,
    bleMoisturePct: 7.9,
  });

  const [assay, setAssay] = useState(null);
  const [pools, setPools] = useState([]);
  const [activePool, setActivePool] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [acceptingBidId, setAcceptingBidId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4200);
  };

  const loadPools = useCallback(async () => {
    try {
      const list = await fetchVillagePools();
      setPools(list);
    } catch {
      // Keep cached pools if offline
    }
  }, []);

  useEffect(() => {
    fetchDemoSamples()
      .then((data) => {
        const list = data.samples || [];
        setSamples(list);
        if (list.length > 0) {
          setPileImage(list[0].pile_preview_base64);
          setHaloImage(list[0].halo_preview_base64);
        }
      })
      .catch(async () => {
        const cached = await getLastCachedCertificate();
        if (cached) setAssay(cached);
      });

    loadPools();
  }, [loadPools]);

  // Live WebSocket subscription for incoming Gin Mill bids & pool updates
  useEffect(() => {
    const ws = connectRealtimeSocket((msg) => {
      if (
        msg.type === 'NEW_MILL_BID' ||
        msg.type === 'POOL_UPDATED' ||
        msg.type === 'POOL_READY_FOR_BIDDING' ||
        msg.type === 'BID_ACCEPTED'
      ) {
        loadPools();
        if (msg.type === 'NEW_MILL_BID') {
          showToast(
            `New Gin Mill Bid: ${msg.gin_mill_name} offered ₹${Math.round(
              msg.bid_price_per_qtl
            )}/qtl!`
          );
        }
      }
    });
    return () => ws.close();
  }, [loadPools]);

  // Online / Offline sync listener
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      const synced = await flushOfflinePoolQueue(joinVillagePool);
      if (synced.length > 0) {
        showToast('Synced offline village pool enrollment!');
        loadPools();
      }
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadPools]);

  const handleSelectPreset = (sample) => {
    setIsMock(false);
    setSelectedPreset(sample.preset_id);
    setPileImage(sample.pile_preview_base64);
    setHaloImage(sample.halo_preview_base64);
    const matchingVillageId = sample.village_name.toLowerCase();
    setFormState((prev) => ({
      ...prev,
      villageId: matchingVillageId,
      village_name: sample.village_name,
      district: sample.district,
      latitude: sample.latitude,
      longitude: sample.longitude,
      picking_session:
        sample.preset_id === 'amravati_high_trash_dew' ? 'MORNING_DEW' : 'AFTERNOON_SUN',
      shade_dried_days: sample.preset_id === 'amravati_high_trash_dew' ? 0 : 2,
    }));
  };

  const handleRunAssay = async () => {
    setIsAnalyzing(true);
    try {
      const payload = {
        pile_image_base64: pileImage,
        halo_image_base64: haloImage,
        sample_preset: selectedPreset,
        is_mock: isMock,
        farmer_name: formState.farmer_name,
        farmer_phone: formState.farmer_phone,
        village_name: formState.village_name,
        district: formState.district,
        latitude: formState.latitude,
        longitude: formState.longitude,
        picking_session: formState.picking_session,
        shade_dried_days: formState.shade_dried_days,
        quantity_quintals: formState.quantity_quintals,
        sensor_override_pct: formState.bleEnabled ? formState.bleMoisturePct : null,
        auto_join_pool: false,
      };
      const result = await submitCottonAssay(payload);
      setAssay(result);
      setActivePool(null);
      await cacheAssayCertificate(result);
      await loadPools();
      setActiveView('certificate');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast(`Assay error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleJoinPool = async () => {
    if (!assay) return;
    setIsJoining(true);
    try {
      const updatedPool = await joinVillagePool(assay.id, assay.quantity_quintals);
      setActivePool(updatedPool);
      setAssay((prev) => (prev ? { ...prev, pool_id: updatedPool.id } : prev));
      await loadPools();
      if (updatedPool.status === 'READY_FOR_BIDDING') {
        showToast(
          `${updatedPool.village_cluster_name} crossed 30 Quintals! Broadcasted to Gin Mills within 50km.`
        );
      } else {
        showToast(`Added ${assay.quantity_quintals} Quintals to ${updatedPool.village_cluster_name}!`);
      }
    } catch {
      await enqueueOfflinePoolJoin(assay.id, assay.quantity_quintals);
      showToast('Queued in Offline IndexedDB — will auto-join when signal returns.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleAcceptBid = async (bidId) => {
    setAcceptingBidId(bidId);
    try {
      const lockedPool = await acceptGinMillBid(bidId);
      setActivePool(lockedPool);
      await loadPools();
      showToast('Direct Gin Mill Bid Accepted! Tractor pickup confirmed.');
    } catch (err) {
      showToast(`Could not accept bid: ${err.message}`);
    } finally {
      setAcceptingBidId(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900 pb-14">
      {/* Top Sticky Outdoor High-Contrast Navbar + Instant Language Switcher */}
      <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-md border-b-2 border-amber-400">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shadow">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black leading-none">{t.appName}</h1>
                <span className="hidden sm:inline-block text-[10px] font-black bg-emerald-700 text-amber-300 px-2 py-0.5 rounded-full">
                  {t.freeForeverBadge}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 leading-tight mt-0.5">{t.tagline}</p>
            </div>
          </div>

          {/* Instant 3-Language Switcher: English | मराठी | हिन्दी */}
          <div className="flex items-center gap-1 bg-emerald-950/70 p-1 rounded-xl border border-emerald-700">
            <Globe className="w-3.5 h-3.5 text-amber-300 ml-1 hidden sm:block" />
            {[
              { code: 'en', label: 'English' },
              { code: 'mr', label: 'मराठी' },
              { code: 'hi', label: 'हिन्दी' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLang(item.code)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                  lang === item.code
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-emerald-100 hover:bg-emerald-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Stepper Tabs */}
        <div className="max-w-3xl mx-auto px-3 sm:px-4 pb-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveView('capture')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeView === 'capture'
                ? 'bg-white text-emerald-950 shadow'
                : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.tabAssay}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('certificate')}
            disabled={!assay}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition disabled:opacity-45 ${
              activeView === 'certificate'
                ? 'bg-white text-emerald-950 shadow'
                : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.tabCertificate}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('pools')}
            className={`min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeView === 'pools'
                ? 'bg-white text-emerald-950 shadow'
                : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span className="truncate">{t.tabPools}</span>
          </button>
        </div>
      </header>

      {/* Connectivity & IndexedDB Status Strip */}
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-2">
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
        )}
        <span>{t.offlineSavedBanner}</span>
      </div>

      {/* Live Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-slate-900 text-amber-300 border-2 border-amber-400 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-extrabold text-center">
          {toastMsg}
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 space-y-5">
        {activeView === 'capture' && (
          <>
            <DualCameraCapture
              t={t}
              samples={samples}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              pileImage={pileImage}
              setPileImage={setPileImage}
              haloImage={haloImage}
              setHaloImage={setHaloImage}
              isMock={isMock}
              setIsMock={setIsMock}
            />
            <MoistureChecklist
              t={t}
              formState={formState}
              setFormState={setFormState}
              onRunAssay={handleRunAssay}
              isAnalyzing={isAnalyzing}
            />
          </>
        )}

        {activeView === 'certificate' && assay && (
          <>
            <GradeCertificate
              t={t}
              assay={assay}
              onStartNewAssay={() => setActiveView('capture')}
            />
            <VillagePoolCard
              t={t}
              assay={assay}
              pools={pools}
              activePool={activePool}
              onJoinPool={handleJoinPool}
              isJoining={isJoining}
              onAcceptBid={handleAcceptBid}
              acceptingBidId={acceptingBidId}
            />
          </>
        )}

        {activeView === 'pools' && (
          <VillagePoolCard
            t={t}
            assay={assay}
            pools={pools}
            activePool={activePool}
            onJoinPool={handleJoinPool}
            isJoining={isJoining}
            onAcceptBid={handleAcceptBid}
            acceptingBidId={acceptingBidId}
          />
        )}
      </main>
    </div>
  );
}

