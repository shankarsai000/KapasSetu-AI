/**
 * IndexedDB Offline Assay Cache & Deferred Sync Queue for Low-Connectivity Villages.
 */

const DB_NAME = 'kapassetu_kisan_offline_db';
const DB_VERSION = 1;
const STORE_ASSAYS = 'cached_assays';
const STORE_QUEUE = 'pending_pool_joins';

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ASSAYS)) {
        db.createObjectStore(STORE_ASSAYS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'assay_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheAssayCertificate(assay) {
  try {
    const db = await openOfflineDb();
    if (!db || !assay?.id) return;
    const tx = db.transaction(STORE_ASSAYS, 'readwrite');
    tx.objectStore(STORE_ASSAYS).put({
      ...assay,
      cached_at: new Date().toISOString(),
    });
  } catch {
    // Graceful no-op in restricted browsing contexts
  }
}

export async function getLastCachedCertificate() {
  try {
    const db = await openOfflineDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_ASSAYS, 'readonly');
      const req = tx.objectStore(STORE_ASSAYS).getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => (b.id || 0) - (a.id || 0));
        resolve(items[0] || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function enqueueOfflinePoolJoin(assayId, quantityQuintals) {
  try {
    const db = await openOfflineDb();
    if (!db) return;
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put({
      assay_id: assayId,
      quantity_quintals: quantityQuintals,
      queued_at: new Date().toISOString(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export async function flushOfflinePoolQueue(joinPoolFn) {
  try {
    const db = await openOfflineDb();
    if (!db) return [];
    const items = await new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const synced = [];
    for (const item of items) {
      try {
        const res = await joinPoolFn(item.assay_id, item.quantity_quintals);
        synced.push(res);
        const delTx = db.transaction(STORE_QUEUE, 'readwrite');
        delTx.objectStore(STORE_QUEUE).delete(item.assay_id);
      } catch {
        // Keep in queue for next connectivity restore
      }
    }
    return synced;
  } catch {
    return [];
  }
}

