const CACHE_NAME = 'agriedge-shell-v1';
const DB_NAME = 'agriedge-offline';
const DB_VERSION = 1;
const PRECACHE = [
  '/', '/index.html', '/manifest.webmanifest', '/favicon.svg',
  '/models/plant-disease/model.tflite',
  '/models/plant-disease/metadata.json',
  '/models/plant-disease/training_metadata.json',
  '/tflite-wasm/tflite_web_api_client.js',
  '/tflite-wasm/tflite_web_api_cc.js',
  '/tflite-wasm/tflite_web_api_cc.wasm',
  '/tflite-wasm/tflite_web_api_cc_simd.js',
  '/tflite-wasm/tflite_web_api_cc_simd.wasm',
  '/tflite-wasm/tflite_web_api_cc_simd_threaded.js',
  '/tflite-wasm/tflite_web_api_cc_simd_threaded.wasm',
  '/tflite-wasm/tflite_web_api_cc_simd_threaded.worker.js',
  '/tflite-wasm/tflite_web_api_cc_threaded.js',
  '/tflite-wasm/tflite_web_api_cc_threaded.wasm',
  '/tflite-wasm/tflite_web_api_cc_threaded.worker.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const shellResponse = await fetch('/index.html');
    if (shellResponse.ok) {
      await cache.put('/index.html', shellResponse.clone());
      const shellHtml = await shellResponse.text();
      const assets = [...shellHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
      await Promise.all(assets.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        } catch {
          // Keep installing the worker; the cached document remains available.
        }
      }));
    }
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Optional runtime variants may not exist in every deployment.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('agriedge-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/index.html')) || Response.error()
    ));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/tflite-wasm/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});

function openDb() {
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

async function syncOutbox() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const request = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  for (const item of items) {
    let response;
    try {
      response = await fetch(item.url, item.init);
    } catch {
      break;
    }
    if (!response.ok) break;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['outbox', 'scans'], 'readwrite');
      tx.objectStore('outbox').delete(item.id);
      if (item.scanLocalId) {
        const scans = tx.objectStore('scans');
        const request = scans.get(item.scanLocalId);
        request.onsuccess = () => {
          if (request.result) scans.put({ ...request.result, syncStatus: 'synced' });
        };
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  db.close();
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => client.postMessage({ type: 'AGRIEDGE_OUTBOX_SYNCED' }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'agriedge-outbox') event.waitUntil(syncOutbox());
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_OUTBOX') event.waitUntil(syncOutbox());
});
