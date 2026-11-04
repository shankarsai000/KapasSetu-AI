const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchDemoSamples() {
  const res = await fetch(`${API_BASE}/api/v1/grade/samples`);
  if (!res.ok) throw new Error('Failed to load sample presets');
  return res.json();
}

export async function submitCottonAssay(payload) {
  const res = await fetch(`${API_BASE}/api/v1/grade/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Grading analysis failed');
  }
  return res.json();
}

export async function fetchVillagePools() {
  const res = await fetch(`${API_BASE}/api/v1/lots/pools`);
  if (!res.ok) throw new Error('Failed to fetch village pools');
  return res.json();
}

export async function joinVillagePool(assayId, quantityQuintals) {
  const res = await fetch(`${API_BASE}/api/v1/lots/join-pool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assay_id: assayId,
      quantity_quintals: quantityQuintals,
    }),
  });
  if (!res.ok) throw new Error('Failed to join village pool');
  return res.json();
}

export async function acceptGinMillBid(bidId) {
  const res = await fetch(`${API_BASE}/api/v1/lots/bids/${bidId}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to accept mill bid');
  return res.json();
}

export function connectRealtimeSocket(onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const defaultWs = `${proto}//${window.location.host}/ws/ginner/stream`;
  const wsUrl = import.meta.env.VITE_WS_URL || defaultWs;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage?.(parsed);
    } catch {
      // Ignore malformed frame
    }
  };

  return ws;
}

export async function askVoiceCopilot({ audioBlob, queryText, language = 'mr-IN', gradeContext = null }) {
  if (audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'query.wav');
    formData.append('language', language);
    if (gradeContext) {
      formData.append('grade_context', JSON.stringify(gradeContext));
    }
    const res = await fetch(`${API_BASE}/api/v1/voice/ask`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Voice assistant query failed');
    return res.json();
  }

  const res = await fetch(`${API_BASE}/api/v1/voice/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_text: queryText,
      language,
      grade_context: gradeContext,
    }),
  });
  if (!res.ok) throw new Error('Voice assistant query failed');
  return res.json();
}

export async function fetchTextToSpeech(text, language = 'mr-IN') {
  const res = await fetch(`${API_BASE}/api/v1/voice/tts?format=json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error('TTS synthesis failed');
  return res.json();
}

export async function fetchOnboardingAudio(language = 'mr-IN') {
  const res = await fetch(`${API_BASE}/api/v1/voice/onboarding-audio?language=${encodeURIComponent(language)}`);
  if (!res.ok) throw new Error('Failed to fetch onboarding audio');
  return res.json();
}

export async function narrateGradingResult(assay, language = 'mr-IN') {
  const res = await fetch(`${API_BASE}/api/v1/voice/narrate-grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      color_grade: assay.color_grade,
      trash_percent: assay.trash_percent,
      final_fair_price_per_qtl: assay.final_fair_price_per_qtl,
      village_name: assay.village_name,
      language,
    }),
  });
  if (!res.ok) throw new Error('Failed to generate grading narration');
  return res.json();
}

