const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHalStatus() {
  const res = await fetch(`${API_BASE}/api/v1/hal/status`);
  if (!res.ok) throw new Error('Failed to fetch HAL status');
  return res.json();
}

export async function fetchHalEvents(limit = 50) {
  const res = await fetch(`${API_BASE}/api/v1/hal/events?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch HAL events');
  return res.json();
}

export async function triggerHalWebhook(payload) {
  const res = await fetch(`${API_BASE}/api/v1/hal/actuator-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('HAL trigger failed');
  return res.json();
}

export async function resetHalActuator(eventId = null, markFalsePositive = false) {
  const res = await fetch(`${API_BASE}/api/v1/hal/reset-line`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: eventId,
      mark_false_positive: markFalsePositive,
    }),
  });
  if (!res.ok) throw new Error('HAL reset failed');
  return res.json();
}

export async function setHalHardwareMode(hardwareMode) {
  const res = await fetch(`${API_BASE}/api/v1/hal/hardware-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hardware_mode: hardwareMode }),
  });
  if (!res.ok) throw new Error('HAL hardware mode switch failed');
  return res.json();
}

export async function toggleFalsePositiveEvent(eventId) {
  const res = await fetch(`${API_BASE}/api/v1/hal/events/${eventId}/false-positive`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to toggle false positive');
  return res.json();
}

export async function fetchVillagePools() {
  const res = await fetch(`${API_BASE}/api/v1/lots/pools`);
  if (!res.ok) throw new Error('Failed to fetch village pools');
  return res.json();
}

export async function submitGinMillBid(poolId, bidPayload) {
  const res = await fetch(`${API_BASE}/api/v1/lots/pools/${poolId}/bid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bidPayload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to place bid');
  }
  return res.json();
}

export function createGinnerStreamSocket(onMessage, onStatusChange) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const defaultWs = `${proto}//${window.location.host}/ws/ginner/stream`;
  const wsUrl = import.meta.env.VITE_WS_URL || defaultWs;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => onStatusChange?.(true);
  ws.onclose = () => onStatusChange?.(false);
  ws.onerror = () => onStatusChange?.(false);
  ws.onmessage = (ev) => {
    try {
      onMessage?.(JSON.parse(ev.data));
    } catch {
      // Ignore malformed JSON
    }
  };
  return ws;
}

