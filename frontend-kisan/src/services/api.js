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

