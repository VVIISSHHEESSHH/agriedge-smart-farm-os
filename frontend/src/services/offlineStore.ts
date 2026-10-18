export interface StoredScan {
  localId: string;
  payload: Record<string, unknown>;
  scanned_at: string;
  syncStatus: 'pending' | 'synced';
}

const DB_NAME = 'agriedge-offline';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('scans')) db.createObjectStore('scans', { keyPath: 'localId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveScanForSync(payload: Record<string, unknown>, url: string): Promise<StoredScan> {
  const db = await openDb();
  const scan: StoredScan = {
    localId: crypto.randomUUID(),
    payload,
    scanned_at: new Date().toISOString(),
    syncStatus: 'pending',
  };
  const tx = db.transaction(['outbox', 'scans'], 'readwrite');
  const scanId = scan.localId;
  tx.objectStore('scans').put(scan);
  tx.objectStore('outbox').add({
    url,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    scanLocalId: scanId,
    createdAt: scan.scanned_at,
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
  if (registration && 'sync' in registration) {
    await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('agriedge-outbox').catch(() => undefined);
  }
  return scan;
}

export async function countPendingOutbox(): Promise<number> {
  if (!('indexedDB' in globalThis)) return 0;
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction('outbox', 'readonly').objectStore('outbox').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return count;
}

export async function getStoredScans(): Promise<StoredScan[]> {
  if (!('indexedDB' in globalThis)) return [];
  const db = await openDb();
  const scans = await new Promise<StoredScan[]>((resolve, reject) => {
    const request = db.transaction('scans', 'readonly').objectStore('scans').getAll();
    request.onsuccess = () => resolve(request.result as StoredScan[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return scans.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
}
